import type { Metadata } from "next"
import ChatWithUpload from "@/components/chat-with-upload"

export const metadata: Metadata = {
  title: "Chat",
  description: "Upload files and chat",
}

export default function ChatPage() {
  return (
    <ChatWithUpload />
  )
}