export type Engine = "enhanced" | "pinecone";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  engine?: Engine;
  createdAt: number;
};

export type UploadItem = {
  id: string;
  fileName: string;
  size: number;
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
};
