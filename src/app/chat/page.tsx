import type { Metadata } from "next"
import ChatWithUpload from "@/components/chat-with-upload"

export const metadata: Metadata = {
  title: "Chat",
  description: "Upload files and chat",
}

export default function ChatPage() {
  return (
    <main className="min-h-[100svh]">
      <section className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <h1 className="text-pretty text-2xl font-semibold tracking-tight md:text-3xl">Chat with your data</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a file (image, document, PDF, or audio), then ask questions.
        </p>
        <div className="mt-6">
          <ChatWithUpload />
        </div>
      </section>
    </main>
  )
}