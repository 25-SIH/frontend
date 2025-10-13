"use client"

import type * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Engine = "enhanced" | "pinecone"

type Message = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  engine?: Engine
  createdAt: number
}

type UploadItem = {
  id: string
  fileName: string
  size: number
  progress: number
  status: "idle" | "uploading" | "success" | "error"
  error?: string
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

async function getSafeResponseText(res: Response): Promise<string> {
  // Try multiple response shapes gracefully
  const contentType = res.headers.get("content-type") || ""
  try {
    if (contentType.includes("application/json")) {
      const data = await res.json()
      // Common keys to try
      const candidates = [
        data.answer || "",
        data.text || "",
        data.result || "",
        data.response || "",
        typeof data === "string" ? data : "",
      ].filter(Boolean) as string[]
      if (candidates.length > 0) return candidates[0]
      return JSON.stringify(data, null, 2)
    } else {
      // Attempt text fallback for text/plain, etc.
      return await res.text()
    }
  } catch {
    try {
      return await res.text()
    } catch {
      return "Received response, but could not parse it."
    }
  }
}

export default function ChatWithUpload({ className }: { className?: string }) {
  const [engine, setEngine] = useState<Engine>("enhanced")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState(false)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragActive, setDragActive] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const backendUrl = useMemo(() => {
    return (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "")
  }, [])

  // Load and persist messages for a smoother UX
  useEffect(() => {
    try {
      const raw = localStorage.getItem("chat_with_upload_messages")
      if (raw) setMessages(JSON.parse(raw))
    } catch {}
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem("chat_with_upload_messages", JSON.stringify(messages))
    } catch {}
  }, [messages])

  // Auto-scroll
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, uploads, pending])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void onSend()
    }
  }

  async function onSend() {
    if (!backendUrl) {
      toast.warning("Missing backend URL",{
        description: "Set NEXT_PUBLIC_BACKEND_URL in the Vars sidebar.",
      })
      return
    }
    const q = input.trim()
    if (!q) return

    const id = crypto.randomUUID()
    const userMsg: Message = {
      id,
      role: "user",
      content: q,
      createdAt: Date.now(),
    }
    setMessages((m) => [...m, userMsg])
    setInput("")
    setPending(true)

    try {
      const endpoint = engine === "enhanced" ? `${backendUrl}/query/enhanced` : `${backendUrl}/query/pinecone`

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: q, mode: "hybrid" }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        throw new Error(errText || `Request failed: ${res.status}`)
      }

      const text = await getSafeResponseText(res)

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: text || "(No content returned)",
        engine,
        createdAt: Date.now(),
      }
      setMessages((m) => [...m, aiMsg])
    } catch (err: any) {
      toast.warning("Chat error",{
        description: String(err?.message || err || "Unknown error"),
      })
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I ran into an error processing that request.",
        engine,
        createdAt: Date.now(),
      }
      setMessages((m) => [...m, aiMsg])
    } finally {
      setPending(false)
    }
  }

  function onBrowseClick() {
    fileInputRef.current?.click()
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) void uploadFiles(files)
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length) void uploadFiles(files)
    // reset so picking the same file again still triggers change
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function uploadFiles(files: File[]) {
    if (!backendUrl) {
      toast.warning("Missing backend URL", {
        description: "Set NEXT_PUBLIC_BACKEND_URL in the Vars sidebar.",
      })
      return
    }
    const nextUploads: UploadItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      size: f.size,
      progress: 0,
      status: "idle",
    }))
    setUploads((prev) => [...prev, ...nextUploads])

    await Promise.all(
      files.map(
        (file, idx) =>
          new Promise<void>((resolve) => {
            const itemId = nextUploads[idx].id
            const form = new FormData()
            form.append("file", file)

            const xhr = new XMLHttpRequest()
            xhr.open("POST", `${backendUrl}/upload`, true)
            xhr.responseType = "json"

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const percent = Math.round((evt.loaded / evt.total) * 100)
                setUploads((prev) =>
                  prev.map((u) => (u.id === itemId ? { ...u, progress: percent, status: "uploading" } : u)),
                )
              }
            }
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setUploads((prev) =>
                  prev.map((u) => (u.id === itemId ? { ...u, progress: 100, status: "success" } : u)),
                )
                resolve()
              } else {
                const message =
                  (xhr.response && (xhr.response.error || xhr.response.message)) || `Upload failed (${xhr.status})`
                setUploads((prev) => prev.map((u) => (u.id === itemId ? { ...u, status: "error", error: message } : u)))
                resolve()
              }
            }
            xhr.onerror = () => {
              setUploads((prev) =>
                prev.map((u) => (u.id === itemId ? { ...u, status: "error", error: "Network error" } : u)),
              )
              resolve()
            }
            xhr.send(form)
          }),
      ),
    )

    const successCount = nextUploads.filter((u) => u.status !== "error").length
    if (successCount > 0) {
      toast.success("Upload complete",{
        description:
          successCount === 1 ? "Your file was uploaded successfully." : `${successCount} files uploaded successfully.`,
      })
    }
    const errorCount = nextUploads.length - successCount
    if (errorCount > 0) {
      toast.warning("Some uploads failed", {
        description: `${errorCount} file(s) failed to upload.`,
      })
    }
  }

  const accept = "image/*,.pdf,.doc,.docx,.txt,.md,.rtf,.mp3,.wav,.m4a,.aac,.flac,.ogg,.webm,.mkv,.mp4"

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-lg font-medium leading-tight">Assistant</h2>
          </div>
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

        {!backendUrl && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive-foreground">Backend not configured</p>
            <p className="mt-1 text-muted-foreground">
              Set <span className="font-mono">NEXT_PUBLIC_BACKEND_URL</span> in the Vars sidebar to enable uploads and
              chat.
            </p>
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="pt-4">
        {/* Dropzone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-6 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30",
          )}
          onClick={onBrowseClick}
          role="button"
          aria-label="Upload files"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onBrowseClick()
          }}
        >
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
            Upload files
          </Label>
          <p className="text-sm">
            <span className="font-medium">Drag & drop</span> files here, or <span className="underline">browse</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Accepted: images, PDF, docs, text, and audio</p>
        </div>

        {/* Upload list */}
        {uploads.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.fileName}</p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
                    <div
                      className={cn("h-full transition-all", u.status === "error" ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${u.progress}%` }}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={u.progress}
                      role="progressbar"
                    />
                  </div>
                </div>
                <div className="shrink-0">
                  {u.status === "success" && <span className="text-xs text-muted-foreground">Done</span>}
                  {u.status === "uploading" && <span className="text-xs text-muted-foreground">{u.progress}%</span>}
                  {u.status === "error" && <span className="text-xs text-destructive-foreground">Failed</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div
          ref={listRef}
          className="mt-6 max-h-[45vh] overflow-y-auto rounded-md border bg-card p-3"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              No messages yet. Upload a file and ask a question to get started.
            </div>
          )}
          <div className="space-y-4">
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
        </div>
      </CardContent>

      <CardFooter className="gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void onSend()
          }}
          className="flex w-full items-end gap-2"
        >
          <div className="grid w-full gap-1">
            <Label htmlFor="message" className="sr-only">
              Message
            </Label>
            <Textarea
              id="message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your uploaded content…"
              className="min-h-[72px] resize-y"
            />
            <p className="px-1 text-[11px] text-muted-foreground">Press Enter to send, Shift+Enter for a new line</p>
          </div>
          <Button type="submit" disabled={pending || !backendUrl}>
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex items-start gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">AI</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn("max-w-[80%] rounded-lg px-3 py-2", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}
      >
        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        <div className={cn("mt-1 text-[10px]", isUser ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {message.engine ? `via ${message.engine}` : ""} {formatTime(message.createdAt)}
        </div>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">You</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
