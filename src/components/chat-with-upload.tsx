"use client";

import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MessageBubble from "./MessageBubble";
import type { Engine, Message, UploadItem } from "@/types/chat";
import { Plus, Send, Paperclip } from "lucide-react";

async function getSafeResponseText(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data.response) {
      return data.response;
    }
    return JSON.stringify(data, null, 2);
  } catch {
    try {
      return await res.text();
    } catch {
      return "Received response, but could not parse it.";
    }
  }
}

export default function ChatWithUpload({ className }: { className?: string }) {
  const [engine, setEngine] = useState<Engine>("enhanced");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false); // New state for processing

  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backendUrl = useMemo(() => {
    return (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
  }, []);

  // Load and persist messages for a smoother UX
  useEffect(() => {
    try {
      const raw = localStorage.getItem("chat_with_upload_messages");
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "chat_with_upload_messages",
        JSON.stringify(messages)
      );
    } catch {}
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, uploads, pending]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  }

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    
    // Reset height to auto to get the correct scrollHeight
    e.target.style.height = 'auto';
    // Set height to scrollHeight but limit to max 200px (about 8 lines)
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }

  async function onSend() {
    if (!backendUrl) {
      toast.warning("Missing backend URL", {
        description: "Set NEXT_PUBLIC_BACKEND_URL in the Vars sidebar.",
      });
      return;
    }
    const q = input.trim();
    if (!q) return;

    const id = crypto.randomUUID();
    const userMsg: Message = {
      id,
      role: "user",
      content: q,
      createdAt: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setPending(true);

    try {
      const endpoint =
        engine === "enhanced"
          ? `${backendUrl}/query/enhanced`
          : `${backendUrl}/query/pinecone`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: q, mode: "hybrid" }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(errText || `Request failed: ${res.status}`);
      }

      const text = await getSafeResponseText(res);

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: text || "(No content returned)",
        engine,
        createdAt: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);
    } catch (err: any) {
      toast.warning("Chat error", {
        description: String(err?.message || err || "Unknown error"),
      });
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I ran into an error processing that request.",
        engine,
        createdAt: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);
    } finally {
      setPending(false);
    }
  }

  function onBrowseClick() {
    fileInputRef.current?.click();
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) void uploadFiles(files);
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) void uploadFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadFiles(files: File[]) {
    setProcessing(true); // Start processing after upload begins
    if (!backendUrl) {
      toast.warning("Missing backend URL", {
        description: "Set NEXT_PUBLIC_BACKEND_URL in the Vars sidebar.",
      });
      return;
    }
    const nextUploads: UploadItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      size: f.size,
      progress: 0,
      status: "idle",
    }));
    setUploads((prev) => [...prev, ...nextUploads]);

    await Promise.all(
      files.map(
        (file, idx) =>
          new Promise<void>((resolve) => {
            const itemId = nextUploads[idx].id;
            const form = new FormData();
            form.append("file", file);

            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${backendUrl}/upload`, true);
            xhr.responseType = "json";

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const percent = Math.round((evt.loaded / evt.total) * 100);
                setUploads((prev) =>
                  prev.map((u) =>
                    u.id === itemId
                      ? { ...u, progress: percent, status: "uploading" }
                      : u
                  )
                );
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setUploads((prev) =>
                  prev.map((u) =>
                    u.id === itemId
                      ? { ...u, progress: 100, status: "success" }
                      : u
                  )
                );
                resolve();
              } else {
                const message =
                  (xhr.response &&
                    (xhr.response.error || xhr.response.message)) ||
                  `Upload failed (${xhr.status})`;
                setUploads((prev) =>
                  prev.map((u) =>
                    u.id === itemId
                      ? { ...u, status: "error", error: message }
                      : u
                  )
                );
                resolve();
              }
            };
            xhr.onerror = () => {
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === itemId
                    ? { ...u, status: "error", error: "Network error" }
                    : u
                )
              );
              resolve();
            };
            xhr.send(form);
          })
      )
    );

    // Clear processing state after all uploads complete
    setProcessing(false);

    const successCount = nextUploads.filter((u) => u.status !== "error").length;
    if (successCount > 0) {
      toast.success("Upload complete", {
        description:
          successCount === 1
            ? "Your file was uploaded successfully and is ready for chat."
            : `${successCount} files uploaded successfully and are ready for chat.`,
      });
    }
    const errorCount = nextUploads.length - successCount;
    if (errorCount > 0) {
      toast.warning("Some uploads failed", {
        description: `${errorCount} file(s) failed to upload.`,
      });
    }
  }

  const accept =
    "image/*,.pdf,.doc,.docx,.txt,.md,.rtf,.mp3,.wav,.m4a,.aac,.flac,.ogg,.webm,.mkv,.mp4";

  return (
    <div 
      className={cn("flex flex-col h-screen bg-background", className)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h1 className="text-xl font-semibold">Chat Assistant</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="engine" className="sr-only">
            Engine
          </Label>
          <Select value={engine} onValueChange={(v: Engine) => setEngine(v)}>
            <SelectTrigger id="engine" className="w-[160px]">
              <SelectValue placeholder="Engine" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem value="enhanced">Enhanced</SelectItem>
                <SelectItem value="pinecone">Pinecone</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-hidden">
          {messages.length === 0 && uploads.length === 0 ? (
            /* Welcome/Drop Zone */
            <div 
              className={cn(
                "h-full flex flex-col items-center justify-center p-8 text-center transition-all duration-200 cursor-pointer",
                dragActive
                  ? "bg-primary/10 border-primary/50"
                  : "bg-gradient-to-b from-muted/20 to-muted/40 hover:from-muted/30 hover:to-muted/50"
              )}
              onClick={onBrowseClick}
              role="button"
              aria-label="Upload files"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onBrowseClick();
              }}
            >
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary/20">
                  <Paperclip className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  Chat With Your Files
                </h2>
                <p className="text-muted-foreground mb-6 text-lg leading-relaxed">
                  Drag and drop your files here, or click to browse. You can upload images, PDFs, documents, text files, and audio files.
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Supported: Images, PDF, DOC, TXT, Audio files
                </p>
              </div>
            </div>
          ) : (
            /* Chat messages */
            <div
              ref={listRef}
              className="h-full overflow-y-auto p-4 space-y-4"
              aria-live="polite"
            >
              {/* Upload list */}
              {uploads.length > 0 && (
                <div className="space-y-2 mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground">Chat With Your Files</h3>
                  {uploads.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{u.fileName}</p>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full transition-all",
                              u.status === "error" ? "bg-destructive" : "bg-primary"
                            )}
                            style={{ width: `${u.progress}%` }}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={u.progress}
                            role="progressbar"
                          />
                        </div>
                      </div>
                      <div className="shrink-0">
                        {u.status === "success" && (
                          <span className="text-xs text-green-600 font-medium">Complete</span>
                        )}
                        {u.status === "uploading" && (
                          <span className="text-xs text-muted-foreground">
                            {u.progress}%
                          </span>
                        )}
                        {u.status === "error" && (
                          <span className="text-xs text-destructive font-medium">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Chat messages */}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              
              {pending && (
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">AI</AvatarFallback>
                  </Avatar>
                  <div className="max-w-[80%] rounded-lg bg-muted px-3 py-2">
                    <p className="text-sm text-muted-foreground">Thinking…</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSend();
            }}
            className="max-w-4xl mx-auto"
          >
            <div className="relative flex items-end gap-2 rounded-lg border border-border bg-background p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBrowseClick}
                className="shrink-0 h-10 w-10 p-0 self-end"
                aria-label="Upload files"
                disabled={processing}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Textarea
                id="message"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={uploads.length > 0 ? "Ask a question about your uploaded content…" : "Upload a file first, then ask a question…"}
                className="min-h-[40px] max-h-[200px] flex-1 resize-none border-0 bg-transparent p-2 focus-visible:ring-0 focus-visible:ring-offset-0"
                rows={1}
                style={{ height: '40px' }}
                disabled={processing}
              />
              <Button 
                type="submit" 
                disabled={pending || !backendUrl || !input.trim() || processing}
                size="sm"
                className="shrink-0 h-10 w-10 p-0 self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Press Enter to send, Shift+Enter for a new line
            </p>
          </form>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        onChange={onFileInputChange}
      />
      <Label htmlFor="file-input" className="sr-only">
        Chat With Your Files
      </Label>

      {/* Drag overlay */}
      {dragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
          <div className="rounded-xl border-2 border-dashed border-primary bg-background/80 p-12 text-center shadow-2xl backdrop-blur-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <Paperclip className="w-8 h-8 text-primary" />
            </div>
            <p className="text-2xl font-bold text-primary mb-2">Drop files here</p>
            <p className="text-muted-foreground">Release to upload your files</p>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {processing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl border bg-card shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-primary animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
            </div>
            <p className="text-lg font-semibold text-primary">Uploading and processing document…</p>
            <p className="text-sm text-muted-foreground text-center">Please wait while your file is being uploaded and processed.<br/>You cannot send queries or upload another file during this process.</p>
          </div>
        </div>
      )}
    </div>
  );
}
