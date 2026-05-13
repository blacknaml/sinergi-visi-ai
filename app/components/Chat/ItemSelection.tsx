"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Package } from "lucide-react";
import { OrderItem } from "../../types/chat";

interface ItemSelectionProps {
  orderItems: OrderItem[];
  onSelectItem: (item: OrderItem) => void;
  onClose: () => void;
}

export default function ItemSelection({ orderItems, onSelectItem, onClose }: ItemSelectionProps) {
  if (orderItems.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="px-4 pt-3 pb-2 border-t border-white/5"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Pilih item yang bermasalah:</p>
          <button onClick={onClose} className="text-[10px] text-white/20 hover:text-white/50 transition-colors">✕ tutup</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {orderItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onSelectItem(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/40 rounded-full transition-all duration-200 text-violet-300 hover:text-white hover:border-violet-400/60 group"
            >
              <Package className="w-3 h-3 opacity-60 group-hover:opacity-100" />
              {item.name}
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
