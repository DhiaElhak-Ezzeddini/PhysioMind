/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";

type Message = {
    role: "user" | "assistant";
    text: string;
    sources?: { page?: string; text: string }[];
};

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");

    async function sendMessage() {
        if (!input.trim()) return;

        const userMsg: Message = { role: "user", text: input };
        setMessages(prev => [...prev, userMsg]);

        // Call backend
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: input }),
        });

        const data = await res.json();
        const botMsg: Message = {
            role: "assistant",
            text: data.answer,
            sources: data.sources?.map((s: any) => ({
                page: s.metadata?.page,
                text: s.content || s.text,
            })),
        };

        setMessages(prev => [...prev, botMsg]);
        setInput("");
    }

    return (
        <div className="flex flex-col h-screen bg-black text-white">
            {/* Header */}
            <header className="p-4 text-center text-purple-400 font-bold text-xl border-b border-purple-700">
                ⚡ Medical RAG Assistant
            </header>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, i) => (
                    <div key={i} className="flex flex-col max-w-3xl">
                        <div
                            className={`p-3 rounded-2xl ${m.role === "user"
                                    ? "ml-auto bg-purple-600 text-white"
                                    : "mr-auto bg-gray-800 border border-purple-600 text-gray-200"
                                }`}
                        >
                            {m.text}
                        </div>

                        {/* Sources for assistant messages */}
                        {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                            <div className="ml-4 mt-2 space-y-1">
                                {m.sources.map((s, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-purple-900 bg-opacity-50 border border-purple-700 p-2 rounded-md text-gray-200 text-sm"
                                    >
                                        <strong>Page {s.page ?? "N/A"}:</strong> {s.text}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Input box */}
            <div className="p-4 border-t border-purple-700 bg-black">
                <div className="flex gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && sendMessage()}
                        placeholder="Ask me anything..."
                        className="flex-1 bg-gray-900 text-white p-3 rounded-xl border border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                        onClick={sendMessage}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
