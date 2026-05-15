"use client";

import { useState } from "react";
import { Pencil, Check, X, Loader2, ArchiveRestore, Archive } from "lucide-react";
import { Claim } from "../types";

interface WorkspaceHeaderProps {
  claim: Claim;
  showArchived: boolean;
  isArchiving: boolean;
  isUpdatingOrder: boolean;
  handleArchive: (id: string, archive: boolean) => void;
  handleUpdateOrderId: (id: string, orderId: string) => Promise<boolean>;
  handleTakeOver: (id: string) => void;
}

export default function WorkspaceHeader({
  claim,
  showArchived,
  isArchiving,
  isUpdatingOrder,
  handleArchive,
  handleUpdateOrderId,
  handleTakeOver
}: WorkspaceHeaderProps) {
  const [editingOrderId, setEditingOrderId] = useState(false);
  const [newOrderIdInput, setNewOrderIdInput] = useState("");

  return (
    <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--card-border)' }}>
      <div>
        <h2 className="text-xl font-bold">{claim.item}</h2>
        <div className="text-xs flex items-center gap-2 mt-1" style={{ color: 'var(--muted)' }}>
          <span>Order ID:</span>
          {editingOrderId ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newOrderIdInput}
                onChange={(e) => setNewOrderIdInput(e.target.value)}
                placeholder="ORD-XXXXXX"
                className="border rounded px-2 py-1 outline-none"
                style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }}
              />
              <button 
                onClick={async () => {
                  const success = await handleUpdateOrderId(claim.id, newOrderIdInput);
                  if (success) setEditingOrderId(false);
                }}
                disabled={isUpdatingOrder}
                className="p-1 bg-cyan-600 hover:bg-cyan-500 rounded text-white disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
              </button>
              <button 
                onClick={() => setEditingOrderId(false)}
                className="p-1 bg-red-600/50 hover:bg-red-500/50 rounded text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <span className="font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--input-bg)' }}>{claim.orderId}</span>
              {(claim.orderId.toLowerCase() === "unknown" || claim.orderId === "") && (
                <button 
                  onClick={() => {
                    setEditingOrderId(true);
                    setNewOrderIdInput("");
                  }}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  title="Update Nomor Order"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </>
          )}
          <span className="ml-2">• Klaim Terdeteksi Gemini</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {claim.status === "pending" && (
          <button 
            onClick={() => handleTakeOver(claim.id)}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
          >
            Ambil Alih
          </button>
        )}
        <button
          onClick={() => handleArchive(claim.id, !showArchived)}
          disabled={isArchiving}
          title={showArchived ? "Pulihkan dari arsip" : "Arsipkan klaim ini"}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${
            showArchived
              ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
              : "transition-colors hover:text-[var(--foreground)] border"
          }`}
          style={{ 
            backgroundColor: showArchived ? '' : 'var(--input-bg)',
            borderColor: showArchived ? '' : 'var(--card-border)',
            color: showArchived ? '' : 'var(--muted)'
          }}
        >
          {isArchiving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : showArchived ? (
            <ArchiveRestore className="w-4 h-4" />
          ) : (
            <Archive className="w-4 h-4" />
          )}
          {showArchived ? "Pulihkan" : "Arsipkan"}
        </button>
      </div>
    </div>
  );
}
