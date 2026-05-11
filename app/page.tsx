"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Package, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  UploadCloud,
  ShieldCheck,
  Zap
} from "lucide-react";
import { evaluateClaim } from "@/lib/policy-engine";
import { io } from "socket.io-client";

type Message = {
  id: string | number;
  role: "ai" | "user" | "agent";
  content: string;
  type?: "text" | "upload" | "analysis" | "result";
  data?: any;
  imageUrl?: string;
  timestamp?: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "ai",
      content: "Halo! Saya SinergiVisi AI. Ada yang bisa saya bantu hari ini? Anda bisa bertanya tentang produk, pengiriman, atau melaporkan kendala pada pesanan Anda.",
      type: "text",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [step, setStep] = useState<"chat" | "order_id" | "upload" | "analyzing" | "result">("chat");
  const [chatStatus, setChatStatus] = useState<"ai" | "waiting" | "human">("ai");
  const [isTyping, setIsTyping] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  // Session ID unik per pelanggan — tersimpan di localStorage
  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "ssr-session";
    let id = localStorage.getItem("chat_session_id");
    if (!id) {
      id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("chat_session_id", id);
    }
    return id;
  });

  const handleNewChat = () => {
    localStorage.removeItem("chat_session_id");
    window.location.reload();
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    // Connect to WebSocket Server
    const socket = io("http://localhost:3001", {
      transports: ["websocket"]
    });
    socketRef.current = socket;

    // Bergabung ke room unik milik pelanggan ini
    socket.emit("join_room", { roomId: sessionId });

    socket.on("new_message", (msg: any) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.role === "agent") setChatStatus("human");
      
      if (msg.role === "ai") {
        setIsTyping(false);
        // Gunakan field 'intent' yang dikirim server (tag sudah dihapus dari content)
        if (msg.intent === "request_photo") {
          // Coba ambil orderId dari metadata message atau dari history pesan sebelumnya
          const orderMatch = msg.orderId || 
            (messages.concat(msg).reverse().map((m: any) => m.content?.match?.(/ORD-[A-Z0-9]+/i)?.[0]).find(Boolean));
          
          if (orderMatch) {
            // orderId valid — tampilkan form upload
            setCurrentOrder((prev: any) => ({ ...prev, id: orderMatch }));
            setStep("upload");
            if (socketRef.current) {
              socketRef.current.emit("join_room", { roomId: orderMatch });
            }
          } else {
            // orderId tidak ditemukan — jangan tampilkan form upload, minta customer konfirmasi
            console.warn("[WARN] intent=request_photo tapi orderId tidak ditemukan");
            // Step tetap di "chat", customer harus masukkan nomor order dulu
          }
        }
      }
    });

    socket.on("mode_update", ({ mode }: { mode: any }) => {
      if (mode === "human") setChatStatus("human");
    });

    socket.on("load_history", (history: Message[]) => {
      if (history.length > 0) {
        setMessages(history);
        // Restore currentOrder dari history jika ada order ID yang tersebut
        const allContent = history.map(m => m.content || "").join(" ");
        const orderMatch = allContent.match(/ORD-[A-Z0-9]+/gi);
        if (orderMatch && orderMatch.length > 0) {
          const lastOrderId = orderMatch[orderMatch.length - 1];
          setCurrentOrder((prev: any) => prev?.id ? prev : { id: lastOrderId });
        }
      }
    });

    // Saat admin mengarsipkan chat ini — reset sesi customer
    socket.on("chat_archived", () => {
      localStorage.removeItem("chat_session_id");
      window.location.reload();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const addMessage = (role: Message["role"], content: string, type: Message["type"] = "text", data?: any, imageUrl?: string) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      type,
      data,
      imageUrl,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !socketRef.current) return;

    const userText = inputValue.trim();
    const roomId = currentOrder ? currentOrder.id : sessionId;

    socketRef.current.emit("send_message", {
      roomId,
      content: userText,
      role: "user"
    });

    setInputValue("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File upload triggered");
    if (!e.target.files?.[0]) {
      console.log("No file selected");
      return;
    }
    
    const file = e.target.files?.[0];
    console.log("File name:", file.name);

    const imageData = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    });
    setLastImage(imageData);

    addMessage("user", `Mengunggah foto: ${file.name}`, "upload", { fileName: file.name }, imageData);
    
    if (chatStatus !== "ai") {
      console.log("Human mode active. Sending photo to agent.");
      // Gunakan sessionId sebagai roomId utama — room tempat agent terhubung
      const activeRoomId = sessionId;
      if (socketRef.current) {
        socketRef.current.emit("agent_message", {
          roomId: activeRoomId,
          content: `[PHOTO UPLOADED]: ${file.name}`,
          imageUrl: imageData,
          role: "user"
        });
      }
      addMessage("ai", "Foto Anda telah diterima dan akan segera ditinjau oleh agen manusia kami.");
      setStep("chat");
      return;
    }

    setStep("analyzing");
    setIsTyping(true);
    addMessage("ai", "Sedang menganalisis bukti kerusakan dengan Gemini...", "analysis");
    
    try {
      const lastUserMsg = [...messages].reverse().find(m => m.role === "user" && m.type === "text")?.content || "";

      const formData = new FormData();
      formData.append("file", file);
      const orderId = currentOrder?.id || "";
      formData.append("orderId", orderId);
      formData.append("reason", lastUserMsg);

      // Guard: orderId harus ada sebelum analisis
      if (!orderId) {
        setMessages((prev) => prev.filter((m) => m.type !== "analysis"));
        addMessage("ai", "Mohon sebutkan nomor order Anda terlebih dahulu sebelum mengunggah foto bukti kerusakan. Contoh: ORD-XXXXXXXX");
        setStep("chat");
        setIsTyping(false);
        return;
      }

      const res = await fetch("http://localhost:3001/api/analyze", {
        method: "POST",
        body: formData,
      });

      const analysis = await res.json();

      // Handle error dari server
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.type !== "analysis"));
        addMessage("ai", `Gagal menganalisis: ${analysis.error || "Terjadi kesalahan. Silakan coba lagi."}`);
        setStep("upload");
        setIsTyping(false);
        return;
      }

      // Hapus pesan "Sedang menganalisis..." sebelum menampilkan hasil
      setMessages((prev) => prev.filter((m) => m.type !== "analysis"));

      // 1. VALIDASI PRODUK
      if (analysis.isProductMatch === false) {
        addMessage("ai", `Maaf, sistem mendeteksi bahwa foto tersebut bukan "${currentOrder.item}" (Terdeteksi: ${analysis.detectedItem || "Lainnya"}). Mohon unggah foto yang benar agar kami dapat memproses klaim Anda.`);
        setStep("upload"); 
        setIsTyping(false);
        return;
      }

      // 2. VALIDASI KONTEKS KERUSAKAN
      if (analysis.isDamageMatch === false) {
        addMessage("ai", `Maaf, kerusakan yang terdeteksi di foto (${analysis.detectedDamage || "Tidak Jelas"}) tidak sesuai dengan alasan Anda: "${lastUserMsg}". Mohon unggah foto bukti yang sesuai dengan komplain Anda.`);
        setStep("upload");
        setIsTyping(false);
        return;
      }

      const decision = evaluateClaim(analysis.isDamaged, analysis.confidence, currentOrder.price);

      if (decision.status === "approved") {
        addMessage("ai", `Analisis Selesai: ${analysis.description}. Karena nilai pesanan di bawah Rp 500.000, saya telah menyetujui refund Anda secara otomatis!`, "result", { status: "approved", amount: currentOrder.price });
        
        // Log Refund ke PostgreSQL
        fetch("http://localhost:3001/api/log-refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: currentOrder.id, amount: currentOrder.price })
        });

        // Simpan Claim Status ke PostgreSQL via WebSocket
        if (socketRef.current) {
          socketRef.current.emit("request_handoff", {
            roomId: currentOrder.id,
            claimData: {
              orderId: currentOrder.id,
              item: currentOrder.item,
              price: currentOrder.price,
              status: "approved",
              analysis: analysis,
              reason: "AI Auto-Approved"
            }
          });
        }
      } else {
        addMessage("ai", `Analisis Selesai: ${analysis.description}. ${decision.reason}`, "result", { status: "pending", amount: currentOrder.price });
        
        // Trigger Human Handoff via WebSocket
        setChatStatus("waiting");
        if (socketRef.current) {
          socketRef.current.emit("request_handoff", {
            roomId: currentOrder.id,
            claimData: {
              orderId: currentOrder.id,
              item: currentOrder.item,
              price: currentOrder.price,
              analysis: analysis,
              reason: decision.reason,
              imageUrl: imageData
            }
          });
        }
      }
      setStep("chat"); // Kembalikan ke mode chat teks setelah analisis
    } catch (error) {
      addMessage("ai", "Maaf, terjadi kesalahan saat menganalisis gambar. Silakan coba lagi nanti.");
      setStep("chat");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 md:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Zap className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold premium-gradient-text">SinergiVisi AI</h1>
            <p className="text-xs text-white/50">Autonomous Support Agent</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs text-white/40">
          {chatStatus === "waiting" && (
            <div className="status-waiting-badge">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              Menghubungkan Agen...
            </div>
          )}
          {chatStatus === "human" && (
            <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 font-bold">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              Mode: Manusia
            </div>
          )}
          <div className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure</div>
          <div className="flex items-center gap-1"><Package className="w-4 h-4 text-blue-500" /> Tracked</div>
          <button
            onClick={handleNewChat}
            title="Mulai sesi chat baru"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-white/50 hover:text-white"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Chat Baru
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <div className="flex-1 glass-card overflow-hidden flex flex-col mb-6">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
        >
          {messages.length === 1 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-10 text-center space-y-6"
            >
              <div className="relative w-64 h-64 rounded-full overflow-hidden border-2 border-violet-500/30 shadow-[0_0_50px_rgba(139,92,246,0.2)]">
                <img src="/hero.png" alt="SinergiVisi AI Hero" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Validasi Instan. Solusi Otonom.</h2>
                <p className="text-sm text-white/50 max-w-xs">Unggah bukti foto piring, gelas, atau peralatan rumah tangga Anda yang rusak untuk klaim kilat.</p>
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] ${
                  msg.role === "user" ? "chat-bubble-user" : 
                  msg.role === "agent" ? "chat-bubble-agent" : 
                  "chat-bubble-ai"
                }`}>
                  {(!msg.type || msg.type === "text") && <p className="text-sm leading-relaxed">{msg.content}</p>}
                  
                  {msg.type === "upload" && (
                    <div className="space-y-2">
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="Uploaded" className="rounded-lg max-h-40 w-auto object-contain mb-2" />
                      )}
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg">
                          <Camera className="w-5 h-5 text-violet-400" />
                        </div>
                        <p className="text-sm italic">{msg.data?.fileName || "File Terlampir"}</p>
                      </div>
                    </div>
                  )}

                  {msg.type === "analysis" && (
                    <div className="flex items-center gap-3 py-2">
                      <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                      <p className="text-sm font-medium">{msg.content}</p>
                    </div>
                  )}

                  {msg.type === "result" && (
                    <div className="space-y-3">
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${msg.data.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {msg.data.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="text-sm font-bold uppercase tracking-wider">
                          {msg.data.status === 'approved' ? 'Disetujui Otomatis' : 'Menunggu Review'}
                        </span>
                      </div>
                      <p className="text-sm">{msg.content}</p>
                      <div className="text-xs p-2 bg-black/20 rounded border border-white/5">
                        <p>Nilai Refund: <span className="font-mono text-cyan-400">Rp {msg.data.amount.toLocaleString('id-ID')}</span></p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="chat-bubble-ai px-4 py-2 flex gap-1">
                <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-3"
          >
            {step === "upload" ? (
              <div className="flex-1 flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded-xl cursor-pointer transition-all duration-300 group">
                  <UploadCloud className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Klik untuk Unggah Foto Bukti</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
                <button 
                  type="button"
                  onClick={() => setStep("chat")}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/50"
                  title="Batal"
                >
                  <AlertCircle className="w-5 h-5 rotate-45" />
                </button>
              </div>
            ) : (
              <>
                <button 
                  type="button"
                  onClick={() => setStep("upload")}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-violet-400 transition-colors"
                  title="Unggah Foto"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    chatStatus === "waiting" || chatStatus === "human" ? "Ketik pesan untuk agen..." :
                    step === "order_id" ? "Masukkan Nomor Order (SV-XXXX)..." : 
                    "Ketik pesan..."
                  }
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                  disabled={step === "analyzing"}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || step === "analyzing"}
                  className="p-3 bg-violet-600 hover:bg-violet-500 disabled:bg-white/5 disabled:text-white/20 rounded-xl glow-button"
                >
                  <Send className="w-5 h-5" />
                </button>
              </>
            )}
          </form>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="text-center">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.2em]">
          Powered by Gemini 3 Flash • SinergiVisi AI Autonomous System
        </p>
      </footer>
    </div>
  );
}
