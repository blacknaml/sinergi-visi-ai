"use client";

import { motion } from "framer-motion";
import { Inbox, Archive, Clock, CheckCircle } from "lucide-react";
import { Claim } from "../types";

interface ClaimListProps {
  claims: Claim[];
  selectedClaimId: string | null;
  setSelectedClaimId: (id: string | null) => void;
  showArchived: boolean;
  setShowArchived: (val: boolean) => void;
  setClaims: (claims: Claim[]) => void;
  socket: any;
}

export default function ClaimList({ 
  claims, 
  selectedClaimId, 
  setSelectedClaimId, 
  showArchived, 
  setShowArchived,
  setClaims,
  socket
}: ClaimListProps) {
  const filteredClaims = claims.filter(c => showArchived ? c.archived : !c.archived);

  return (
    <section className="w-80 border-r flex flex-col" style={{ borderColor: 'var(--card-border)' }}>
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--card-border)' }}>
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          {showArchived ? "Arsip Klaim" : "Antrean Klaim"}
        </h2>
        <div className="flex items-center gap-2">
          {!showArchived && filteredClaims.length > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
              {filteredClaims.length}
            </span>
          )}
          <button
            onClick={() => { 
              const nextValue = !showArchived;
              setShowArchived(nextValue); 
              setClaims([]); 
              setSelectedClaimId(null);
              if (!nextValue && socket) {
                socket.emit("join_admin");
              }
            }}
            title={showArchived ? "Lihat Aktif" : "Lihat Arsip"}
            className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(128,128,128,0.1)] hover:text-[var(--foreground)]"
            style={{ color: 'var(--muted)' }}
          >
            {showArchived ? <Inbox className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredClaims.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center" style={{ color: 'var(--muted)' }}>
            {showArchived ? <Archive className="w-8 h-8 mb-2 opacity-50" /> : <Clock className="w-8 h-8 mb-2 opacity-50" />}
            <p className="text-xs font-medium">{showArchived ? "Tidak ada klaim diarsipkan" : "Tidak ada klaim aktif"}</p>
          </div>
        )}
        {filteredClaims.map(claim => (
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
            style={{ 
              backgroundColor: selectedClaimId === claim.id ? '' : 'var(--input-bg)',
              borderColor: selectedClaimId === claim.id ? '' : 'var(--card-border)'
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-black/40 rounded uppercase tracking-tighter text-white">
                {claim.orderId}
              </span>
              {claim.status === "pending" && <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
              {claim.status === "active" && <span className="w-2 h-2 bg-cyan-400 rounded-full" />}
              {claim.status === "complete" && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
            <h3 className="text-sm font-bold truncate">{claim.item}</h3>
            <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>Rp {Number(claim.price).toLocaleString('id-ID')}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
