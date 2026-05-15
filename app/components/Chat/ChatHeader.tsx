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
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Autonomous Support Agent</p>
        </div>
      </div>
      <div className="flex items-center flex-wrap justify-end gap-2 md:gap-4 text-xs" style={{ color: 'var(--muted-darker)' }}>
        {chatStatus === "waiting" && (
          <div className="status-waiting-badge">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            <span className="hidden sm:inline">Menghubungkan Agen...</span>
          </div>
        )}
        {chatStatus === "human" && (
          <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 font-bold">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <span className="hidden sm:inline">Mode: </span>Manusia
          </div>
        )}
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="hidden sm:inline">Secure</span>
        </div>
        <div className="flex items-center gap-1">
          <Package className="w-4 h-4 text-blue-500" />
          <span className="hidden sm:inline">Tracked</span>
        </div>
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all hover:text-[var(--foreground)]"
          style={{ 
            backgroundColor: 'var(--input-bg)', 
            border: '1px solid var(--card-border)',
            borderRadius: '0.5rem',
            color: 'var(--muted)'
          }}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Chat Baru
        </button>
      </div>
    </header>
  );
}
