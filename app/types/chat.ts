export type MessageRole = "ai" | "user" | "agent";
export type MessageType = "text" | "upload" | "analysis" | "result";

export interface Message {
  id: string | number;
  role: MessageRole;
  content: string;
  type?: MessageType;
  data?: any;
  imageUrl?: string;
  timestamp?: string;
}

export type ChatStatus = "ai" | "waiting" | "human";
export type ChatStep = "chat" | "order_id" | "upload" | "analyzing" | "result";

export interface OrderItem {
  name: string;
  price: number;
}
