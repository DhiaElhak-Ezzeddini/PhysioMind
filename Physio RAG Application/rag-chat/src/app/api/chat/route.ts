/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// --- Local embeddings ---
async function EmbQuery(query: string) {
    const res = await fetch("http://localhost:8000/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query }),
    });

    let json;
    try {
        json = await res.json();
    } catch (err) {
        const text = await res.text();
        throw new Error(`Local embedding service error: ${res.status} ${res.statusText} - ${text}`);
    }

    if (!res.ok) throw new Error(`Embedding service returned error: ${JSON.stringify(json)}`);
    return json.embedding; // array of floats
}

// --- Ollama generation via local HTTP API ---
async function GenQuery(prompt: string): Promise<string> {
    console.log("Final prompt:", prompt);
    const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "llama3:8b",      // replace with your model name if different
            prompt,
            stream: false,
            options: { num_predict: 700 }
        })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama API error: ${res.status} ${res.statusText} - ${text}`);
    }

    const data = await res.json();
    return data.response?.trim() || "";
}

// --- Prompt formatter ---
type ContextItem = { chunk_text: string; source?: string; page?: string };
type Example = { query: string; answer: string };

function formatPrompt(
    query: string,
    contextItems: ContextItem[],
    examples?: Example[],
    includeMetadata = false
): string {
    let context: string;
    if (!contextItems || contextItems.length === 0) {
        context = "No additional context available.";
    } else {
        context = contextItems
            .map(item => {
                const chunk = item.chunk_text.trim();
                if (includeMetadata) {
                    const metadata: string[] = [];
                    if (item.source) metadata.push(`Source: ${item.source}`);
                    if (item.page) metadata.push(`Page: ${item.page}`);
                    const metaStr = metadata.join(" | ");
                    return metaStr ? `- ${chunk} (${metaStr})` : `- ${chunk}`;
                }
                return `- ${chunk}`;
            })
            .join("\n");
    }

    const defaultExamples: Example[] = [
        {
            query: "What are the primary functions of the kidney?",
            answer: "The kidneys regulate fluid and electrolyte balance, remove metabolic waste products, control blood pressure via the renin-angiotensin system, and produce hormones such as erythropoietin.",
        },
        {
            query: "How does the Frank-Starling law regulate cardiac output?",
            answer: "The Frank-Starling law states that the stroke volume of the heart increases in response to an increase in venous return (end-diastolic volume). This ensures balance between the output of the right and left ventricles.",
        },
        {
            query: "What is the role of surfactant in the lungs?",
            answer: "Pulmonary surfactant reduces surface tension within the alveoli, preventing alveolar collapse during expiration and making breathing more efficient.",
        },
    ];

    const examplesToUse = examples || defaultExamples;
    const examplesBlock = examplesToUse
        .map((ex, i) => `Example ${i + 1}:\nQuery: ${ex.query}\nAnswer: ${ex.answer}\n`)
        .join("\n");

    const basePrompt = `
You are a strict RAG assistant. Answer ONLY using the CONTEXT.
Cite sources like [1],[2] and include page numbers (e.g, p. X) next to each claim. 

Guidelines:
- First, extract relevant information from the context before answering.
- Be concise but explanatory.
- If the context does not contain the answer, explicitly say so.
- Always ground your response in the context.

Here are examples of the desired answer style:
${examplesBlock}

Now use the following context items to answer the user query:
${context}

Relevant passages: <extract relevant info from the context here>

User query: ${query}
Answer:
`;

    return basePrompt.trim();
}

// --- API route ---
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const message = (body?.message ?? "").toString().trim();
        if (!message) {
            return new Response(JSON.stringify({ error: "Empty Query" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 1. Get embedding from local service
        const queryEmbedding = await EmbQuery(message);

        // 2. Retrieve relevant chunks from Supabase
        const { data: chunks, error } = await supabase.rpc("match_documents", {
            query_embedding: queryEmbedding,
            match_count: 8,
            filter: { "source": "Guyton and Hall Textbook of Medical Physiology" },
        });
        if (error) throw error;

        const contextItems: ContextItem[] = (chunks ?? []).map((c: any) => ({
            chunk_text: c.content,
            source: c.metadata?.source,
            page: c.metadata?.page_number,
        }));
        // debug
        console.log("Context items for debugging:", contextItems);
        // 3. Format prompt
        const prompt = formatPrompt(message, contextItems, undefined, true);

        // 4. Generate answer using Ollama HTTP API
        const answer = await GenQuery(prompt);

        return new Response(JSON.stringify({ answer, sources: chunks }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
