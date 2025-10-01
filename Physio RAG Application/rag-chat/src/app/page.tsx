/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";

type Source = { page?: string; text: string };
type Message = {
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); // clear input
    setLoading(true); // show typing indicator

    try {
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
    } catch (err) {
      console.error(err);
      const errorMsg: Message = { role: "assistant", text: "Error processing request." };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function renderWithReferences(msg: Message) {
    if (!msg.sources || msg.sources.length === 0) return msg.text;

    let rendered = msg.text;
    msg.sources.forEach((source, idx) => {
      const ref = `[${idx + 1}]`;
      rendered = rendered.replace(
        ref,
        `<span title="Page ${source.page ?? "N/A"}: ${source.text.replace(
          /"/g,
          "'"
        )}" class="underline cursor-help text-blue-400 font-medium">${ref}</span>`
      );
    });
    return rendered;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="p-4 text-center text-indigo-400 font-bold text-2xl border-b border-gray-700 shadow-md">
         Medical Physiology RAG Assistant
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`p-4 rounded-2xl max-w-[80%] break-words shadow-md ${m.role === "user"
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  : "bg-gray-800 border border-gray-700 text-gray-200"
                }`}
              dangerouslySetInnerHTML={{
                __html:
                  m.role === "assistant"
                    ? renderWithReferences(m)
                    : m.text,
              }}
            />
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex w-full justify-start">
            <div className="p-3 rounded-2xl bg-gray-800 border border-gray-700 text-gray-400 max-w-[80%] animate-pulse">
              Typing...
            </div>
          </div>
        )}
      </div>

      {/* Input box */}
      <div className="p-4 border-t border-gray-700 bg-gray-900">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Ask me anything..."
            className="flex-1 bg-gray-800 text-gray-100 p-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
          />
          <button
            onClick={sendMessage}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors shadow-md"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
