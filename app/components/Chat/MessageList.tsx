"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Message } from "../../types/chat";
import ReactMarkdown from "react-markdown";

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function MessageList({ messages, isTyping, messagesEndRef }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
      {messages.length === 1 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-10 text-center space-y-6"
        >
          <div className="relative w-64 h-64 rounded-full overflow-hidden border-2 border-amber-500/30 shadow-[0_0_50px_rgba(205,164,52,0.2)]">
            <img src="/hero.png" alt="SinergiVisi AI Hero" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Sinergi AI & Manusia untuk Anda</h2>
            <p className="text-sm max-w-xs" style={{ color: 'var(--muted)' }}>Dapatkan layanan pelanggan terbaik dengan perpaduan kecerdasan AI dan empati tim agen kami. Kami siap membantu klaim Anda dengan cepat dan personal.</p>
          </div>
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] ${
              msg.role === "user" ? "chat-bubble-user" : 
              msg.role === "agent" ? "chat-bubble-agent" : 
              "chat-bubble-ai"
            }`}>
              {(!msg.type || msg.type === "text") && (
                <div className="text-sm leading-relaxed prose-invert max-w-none">
                  <ReactMarkdown>
                    {msg.content.replace(/\[INTENT:[A-Z_]+\]/g, '').trim()}
                  </ReactMarkdown>
                </div>
              )}
              
              {msg.type === "upload" && (
                <div className="space-y-2">
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Uploaded" className="rounded-lg max-h-40 w-auto object-contain mb-2" />
                  )}
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--input-bg)' }}>
                      <Camera className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-sm italic">{msg.data?.fileName || "File Terlampir"}</p>
                  </div>
                </div>
              )}

              {msg.type === "analysis" && (
                <div className="flex items-center gap-3 py-2">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  <p className="text-sm font-medium">{msg.content}</p>
                </div>
              )}

              {msg.type === "result" && (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${msg.data.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {msg.data.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-bold uppercase tracking-wider">
                      {msg.data.status === 'approved' ? 'Disetujui Otomatis' : 'Menunggu Review'}
                    </span>
                  </div>
                  <p className="text-sm">{msg.content}</p>
                  <div className="text-xs p-2 rounded border" style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: 'var(--card-border)' }}>
                    <p>Nilai Refund: <span className="font-mono text-cyan-400">Rp {(msg.data?.amount || 0).toLocaleString('id-ID')}</span></p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {isTyping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-start"
        >
          <div className="chat-bubble-ai px-4 py-2 flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--muted)' }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.2s]" style={{ backgroundColor: 'var(--muted)' }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.4s]" style={{ backgroundColor: 'var(--muted)' }} />
          </div>
        </motion.div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
