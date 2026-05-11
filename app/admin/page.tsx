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
  CheckCircle,
  Clock,
  AlertTriangle,
  LogOut,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2
} from "lucide-react";
import { io } from "socket.io-client";
import AgentsPage from "./components/AgentsPage";
import SecurityPage from "./components/SecurityPage";

type Claim = {
  id: string;
  orderId: string;
  item: string;
  price: number;
  reason: string;
  analysis: any;
  status: "pending" | "active" | "completed";
  messages: { role: "user" | "agent" | "ai"; content: string; id: string | number; imageUrl?: string }[];
  imageUrl?: string;
};

type Agent = {
  id: number;
  name: string;
  email: string;
  role: string;
};

// ============================================================
// LOGIN PAGE COMPONENT
// ============================================================
function LoginPage({ onLoginSuccess }: { onLoginSuccess: (token: string, agent: Agent) => void }) {
  const [email, setEmail] = useState("admin@sinergivisi.ai");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login gagal. Coba lagi.");
      } else {
        localStorage.setItem("agent_token", data.token);
        localStorage.setItem("agent_data", JSON.stringify(data.agent));
        onLoginSuccess(data.token, data.agent);
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">SinergiVisi</h1>
            <p className="text-white/40 text-sm mt-1">Agent Dashboard — Masuk untuk Melanjutkan</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sinergivisi.ai"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/60 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Masuk ke Dashboard
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-white/20 mt-6">
            Hanya agen terotorisasi yang dapat mengakses dashboard ini.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================
// MAIN ADMIN DASHBOARD
// ============================================================
export default function AdminDashboard() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeMenu, setActiveMenu] = useState<"dashboard" | "agents" | "security">("dashboard");

  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState("");
  const socketRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedClaim = claims.find(c => c.id === selectedClaimId);

  // Cek sesi yang tersimpan saat halaman dimuat
  useEffect(() => {
    const token = localStorage.getItem("agent_token");
    const agentData = localStorage.getItem("agent_data");

    if (token && agentData) {
      // Verifikasi token masih valid di server
      fetch("http://localhost:3001/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.agent) {
            setAuthToken(token);
            setAgent(JSON.parse(agentData));
          } else {
            // Token expired
            localStorage.removeItem("agent_token");
            localStorage.removeItem("agent_data");
          }
        })
        .catch(() => {
          localStorage.removeItem("agent_token");
          localStorage.removeItem("agent_data");
        })
        .finally(() => setIsCheckingAuth(false));
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const handleLoginSuccess = (token: string, agentData: Agent) => {
    setAuthToken(token);
    setAgent(agentData);
  };

  const handleLogout = () => {
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_data");
    setAuthToken(null);
    setAgent(null);
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  // Setup WebSocket setelah auth berhasil
  useEffect(() => {
    if (!authToken) return;

    const socket = io("http://localhost:3001", {
      transports: ["websocket"],
      auth: { token: authToken }
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

    socket.on("load_claims", (dbClaims: any[]) => {
      const mapped: Claim[] = dbClaims.map(c => ({
        id: c.id,
        orderId: c.orderId,
        item: c.item || `Order ${c.orderId}`,
        price: parseFloat(c.price) || 0,
        reason: c.analysis?.reason || "Menunggu review",
        analysis: c.analysis || { damageType: "Pending", confidence: 0 },
        status: c.status === "pending" ? "pending" : "active",
        messages: []
      }));
      setClaims(mapped);
    });

    socket.on("new_message", (msg: any) => {
      setClaims(prev => prev.map(c => {
        if (c.id === msg.room_id || c.id === msg.roomId) {
          if (c.messages.some(m => m.id === msg.id)) return c;
          return {
            ...c,
            messages: [...c.messages, { role: msg.role, content: msg.content, id: msg.id, imageUrl: msg.image_url || msg.imageUrl }],
            imageUrl: msg.image_url || msg.imageUrl || c.imageUrl
          };
        }
        return c;
      }));
    });

    socket.on("load_history", (history: any[]) => {
      setClaims(prev => prev.map(c => {
        if (history.length > 0 && history.some(h => h.room_id === c.id || h.roomId === c.id)) {
          const latestPhoto = [...history].reverse().find(h => h.image_url || h.imageUrl);
          return {
            ...c,
            messages: history.map(h => ({
              role: h.role,
              content: h.content,
              id: h.id,
              imageUrl: h.image_url || h.imageUrl
            })),
            imageUrl: latestPhoto?.image_url || latestPhoto?.imageUrl || c.imageUrl
          };
        }
        return c;
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [authToken]);

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
      content: message,
      role: "agent"
    });
    setAgentMessage("");
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  // Tampilkan halaman login jika belum auth
  if (!authToken) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // === DASHBOARD ===
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
          {[
            { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { key: "agents",    label: "Agents",    icon: Users },
            { key: "security",  label: "Security",  icon: ShieldAlert },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveMenu(key as any)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                activeMenu === key ? "bg-white/10 text-cyan-400" : "text-white/40 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>

        {/* Agent Profile */}
        <div className="mt-auto">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-lg flex items-center justify-center text-sm font-bold">
                {agent?.name?.charAt(0) || "A"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{agent?.name}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">{agent?.role}</p>
              </div>
            </div>
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {activeMenu === "agents" && <AgentsPage token={authToken!} currentAgentId={agent!.id} />}
        {activeMenu === "security" && <SecurityPage token={authToken!} />}
        {activeMenu === "dashboard" && (
          <>
          <section className="w-80 border-r border-white/5 flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">Antrean Klaim</h2>
            {claims.length > 0 && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">{claims.length}</span>
            )}
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
                <p className="text-[10px] text-white/40 mt-1">Rp {Number(claim.price).toLocaleString('id-ID')}</p>
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
                          <p className="text-sm font-bold">{selectedClaim.analysis?.damageType || selectedClaim.analysis?.detectedDamage || "Fisik/Pecah"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                          <ClipboardCheck className="text-blue-500 w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase">Confidence Score</p>
                          <p className="text-sm font-bold">{((selectedClaim.analysis?.confidence || 0) * 100).toFixed(1)}%</p>
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
      </> /* close activeMenu === "dashboard" */
      )}
      </main>
    </div>
  );
}
