"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gem,
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Loader2 
} from "lucide-react";
import { Agent } from "../types";
import { API_BASE_URL } from "../../../lib/api-config";

interface LoginPageProps {
  onLoginSuccess: (token: string, agent: Agent) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
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
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
    <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-500" style={{ backgroundColor: 'var(--background)' }}>
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#cda434]/5 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-[#94a3b8]/5 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="border rounded-3xl p-8 backdrop-blur-xl shadow-2xl" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg shadow-[#cda434]/20 mb-4 bg-white border border-[#cda434]/20 shrink-0">
              <img src="/logo.png" alt="Sinergi Visi Logo" className="w-full h-full object-cover scale-[1.4] origin-[50%_40%]" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">SinergiVisi</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Agent Dashboard — Masuk untuk Melanjutkan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sinergivisi.ai"
                required
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/60 transition-all"
                style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-cyan-500/60 transition-all"
                  style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--muted)' }}
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
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-[#cda434] to-[#d4af37] hover:from-[#b8932f] hover:to-[#be9d31] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-[#cda434]/20 flex items-center justify-center gap-2"
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

          <p className="text-center text-xs mt-6" style={{ color: 'var(--muted)', opacity: 0.5 }}>
            Hanya agen terotorisasi yang dapat mengakses dashboard ini.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
