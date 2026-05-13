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
    <div className="p-4 border-t border-white/10 bg-black/20">
      <form onSubmit={handleSubmit} className="flex gap-3">
        {step === "upload" ? (
          <div className="flex-1 flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded-xl cursor-pointer transition-all duration-300 group">
              <UploadCloud className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Klik untuk Unggah Foto Bukti</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
            <button 
              type="button"
              onClick={() => setStep("chat")}
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/50"
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
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-violet-400 transition-colors"
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
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
              disabled={step === "analyzing"}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || step === "analyzing"}
              className="p-3 bg-violet-600 hover:bg-violet-500 disabled:bg-white/5 disabled:text-white/20 rounded-xl glow-button"
            >
              <Send className="w-5 h-5" />
            </button>
          </>
        )}
      </form>
    </div>
  );
}
