import React, { useState } from "react";
import { Send, Download, Loader2, Bot, User, Database } from "lucide-react";
import { api } from "../api/client";

export default function RAGChat({ onBack }: { onBack: () => void }) {
    const [repoUrl, setRepoUrl] = useState("https://github.com/rohanprofessional-1/Opscribe");
    const [ingesting, setIngesting] = useState(false);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; content: string; metadata?: any }>>([
        { role: "bot", content: "Hello! I can answer questions about repositories you've ingested. Use the input below to ingest a new repo or ask me something!" }
    ]);
    const [status, setStatus] = useState<string | null>(null);

    const handleIngest = async () => {
        setIngesting(true);
        setStatus("Cloning and embedding repository...");
        try {
            const res = await api.ingestRepo("00000000-0000-0000-0000-000000000000", repoUrl);
            setStatus(`Success! Ingested ${res.chunks_ingested} chunks.`);
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        } finally {
            setIngesting(false);
        }
    };

    const handleQuery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        const userMsg = query;
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setQuery("");
        setLoading(true);

        try {
            const res = await api.queryRag("00000000-0000-0000-0000-000000000000", userMsg);

            const botMsg = {
                role: "bot" as const,
                content: res.answer,
                metadata: res.items // These are the chunks
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (e: any) {
            setMessages(prev => [...prev, { role: "bot", content: `Error: ${e.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
            <header className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">← Back</button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Bot className="text-blue-400" /> Repository Knowledge Base
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 flex items-center gap-2">
                        <input
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="GitHub URL"
                            className="bg-transparent text-sm border-none focus:outline-none w-64"
                        />
                        <button
                            onClick={handleIngest}
                            disabled={ingesting}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-md text-xs font-medium flex items-center gap-1 disabled:opacity-50 transition-colors"
                        >
                            {ingesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            {ingesting ? "Ingesting..." : "Ingest"}
                        </button>
                    </div>
                </div>
            </header>

            {status && (
                <div className={`p-2 text-center text-xs ${status.startsWith("Error") ? "bg-red-900/30 text-red-300" : "bg-blue-900/30 text-blue-300"}`}>
                    {status}
                </div>
            )}

            <main className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-4 ${m.role === "bot" ? "" : "flex-row-reverse"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "bot" ? "bg-blue-900/50 text-blue-400" : "bg-gray-800 text-gray-400"}`}>
                            {m.role === "bot" ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>
                        <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === "bot" ? "bg-gray-900 border border-gray-800" : "bg-blue-600 text-white"}`}>
                            <div className="whitespace-pre-wrap text-sm font-sans">{m.content}</div>
                            {m.metadata && (m.metadata as any[]).length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-800">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-2">
                                        <Database className="w-3 h-3" /> Sources
                                    </span>
                                    <div className="grid gap-2">
                                        {(m.metadata as any[]).map((chunk, idx) => (
                                            <div key={idx} className="bg-gray-950 p-2 rounded-lg border border-gray-800 text-[11px] text-gray-400">
                                                <span className="text-blue-400 block mb-1">Source {idx + 1}</span>
                                                {chunk.content.substring(0, 200)}...
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-900/50 text-blue-400">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                        </div>
                    </div>
                )}
            </main>

            <footer className="p-4 border-t border-gray-800 bg-gray-900/50">
                <form onSubmit={handleQuery} className="max-w-4xl mx-auto relative">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="Ask a question about the repository..."
                    />
                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </footer>
        </div>
    );
}
