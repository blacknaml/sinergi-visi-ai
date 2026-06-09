"use client";

import { useEffect, useRef } from "react";
import ChatHeader from "./components/Chat/ChatHeader";
import MessageList from "./components/Chat/MessageList";
import ItemSelection from "./components/Chat/ItemSelection";
import ChatInput from "./components/Chat/ChatInput";
import { useChatSession } from "./hooks/useChatSession";
import { useClaimAnalysis } from "./hooks/useClaimAnalysis";

export default function Home() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    setMessages,
    chatStatus,
    setChatStatus,
    isTyping,
    setIsTyping,
    orderItems,
    setOrderItems,
    sessionId,
    socket,
    sendMessage,
    addMessage
  } = useChatSession();

  const {
    step,
    setStep,
    currentOrder,
    setCurrentOrder,
    handleFileUpload
  } = useClaimAnalysis({
    sessionId,
    chatStatus,
    socket,
    addMessage,
    setMessages,
    setIsTyping,
    setChatStatus,
    setOrderItems
  });

  // Listen for specific AI intents to change UI state
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.role === "ai" && (lastMsg as any).intent === "request_photo") {
      const orderMatch = (lastMsg as any).orderId || 
        messages.slice().reverse().map((m: any) => m.content?.match?.(/ORD-[A-Z0-9]+/i)?.[0]).find(Boolean);
      
      if (orderMatch) {
        setCurrentOrder((prev: any) => ({ ...prev, id: orderMatch }));
        setStep("upload");
        setOrderItems([]); // Bersihkan pilihan item saat masuk ke mode upload
      }
    }
  }, [messages, setCurrentOrder, setStep]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, [messages, isTyping]);

  const handleNewChat = () => {
    localStorage.removeItem("chat_session_id");
    window.location.reload();
  };

  const onSelectItem = (item: any) => {
    setCurrentOrder((prev: any) => ({ ...prev, item: item.name, price: item.price }));
    sendMessage(`[INTENT:REQUEST_CLAIM_ITEM] ${item.name}`);
    setOrderItems([]);
  };

  const onFileUpload = (file: File) => {
    // Collect user text context for Gemini
    const userTextMsgs = messages.filter(m => m.role === "user" && m.type === "text");
    const lastUserMsg = userTextMsgs.map(m => m.content).join(" | ") || "Tidak ada alasan tertulis";
    handleFileUpload(file, lastUserMsg);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 md:p-8">
      <ChatHeader chatStatus={chatStatus} onNewChat={handleNewChat} />

      <div className="flex-1 glass-card overflow-hidden flex flex-col mb-6">
        <MessageList 
          messages={messages} 
          isTyping={isTyping} 
          messagesEndRef={messagesEndRef} 
        />

        <ItemSelection 
          orderItems={orderItems} 
          onSelectItem={onSelectItem} 
          onClose={() => setOrderItems([])} 
        />

        <ChatInput 
          step={step} 
          chatStatus={chatStatus} 
          onSendMessage={sendMessage} 
          onFileUpload={onFileUpload}
          setStep={setStep}
        />
      </div>

      <footer className="text-center">
        <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted-darker)' }}>
          SinergiVisi Layanan Pelanggan • Developed by <a href="https://debipraharadika.web.id" target="_blank" rel="noopener noreferrer" className="hover:text-[#cda434] transition-colors">Debi Prahara Dika</a>
        </p>
      </footer>
    </div>
  );
}
