"use client";

import React, { useState, useRef, useEffect } from "react";
const UploadIcon = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

const SendIcon = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const BotIcon = () => (
  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold flex-shrink-0">
    B
  </div>
);

const UserIcon = () => (
  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
    U
  </div>
);

type Message = {
  id: string;
  text: string;
  sender: "user" | "bot";
  source?: "enhanced" | "pinecone";
};

type UploadStatus = "idle" | "uploading" | "success" | "error";
type ChatMode = "enhanced" | "pinecone";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [isSending, setIsSending] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("enhanced");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const BACKEND_URL = "http://localhost:8000";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setUploadStatus("uploading");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      setUploadStatus("success");
      setTimeout(() => setUploadStatus("idle"), 3000);
    } catch (error) {
      console.error("File upload error:", error);
      setUploadStatus("error");
      setTimeout(() => setUploadStatus("idle"), 3000);
    } finally {
      setSelectedFile(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: "user",
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const endpoint = `${BACKEND_URL}/query/${chatMode}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input, mode: "hybrid" }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const result = await response.json();
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: result.response || "Sorry, I could not process that.",
        sender: "bot",
        source: chatMode,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "An error occurred. Please try again.",
        sender: "bot",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const renderUploadStatus = () => {
    switch (uploadStatus) {
      case "uploading":
        return (
          <p className="text-xs text-yellow-400">
            Uploading: {selectedFile?.name}
          </p>
        );
      case "success":
        return (
          <p className="text-xs text-green-400">
            ✅ File uploaded successfully!
          </p>
        );
      case "error":
        return (
          <p className="text-xs text-red-400">
            ❌ Upload failed. Please try again.
          </p>
        );
      default:
        return (
          <p className="text-xs text-slate-400">
            Upload documents, PDFs, audio, or images.
          </p>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white font-sans">
      <header className="p-4 border-b border-slate-700 shadow-md bg-slate-800/50 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-center text-slate-200">
          Chat With Your Data
        </h1>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-72 p-4 bg-slate-900/80 border-b md:border-r border-slate-700 flex flex-col space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2 text-slate-300">
              Upload File
            </h2>
            <div
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="w-8 h-8 text-slate-500 mb-2" />
              <p className="text-sm font-semibold text-slate-400">
                {uploadStatus === "uploading"
                  ? "Uploading..."
                  : "Click to select a file"}
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,image/*,audio/*"
              />
            </div>
            <div className="h-4 mt-2">{renderUploadStatus()}</div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2 text-slate-300">
              Query Mode
            </h2>
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setChatMode("enhanced")}
                className={`flex-1 p-2 text-sm font-medium rounded-md transition-colors ${
                  chatMode === "enhanced"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-700"
                }`}
              >
                Enhanced
              </button>
              <button
                onClick={() => setChatMode("pinecone")}
                className={`flex-1 p-2 text-sm font-medium rounded-md transition-colors ${
                  chatMode === "pinecone"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-700"
                }`}
              >
                Pinecone
              </button>
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex flex-col space-y-6">
              {messages.length === 0 ? (
                <div className="text-center text-slate-500 mt-10">
                  <p>No messages yet.</p>
                  <p>Upload a file or ask a question to get started.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.sender === "bot" && <BotIcon />}
                    <div
                      className={`max-w-md p-3 rounded-xl shadow-lg ${
                        msg.sender === "user"
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-slate-700 text-slate-200 rounded-bl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {msg.sender === "bot" && msg.source && (
                        <p className="text-xs mt-2 text-slate-400 capitalize opacity-70">
                          Source: {msg.source}
                        </p>
                      )}
                    </div>
                    {msg.sender === "user" && <UserIcon />}
                  </div>
                ))
              )}
              {isSending && (
                <div className="flex items-start gap-3 justify-start">
                  <BotIcon />
                  <div className="max-w-md p-3 rounded-xl shadow-lg bg-slate-700 text-slate-200 rounded-bl-none">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-300"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Form */}
          <div className="p-4 bg-slate-800/80 border-t border-slate-700">
            <form
              onSubmit={handleSendMessage}
              className="flex items-center space-x-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about your documents..."
                className="flex-1 p-3 bg-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                disabled={isSending}
              />
              <button
                type="submit"
                className="p-3 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={!input.trim() || isSending}
              >
                <SendIcon className="w-6 h-6 text-white" />
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
