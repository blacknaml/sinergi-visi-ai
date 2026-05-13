"use client";

import { Zap, ShieldCheck, Package, ArrowRight } from "lucide-react";
import { ChatStatus } from "../../types/chat";

interface ChatHeaderProps {
  chatStatus: ChatStatus;
  onNewChat: () => void;
}

export default function ChatHeader({ chatStatus, onNewChat }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Zap className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold premium-gradient-text">SinergiVisi AI</h1>
          <p className="text-xs text-white/50">Autonomous Support Agent</p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-4 text-xs text-white/40">
        {chatStatus === "waiting" && (
          <div className="status-waiting-badge">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            Menghubungkan Agen...
          </div>
        )}
        {chatStatus === "human" && (
          <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 font-bold">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            Mode: Manusia
          </div>
        )}
        <div className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure</div>
        <div className="flex items-center gap-1"><Package className="w-4 h-4 text-blue-500" /> Tracked</div>
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-white/50 hover:text-white"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Chat Baru
        </button>
      </div>
    </header>
  );
}
