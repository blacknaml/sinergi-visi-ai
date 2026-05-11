"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Trash2, ToggleLeft, ToggleRight, X, Loader2 } from "lucide-react";

type Agent = { id: number; name: string; email: string; role: string; is_active: boolean; created_at: string; };

export default function AgentsPage({ token, currentAgentId }: { token: string; currentAgentId: number }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "agent" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchAgents = async () => {
    setLoading(true);
    const res = await fetch("http://localhost:3001/api/agents", { headers });
    const data = await res.json();
    setAgents(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchAgents(); }, []);

  const handleToggle = async (agent: Agent) => {
    await fetch(`http://localhost:3001/api/agents/${agent.id}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ is_active: !agent.is_active })
    });
    fetchAgents();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus agen ini?")) return;
    await fetch(`http://localhost:3001/api/agents/${id}`, { method: "DELETE", headers });
    fetchAgents();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSubmitting(true);
    const res = await fetch("http://localhost:3001/api/agents", {
      method: "POST", headers, body: JSON.stringify(form)
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); } else { setShowModal(false); setForm({ name: "", email: "", password: "", role: "agent" }); fetchAgents(); }
    setSubmitting(false);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Manajemen Agen</h2>
          <p className="text-white/40 text-sm mt-1">Kelola akun agen customer support</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-xl transition-all">
          <UserPlus className="w-4 h-4" /> Tambah Agen
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                {["Nama", "Email", "Role", "Status", "Bergabung", "Aksi"].map(h => (
                  <th key={h} className="text-left px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-lg flex items-center justify-center text-xs font-bold">{agent.name.charAt(0)}</div>
                      <span className="text-sm font-semibold">{agent.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">{agent.email}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${agent.role === "admin" ? "bg-violet-500/20 text-violet-400" : "bg-cyan-500/20 text-cyan-400"}`}>{agent.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${agent.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{agent.is_active ? "Aktif" : "Nonaktif"}</span>
                  </td>
                  <td className="px-6 py-4 text-xs text-white/40">{new Date(agent.created_at).toLocaleDateString("id-ID")}</td>
                  <td className="px-6 py-4">
                    {agent.id !== currentAgentId && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggle(agent)} title={agent.is_active ? "Nonaktifkan" : "Aktifkan"} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white">
                          {agent.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button onClick={() => handleDelete(agent.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-white/30 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Agent Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Tambah Agen Baru</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                {[["Nama Lengkap", "name", "text", "John Doe"], ["Email", "email", "email", "agen@sinergivisi.ai"], ["Password", "password", "password", "Min. 8 karakter"]].map(([label, key, type, ph]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-2">{label}</label>
                    <input type={type} placeholder={ph} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-2">Role</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50">
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={submitting} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {submitting ? "Menyimpan..." : "Tambah Agen"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
