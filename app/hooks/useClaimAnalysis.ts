import { useState } from "react";
import { Message, ChatStep } from "../types/chat";
import { evaluateClaim } from "@/lib/policy-engine";
import { API_BASE_URL } from "@/lib/api-config";

interface AnalysisParams {
  sessionId: string;
  chatStatus: string;
  socket: any;
  addMessage: (msg: Message) => void;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  setIsTyping: (val: boolean) => void;
  setChatStatus: (status: any) => void;
  setOrderItems: (items: any[]) => void;
}

export function useClaimAnalysis({
  sessionId,
  chatStatus,
  socket,
  addMessage,
  setMessages,
  setIsTyping,
  setChatStatus,
  setOrderItems
}: AnalysisParams) {
  const [step, setStep] = useState<ChatStep>("chat");
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);

  const handleFileUpload = async (file: File, userContext: string) => {
    const imageData = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    });
    setLastImage(imageData);

    const uploadMsg: Message = {
      id: `up-${Date.now()}`,
      role: "user",
      content: `Mengunggah foto: ${file.name}`,
      type: "upload",
      data: { fileName: file.name },
      imageUrl: imageData
    };
    addMessage(uploadMsg);

    if (chatStatus !== "ai") {
      if (socket) {
        socket.emit("agent_message", {
          roomId: sessionId,
          content: `[PHOTO UPLOADED]: ${file.name}`,
          imageUrl: imageData,
          role: "user"
        });
      }
      addMessage({
        id: `ai-${Date.now()}`,
        role: "ai",
        content: "Foto Anda telah diterima dan akan segera ditinjau oleh agen manusia kami."
      });
      setStep("chat");
      return;
    }

    setStep("analyzing");
    setIsTyping(true);
    addMessage({
      id: `ai-anal-${Date.now()}`,
      role: "ai",
      content: "Sedang menganalisis bukti kerusakan dengan Gemini...",
      type: "analysis"
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const orderId = currentOrder?.id || "";
      formData.append("orderId", orderId);
      formData.append("reason", userContext);

      if (!orderId) {
        setMessages((prev) => prev.filter((m) => m.type !== "analysis"));
        addMessage({
          id: `ai-err-${Date.now()}`,
          role: "ai",
          content: "Mohon sebutkan nomor order Anda terlebih dahulu sebelum mengunggah foto bukti kerusakan. Contoh: ORD-XXXXXXXX"
        });
        setStep("chat");
        setIsTyping(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      const analysis = await res.json();
      setMessages((prev) => prev.filter((m) => m.type !== "analysis"));

      if (!res.ok) {
        addMessage({
          id: `ai-err-${Date.now()}`,
          role: "ai",
          content: `Gagal menganalisis: ${analysis.error || "Terjadi kesalahan."}`
        });
        setStep("upload");
        setIsTyping(false);
        return;
      }

      // 1. VALIDASI PRODUK
      if (analysis.isProductMatch === false) {
        addMessage({
          id: `ai-fail-${Date.now()}`,
          role: "ai",
          content: `Maaf, sistem mendeteksi bahwa foto tersebut bukan "${currentOrder.item}" (Terdeteksi: ${analysis.detectedItem || "Lainnya"}). Mohon unggah foto yang benar.`
        });
        setStep("upload"); 
        setIsTyping(false);
        return;
      }

      // 2. VALIDASI KONTEKS KERUSAKAN
      if (analysis.isDamageMatch === false) {
        addMessage({
          id: `ai-fail-${Date.now()}`,
          role: "ai",
          content: `Maaf, kerusakan yang terdeteksi (${analysis.detectedDamage || "Tidak Jelas"}) tidak sesuai dengan alasan Anda: "${userContext}".`
        });
        setStep("upload");
        setIsTyping(false);
        return;
      }

      const refundAmount = parseFloat(analysis.totalPrice) || parseFloat(currentOrder?.price) || 0;
      const decision = evaluateClaim(analysis.isDamaged, analysis.confidence, refundAmount);

      if (decision.status === "approved") {
        addMessage({
          id: `ai-res-${Date.now()}`,
          role: "ai",
          content: `Analisis Selesai: ${analysis.description}. Refund disetujui otomatis!`,
          type: "result",
          data: { status: "approved", amount: refundAmount }
        });
        
        fetch(`${API_BASE_URL}/api/log-refund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: currentOrder.id, amount: refundAmount, reason: analysis.description })
        });

        if (socket) {
          socket.emit("request_handoff", {
            roomId: sessionId,
            claimData: {
              orderId: currentOrder.id,
              item: currentOrder.item,
              price: refundAmount,
              status: "approved",
              analysis: analysis,
              reason: "AI Auto-Approved",
              imageUrl: analysis.imageUrl || imageData
            }
          });
        }
      } else {
        addMessage({
          id: `ai-res-${Date.now()}`,
          role: "ai",
          content: `Analisis Selesai: ${analysis.description}. ${decision.reason}`,
          type: "result",
          data: { status: "pending", amount: refundAmount }
        });
        
        setChatStatus("waiting");
        if (socket) {
          socket.emit("request_handoff", {
            roomId: sessionId,
            claimData: {
              orderId: currentOrder.id,
              item: currentOrder.item,
              price: refundAmount,
              status: "pending",
              analysis: analysis,
              reason: decision.reason,
              imageUrl: analysis.imageUrl || imageData
            }
          });
        }
      }
      setOrderItems([]);
      setStep("chat");
    } catch (error) {
      addMessage({ id: `ai-err-${Date.now()}`, role: "ai", content: "Terjadi kesalahan saat menganalisis gambar." });
      setStep("chat");
    } finally {
      setIsTyping(false);
    }
  };

  return {
    step,
    setStep,
    currentOrder,
    setCurrentOrder,
    lastImage,
    handleFileUpload
  };
}
