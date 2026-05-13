"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Claim } from "../types";

interface ChatPanelProps {
  claim: Claim;
  handleSendMessage: (message: string) => void;
}

export default function ChatPanel({ claim, handleSendMessage }: ChatPanelProps) {
  const [agentMessage, setAgentMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [claim.messages]);

  return (
    <div className="w-1/2 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
        {claim.status === "pending" ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8" />
            </div>
            <p className="text-sm max-w-[200px]">Silakan klik "Ambil Alih" untuk mulai berbicara dengan pengguna.</p>
          </div>
        ) : (
          <>
            {claim.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                  msg.role === 'agent' ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-white/5 text-white/80 rounded-tl-none border border-white/10'
                }`}>
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Attachment" className="rounded-lg mb-2 max-h-48 w-auto object-contain cursor-zoom-in" />
                  )}
                  {msg.content.replace(/\[INTENT:[A-Z_]+\]/g, '').trim()}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {claim.status === "active" && (
        <div className="p-4 border-t border-white/5 bg-black/20">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(agentMessage);
              setAgentMessage("");
            }}
            className="flex gap-3"
          >
            <input 
              type="text" 
              value={agentMessage}
              onChange={(e) => setAgentMessage(e.target.value)}
              placeholder="Balas ke pengguna..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <button 
              type="submit"
              className="p-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
