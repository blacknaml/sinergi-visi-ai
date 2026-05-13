"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  ClipboardCheck, 
  LayoutDashboard,
  ShieldAlert,
  CheckCircle,
  Clock,
  AlertTriangle,
  LogOut,
  ShieldCheck,
  Loader2
} from "lucide-react";

import LoginPage from "./components/LoginPage";
import ClaimList from "./components/ClaimList";
import WorkspaceHeader from "./components/WorkspaceHeader";
import ClaimDetails from "./components/ClaimDetails";
import ChatPanel from "./components/ChatPanel";
import ImagePreviewModal from "./components/ImagePreviewModal";
import AgentsPage from "./components/AgentsPage";
import SecurityPage from "./components/SecurityPage";

import { useClaims } from "./hooks/useClaims";
import { Agent } from "./types";

export default function AdminDashboard() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeMenu, setActiveMenu] = useState<"dashboard" | "agents" | "security">("dashboard");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const {
    claims,
    selectedClaim,
    selectedClaimId,
    setSelectedClaimId,
    showArchived,
    setShowArchived,
    isArchiving,
    isUpdatingOrder,
    handleArchive,
    handleDecision,
    handleUpdateOrderId,
    handleSendMessage,
    handleTakeOver,
    setClaims,
    setClaimOrderDetails,
    socket
  } = useClaims(authToken);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("agent_token");
    const agentData = localStorage.getItem("agent_data");

    if (token && agentData) {
      fetch("http://localhost:3001/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.agent) {
            setAuthToken(token);
            setAgent(JSON.parse(agentData));
          } else {
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
    if (socket) socket.disconnect();
  };

  // Fetch Order Details
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!selectedClaimId || !selectedClaim || !selectedClaim.orderId || selectedClaim.orderDetails) return;
      if (selectedClaim.orderId.toLowerCase() === "unknown" || selectedClaim.orderId === "") return;
      
      try {
        const res = await fetch(`http://localhost:3001/api/orders/${selectedClaim.orderId}`, {
          headers: { "Authorization": `Bearer ${authToken}` }
        });
        if (res.ok) {
          const orderData = await res.json();
          setClaimOrderDetails(selectedClaimId, orderData);
        }
      } catch (err) {
        console.error("Failed to fetch order details:", err);
      }
    };

    fetchOrderDetails();
  }, [selectedClaimId, selectedClaim?.orderId, authToken]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!authToken) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
      {/* Sidebar Navigation */}
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
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {activeMenu === "agents" && <AgentsPage token={authToken!} currentAgentId={agent!.id} />}
        {activeMenu === "security" && <SecurityPage token={authToken!} />}
        {activeMenu === "dashboard" && (
          <>
            <ClaimList 
              claims={claims}
              selectedClaimId={selectedClaimId}
              setSelectedClaimId={setSelectedClaimId}
              showArchived={showArchived}
              setShowArchived={setShowArchived}
              setClaims={setClaims}
              socket={socket}
            />

            <section className="flex-1 flex flex-col bg-black/20">
              {selectedClaim ? (
                <>
                  <WorkspaceHeader 
                    claim={selectedClaim}
                    showArchived={showArchived}
                    isArchiving={isArchiving}
                    isUpdatingOrder={isUpdatingOrder}
                    handleArchive={handleArchive}
                    handleUpdateOrderId={handleUpdateOrderId}
                    handleTakeOver={handleTakeOver}
                  />

                  {/* Decision Panel */}
                  {(selectedClaim.status === "pending" || selectedClaim.status === "active") && (
                    <div className="mx-6 mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between shadow-lg shadow-amber-500/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <Clock className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-amber-200">Menunggu Inspeksi Agen</p>
                          <p className="text-xs text-amber-200/60 italic">Silakan tinjau bukti foto dan putuskan refund.</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecision(selectedClaim.id, "rejected")}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold rounded-lg transition-all"
                        >
                          Tolak Refund
                        </button>
                        <button
                          onClick={() => handleDecision(selectedClaim.id, "approved")}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/20"
                        >
                          Setujui Refund
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Decision Result */}
                  {selectedClaim.decision && selectedClaim.decision !== "pending" && (
                    <div className={`mx-6 mt-4 p-4 border rounded-2xl flex items-center gap-3 ${
                      selectedClaim.decision === 'approved' 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                    }`}>
                      {selectedClaim.decision === 'approved' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      <p className="text-sm font-bold">
                        Keputusan: {selectedClaim.decision === 'approved' ? "REFUND DISETUJUI" : "REFUND DITOLAK"}
                      </p>
                    </div>
                  )}

                  <div className="flex-1 flex overflow-hidden">
                    <ClaimDetails claim={selectedClaim} setPreviewImage={setPreviewImage} />
                    <ChatPanel claim={selectedClaim} handleSendMessage={handleSendMessage} />
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
          </>
        )}
      </main>

      <ImagePreviewModal previewImage={previewImage} setPreviewImage={setPreviewImage} />
    </div>
  );
}
