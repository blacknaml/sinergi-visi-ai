"use client";

import { CheckCircle, ClipboardCheck, AlertTriangle, ShoppingCart, Eye } from "lucide-react";
import { Claim } from "../types";
import { ECOM_STORAGE_BASE } from "../../../lib/api-config";

interface ClaimDetailsProps {
  claim: Claim;
  setPreviewImage: (url: string) => void;
}

export default function ClaimDetails({ claim, setPreviewImage }: ClaimDetailsProps) {
  return (
    <div className="w-1/2 p-6 overflow-y-auto border-r border-white/5 space-y-6">
      {/* Detail Analisis Gemini */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Detail Analisis Gemini</h3>
        <div className="p-4 admin-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-emerald-500 w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase">Damage Detected</p>
              <p className="text-sm font-bold">{claim.analysis?.damageType || claim.analysis?.detectedDamage || "Fisik/Pecah"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="text-blue-500 w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase">Confidence Score</p>
              <p className="text-sm font-bold">{((claim.analysis?.confidence || 0) * 100).toFixed(1)}%</p>
            </div>
          </div>
          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] text-white/40 uppercase mb-1">Alasan Review Manual</p>
            <div className="flex gap-2 items-start text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed italic">{claim.reason}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bukti Foto */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Bukti Foto</h3>
        <div 
          onClick={() => setPreviewImage(claim.imageUrl || "/hero.png")}
          className="aspect-video bg-white/5 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden cursor-zoom-in group"
        >
          <img 
            src={claim.imageUrl || "/hero.png"} 
            alt="Evidence" 
            className="w-full h-full object-contain transition-all group-hover:scale-105" 
          />
        </div>
      </div>

      {/* Detail Pembelian */}
      {claim.orderDetails && (
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Detail Pembelian</h3>
          </div>
          <div className="space-y-3">
            {claim.orderDetails.items?.map((item: any, idx: number) => {
              const itemImg = `${ECOM_STORAGE_BASE}${item.product.image_path}`;
              return (
                <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 flex gap-3 items-center group/item hover:bg-white/10 transition-colors">
                  <div 
                    onClick={() => setPreviewImage(itemImg)}
                    className="w-12 h-12 bg-black/40 rounded-lg overflow-hidden border border-white/10 shrink-0 cursor-zoom-in relative"
                  >
                    <img 
                      src={itemImg} 
                      alt={item.product.name}
                      className="w-full h-full object-cover group-hover/item:scale-110 transition-transform"
                    />
                    <div className="absolute inset-0 bg-cyan-500/20 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{item.product.name}</p>
                    <p className="text-[10px] text-white/40">Rp {Number(item.price).toLocaleString('id-ID')} x {item.quantity}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
