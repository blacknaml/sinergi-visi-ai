export type Message = {
  role: "user" | "agent" | "ai";
  content: string;
  id: string | number;
  imageUrl?: string;
};

export type Claim = {
  id: string;
  orderId: string;
  item: string;
  price: number;
  reason: string;
  analysis: any;
  status: "pending" | "active" | "complete";
  decision?: "pending" | "approved" | "rejected";
  messages: Message[];
  imageUrl?: string;
  archived?: boolean;
  orderDetails?: any;
};

export type Agent = {
  id: number;
  name: string;
  email: string;
  role: string;
};
