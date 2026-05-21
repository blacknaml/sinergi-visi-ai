"use client";

import { useState } from "react";
import { Send, Camera, UploadCloud, AlertCircle } from "lucide-react";
import { ChatStep, ChatStatus } from "../../types/chat";

interface ChatInputProps {
  step: ChatStep;
  chatStatus: ChatStatus;
  onSendMessage: (msg: string) => void;
  onFileUpload: (file: File) => void;
  setStep: (step: ChatStep) => void;
}

export default function ChatInput({ step, chatStatus, onSendMessage, onFileUpload, setStep }: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="p-4 border-t" style={{ borderColor: 'var(--card-border)', backgroundColor: 'rgba(0,0,0,0.05)' }}>
      <form onSubmit={handleSubmit} className="flex gap-3">
        {step === "upload" ? (
          <div className="flex-1 flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/30 rounded-xl cursor-pointer transition-all duration-300 group">
              <UploadCloud className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Klik untuk Unggah Foto Bukti</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
            <button 
              type="button"
              onClick={() => setStep("chat")}
              className="p-3 border rounded-xl transition-colors"
              style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--muted)' }}
              title="Batal"
            >
              <AlertCircle className="w-5 h-5 rotate-45" />
            </button>
          </div>
        ) : (
          <>
            <button 
              type="button"
              onClick={() => setStep("upload")}
              className="p-3 border rounded-xl text-amber-500 transition-colors"
              style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--input-border)' }}
              title="Unggah Foto"
            >
              <Camera className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                chatStatus === "waiting" || chatStatus === "human" ? "Ketik pesan untuk agen..." :
                step === "order_id" ? "Masukkan Nomor Order (SV-XXXX)..." : 
                "Ketik pesan..."
              }
              className="flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
              style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }}
              disabled={step === "analyzing"}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || step === "analyzing"}
              className="p-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl glow-button"
              style={{ backgroundColor: '#cda434', color: 'white' }}
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </>
        )}
      </form>
    </div>
  );
}
