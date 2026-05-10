"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  MessageSquare, 
  ClipboardCheck, 
  LayoutDashboard,
  ShieldAlert,
  Send,
  User,
  CheckCircle,
  Clock,
  AlertTriangle
} from "lucide-react";
import { io } from "socket.io-client";

type Claim = {
  id: string;
  orderId: string;
  item: string;
  price: number;
  reason: string;
  analysis: any;
  status: "pending" | "active" | "completed";
  messages: { role: "user" | "agent" | "ai"; content: string; id: string | number }[];
  imageUrl?: string;
};

export default function AdminDashboard() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState("");
  const socketRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedClaim = claims.find(c => c.id === selectedClaimId);

  useEffect(() => {
    const socket = io("http://localhost:3001", {
      transports: ["websocket"]
    });
    socketRef.current = socket;

    socket.emit("join_admin");

    socket.on("new_claim_alert", (payload: any) => {
      const newClaim: Claim = {
        id: payload.id,
        orderId: payload.orderId,
        item: payload.claimData?.item || `Order ${payload.orderId}`,
        price: payload.claimData?.price || 0,
        reason: payload.claimData?.reason || payload.content,
        analysis: payload.claimData?.analysis || { damageType: "Pending", confidence: 0 },
        status: "pending",
        imageUrl: payload.claimData?.imageUrl,
        messages: []
      };
      setClaims(prev => {
        if (prev.some(c => c.id === payload.id)) return prev;
        return [...prev, newClaim];
      });
    });

    socket.on("new_message", (msg: any) => {
      setClaims(prev => prev.map(c => {
        if (c.id === msg.roomId) {
          if (c.messages.some(m => m.id === msg.id)) return c;
          return {
            ...c,
            messages: [...c.messages, { role: msg.role, content: msg.content, id: msg.id, imageUrl: msg.imageUrl }],
            imageUrl: msg.imageUrl || c.imageUrl
          };
        }
        return c;
      }));
    });

    socket.on("load_history", (history: any[]) => {
      setClaims(prev => prev.map(c => {
        if (history.length > 0 && (history[0].roomId === c.id || history.some(h => h.roomId === c.id))) {
          const latestPhoto = [...history].reverse().find(h => h.imageUrl)?.imageUrl;
          return { 
            ...c, 
            messages: history.map(h => ({ 
              role: h.role, 
              content: h.content, 
              id: h.id, 
              imageUrl: h.imageUrl 
            })),
            imageUrl: latestPhoto || c.imageUrl
          };
        }
        return c;
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedClaim?.messages]);

  const handleClaimSession = (claimId: string) => {
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: "active" } : c));
    setSelectedClaimId(claimId);
    if (socketRef.current) {
      socketRef.current.emit("join_room", { roomId: claimId });
    }
  };

  useEffect(() => {
    if (selectedClaimId && socketRef.current) {
      socketRef.current.emit("join_room", { roomId: selectedClaimId });
    }
  }, [selectedClaimId]);

  const handleSendMessage = () => {
    if (!agentMessage.trim() || !selectedClaimId || !socketRef.current) return;

    const message = agentMessage.trim();
    socketRef.current.emit("agent_message", {
      roomId: selectedClaimId,
      content: message
    });
    setAgentMessage("");
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-black/40 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">SinergiVisi <span className="text-cyan-400">Admin</span></h1>
        </div>

        <nav className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl text-cyan-400">
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-sm font-medium">Dashboard</span>
          </div>
          <div className="flex items-center gap-3 p-3 text-white/40 hover:text-white transition-colors cursor-pointer">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium">Agents</span>
          </div>
          <div className="flex items-center gap-3 p-3 text-white/40 hover:text-white transition-colors cursor-pointer">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-sm font-medium">Security</span>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Claim List */}
        <section className="w-80 border-r border-white/5 flex flex-col">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">Antrean Klaim</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {claims.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center opacity-30">
                <Clock className="w-8 h-8 mb-2" />
                <p className="text-xs">Tidak ada klaim aktif</p>
              </div>
            )}
            {claims.map(claim => (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedClaimId(claim.id)}
                className={`p-4 rounded-xl cursor-pointer border transition-all duration-300 ${
                  selectedClaimId === claim.id 
                    ? "bg-cyan-500/10 border-cyan-500/50" 
                    : "bg-white/5 border-transparent hover:border-white/10"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-black/40 rounded uppercase tracking-tighter">
                    {claim.orderId}
                  </span>
                  {claim.status === "pending" && <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
                  {claim.status === "active" && <span className="w-2 h-2 bg-cyan-400 rounded-full" />}
                </div>
                <h3 className="text-sm font-bold truncate">{claim.item}</h3>
                <p className="text-[10px] text-white/40 mt-1">Rp {claim.price.toLocaleString('id-ID')}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Workspace */}
        <section className="flex-1 flex flex-col bg-black/20">
          {selectedClaim ? (
            <>
              {/* Workspace Header */}
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">{selectedClaim.item}</h2>
                  <p className="text-xs text-white/40">Order ID: {selectedClaim.orderId} • Klaim Terdeteksi Gemini</p>
                </div>
                {selectedClaim.status === "pending" && (
                  <button 
                    onClick={() => handleClaimSession(selectedClaim.id)}
                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                  >
                    Ambil Alih Percakapan
                  </button>
                )}
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Details */}
                <div className="w-1/2 p-6 overflow-y-auto border-r border-white/5 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Detail Analisis Gemini</h3>
                    <div className="p-4 admin-card space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                          <CheckCircle className="text-emerald-500 w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase">Damage Detected</p>
                          <p className="text-sm font-bold">{selectedClaim.analysis.damageType || "Fisik/Pecah"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                          <ClipboardCheck className="text-blue-500 w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase">Confidence Score</p>
                          <p className="text-sm font-bold">{(selectedClaim.analysis.confidence * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-[10px] text-white/40 uppercase mb-1">Alasan Review Manual</p>
                        <div className="flex gap-2 items-start text-amber-400">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <p className="text-xs leading-relaxed italic">{selectedClaim.reason}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Bukti Foto</h3>
                    <div className="aspect-video bg-white/5 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden">
                       <img 
                        src={selectedClaim.imageUrl || "/hero.png"} 
                        alt="Evidence" 
                        className="w-full h-full object-contain transition-all cursor-zoom-in" 
                       />
                    </div>
                  </div>
                </div>

                {/* Chat Panel */}
                <div className="w-1/2 flex flex-col">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
                    {selectedClaim.status === "pending" ? (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                          <MessageSquare className="w-8 h-8" />
                        </div>
                        <p className="text-sm max-w-[200px]">Silakan klik "Ambil Alih" untuk mulai berbicara dengan pengguna.</p>
                      </div>
                    ) : (
                      <>
                        {selectedClaim.messages.map(msg => (
                          <div key={msg.id} className={`flex ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                              msg.role === 'agent' ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-white/5 text-white/80 rounded-tl-none border border-white/10'
                            }`}>
                              {msg.imageUrl && (
                                <img src={msg.imageUrl} alt="Attachment" className="rounded-lg mb-2 max-h-48 w-auto object-contain cursor-zoom-in" />
                              )}
                              {msg.content}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {selectedClaim.status === "active" && (
                    <div className="p-4 border-t border-white/5 bg-black/20">
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendMessage();
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
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 opacity-20">
              <ClipboardCheck className="w-24 h-24" />
              <div>
                <h3 className="text-2xl font-bold">Workspace Kosong</h3>
                <p className="text-sm">Pilih klaim dari daftar di samping untuk memulai peninjauan.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
