import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Message, ChatStatus, OrderItem } from "../types/chat";
import { API_BASE_URL } from "../../lib/api-config";

export function useChatSession() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "ai",
      content: "Halo! Saya SinergiVisi AI. Ada yang bisa saya bantu hari ini? Anda bisa bertanya tentang produk, pengiriman, atau melaporkan kendala pada pesanan Anda.",
      type: "text",
    },
  ]);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("ai");
  const [isTyping, setIsTyping] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "ssr-session";
    let id = localStorage.getItem("chat_session_id");
    if (!id) {
      id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("chat_session_id", id);
    }
    return id;
  });
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ["websocket"]
    });
    socketRef.current = socket;

    socket.emit("join_room", { roomId: sessionId });

    socket.on("new_message", (msg: any) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.role === "agent") setChatStatus("human");
      
      if (msg.role === "ai") {
        setIsTyping(false);
        if (msg.orderItems && Array.isArray(msg.orderItems) && msg.orderItems.length > 0) {
          setOrderItems(msg.orderItems);
        }
      }
    });

    socket.on("mode_update", ({ mode }: { mode: any }) => {
      if (mode === "human") setChatStatus("human");
    });

    socket.on("load_history", ({ roomId, history }: { roomId: string, history: Message[] }) => {
      if (history.length > 0) {
        setMessages(history);
      }
    });

    socket.on("chat_archived", () => {
      localStorage.removeItem("chat_session_id");
      window.location.reload();
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  const sendMessage = (content: string) => {
    if (!content.trim() || !socketRef.current) return;
    socketRef.current.emit("send_message", {
      roomId: sessionId,
      content: content.trim(),
      role: "user"
    });
    setIsTyping(true);
  };

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  return {
    messages,
    setMessages,
    chatStatus,
    setChatStatus,
    isTyping,
    setIsTyping,
    orderItems,
    setOrderItems,
    sessionId,
    socket: socketRef.current,
    sendMessage,
    addMessage
  };
}
