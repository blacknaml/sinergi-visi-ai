"use client";
import { useState, useEffect } from "react";
import { Shield, AlertTriangle, CheckCircle, Activity, Clock, Loader2, RefreshCw } from "lucide-react";

type Log = { id: number; agent_email: string; event_type: string; description: string; ip_address: string; success: boolean; created_at: string; };
type Stats = { total: number; failed: number; today: number; };

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN_SUCCESS: { label: "Login Berhasil", color: "text-emerald-400 bg-emerald-500/10" },
  LOGIN_FAILED:  { label: "Login Gagal",    color: "text-red-400 bg-red-500/10" },
  LOGIN_BLOCKED: { label: "Akun Diblokir",  color: "text-orange-400 bg-orange-500/10" },
  AGENT_CREATED: { label: "Agen Dibuat",    color: "text-cyan-400 bg-cyan-500/10" },
  AGENT_UPDATED: { label: "Agen Diperbarui",color: "text-blue-400 bg-blue-500/10" },
  AGENT_DELETED: { label: "Agen Dihapus",   color: "text-red-400 bg-red-500/10" },
};

export default function SecurityPage({ token }: { token: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = { "Authorization": `Bearer ${token}` };

  const fetchData = async () => {
    setLoading(true);
    const [logsRes, statsRes] = await Promise.all([
      fetch("http://localhost:3001/api/security/logs", { headers }),
      fetch("http://localhost:3001/api/security/stats", { headers })
    ]);
    setLogs(await logsRes.json());
    setStats(await statsRes.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Log Keamanan</h2>
          <p className="text-white/40 text-sm mt-1">Audit trail aktivitas agen dan sistem</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm rounded-xl transition-all">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Event", value: stats.total, icon: Activity, color: "text-cyan-400", bg: "bg-cyan-500/10" },
            { label: "Login Gagal", value: stats.failed, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
            { label: "Event Hari Ini", value: stats.today, icon: Clock, color: "text-violet-400", bg: "bg-violet-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex items-center gap-4">
              <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-white/40">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                {["Waktu", "Email", "Event", "Keterangan", "IP", "Status"].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-bold text-white/40 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-white/30"><Shield className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Belum ada log aktivitas</p></td></tr>
              ) : logs.map(log => {
                const ev = EVENT_LABELS[log.event_type] || { label: log.event_type, color: "text-white/60 bg-white/10" };
                return (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-xs text-white/40 whitespace-nowrap">{new Date(log.created_at).toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3 text-xs font-mono text-white/70">{log.agent_email}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-1 rounded-full font-bold ${ev.color}`}>{ev.label}</span></td>
                    <td className="px-5 py-3 text-xs text-white/60 max-w-[180px] truncate">{log.description}</td>
                    <td className="px-5 py-3 text-xs font-mono text-white/40">{log.ip_address}</td>
                    <td className="px-5 py-3">
                      {log.success
                        ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                        : <AlertTriangle className="w-4 h-4 text-red-400" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
