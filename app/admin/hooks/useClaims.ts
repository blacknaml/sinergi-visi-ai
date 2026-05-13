import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Claim, Agent } from "../types";

export function useClaims(authToken: string | null) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const socketRef = useRef<any>(null);

  const selectedClaim = claims.find(c => c.id === selectedClaimId);

  useEffect(() => {
    if (!authToken) return;

    const socket = io("http://localhost:3001", {
      transports: ["websocket"],
      auth: { token: authToken }
    });
    socketRef.current = socket;

    socket.emit("join_admin");

    socket.on("new_claim_alert", (payload: any) => {
      const isApproved = payload.claimData?.status === "approved" || payload.claimData?.status === "complete";
      
      const newClaim: Claim = {
        id: payload.id,
        orderId: payload.orderId,
        item: payload.claimData?.item || `Order ${payload.orderId}`,
        price: payload.claimData?.price || 0,
        reason: payload.claimData?.reason || payload.content,
        analysis: payload.claimData?.analysis || { damageType: "Pending", confidence: 0 },
        status: isApproved ? "complete" : "pending",
        decision: isApproved ? "approved" : "pending",
        imageUrl: payload.claimData?.imageUrl,
        messages: []
      };

      setClaims(prev => {
        const exists = prev.find(c => c.id === payload.id);
        if (exists) {
          return prev.map(c => c.id === payload.id ? { ...c, ...newClaim, messages: c.messages } : c);
        }
        return [...prev, newClaim];
      });
    });

    socket.on("load_claims", (dbClaims: any[]) => {
      const mapped: Claim[] = dbClaims.map(c => ({
        id: c.id,
        orderId: c.orderId,
        item: c.item || `Order ${c.orderId}`,
        price: parseFloat(c.price) || 0,
        reason: c.analysis?.reason || "Menunggu review",
        analysis: c.analysis || { damageType: "Pending", confidence: 0 },
        status: (c.status as any) || "active",
        decision: c.decision || "pending",
        imageUrl: c.imageUrl,
        archived: c.archived,
        messages: []
      }));
      setClaims(mapped);
    });

    socket.on("new_message", (msg: any) => {
      setClaims(prev => prev.map(c => {
        if (c.id === msg.room_id || c.id === msg.roomId) {
          if (c.messages.some(m => m.id === msg.id)) return c;
          return {
            ...c,
            messages: [...c.messages, { role: msg.role, content: msg.content, id: msg.id, imageUrl: msg.image_url || msg.imageUrl }],
            imageUrl: msg.image_url || msg.imageUrl || c.imageUrl
          };
        }
        return c;
      }));
    });

    socket.on("load_history", ({ roomId, history }: { roomId: string, history: any[] }) => {
      setClaims(prev => prev.map(c => {
        if (c.id === roomId) {
          const latestPhoto = [...history].reverse().find(h => h.image_url || h.imageUrl);
          return {
            ...c,
            messages: history.map(h => ({
              role: h.role,
              content: h.content,
              id: h.id,
              imageUrl: h.image_url || h.imageUrl
            })),
            imageUrl: latestPhoto?.image_url || latestPhoto?.imageUrl || c.imageUrl
          };
        }
        return c;
      }));
    });

    socket.on("claim_order_updated", (data: { roomId: string, orderId: string }) => {
      setClaims(prev => prev.map(c => c.id === data.roomId ? { ...c, orderId: data.orderId } : c));
    });

    socket.on("claim_decision_sync", (data: { roomId: string, decision: string, status: string }) => {
      setClaims(prev => prev.map(c => c.id === data.roomId ? { ...c, decision: data.decision as any, status: data.status as any } : c));
    });

    return () => {
      socket.disconnect();
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !showArchived) return;
    fetch("http://localhost:3001/api/claims?archived=true", {
      headers: { "Authorization": `Bearer ${authToken}` }
    })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const archivedMapped = data.map((c: any) => ({
          id: c.id,
          orderId: c.orderId,
          item: c.item || `Order ${c.orderId}`,
          price: parseFloat(c.price) || 0,
          reason: c.analysis?.reason || "Diarsipkan",
          analysis: c.analysis || { damageType: "-", confidence: 0 },
          status: c.status || "complete",
          decision: c.decision || "pending",
          imageUrl: c.imageUrl,
          archived: true,
          messages: []
        }));
        
        setClaims(prev => {
          const newOnes = archivedMapped.filter(ac => !prev.some(pc => pc.id === ac.id));
          return [...prev, ...newOnes];
        });
      })
      .catch(console.error);
  }, [showArchived, authToken]);

  const handleArchive = async (claimId: string, archive: boolean) => {
    if (!authToken) return;
    setIsArchiving(true);
    try {
      await fetch(`http://localhost:3001/api/claims/${claimId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify({ archived: archive })
      });
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, archived: archive } : c));
      setSelectedClaimId(null);
    } catch (err) {
      console.error("Archive error:", err);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDecision = async (claimId: string, decision: "approved" | "rejected") => {
    if (!authToken) return;
    try {
      const res = await fetch(`http://localhost:3001/api/claims/${claimId}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify({ decision })
      });
      if (res.ok) {
        setClaims(prev => prev.map(c => c.id === claimId ? { ...c, decision, status: 'complete' as any } : c));
      } else {
        const errorData = await res.json();
        alert("Gagal memproses keputusan: " + (errorData.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("Decision error:", err);
      alert("Terjadi kesalahan jaringan saat memproses keputusan.");
    }
  };

  const handleUpdateOrderId = async (claimId: string, newOrderId: string): Promise<boolean> => {
    if (!newOrderId.trim() || !authToken) return false;
    setIsUpdatingOrder(true);
    try {
      const res = await fetch(`http://localhost:3001/api/claims/${claimId}/order`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ orderId: newOrderId.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setClaims(prev => prev.map(c => c.id === claimId ? { ...c, orderId: data.orderId, orderDetails: data.orderData } : c));
        return true;
      } else {
        alert(data.error || "Gagal mengupdate Nomor Order");
        return false;
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan.");
      return false;
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleSendMessage = (message: string) => {
    if (!message.trim() || !selectedClaimId || !socketRef.current) return;
    socketRef.current.emit("agent_message", {
      roomId: selectedClaimId,
      content: message.trim(),
      role: "agent"
    });
  };

  const handleTakeOver = (claimId: string) => {
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: "active" } : c));
    setSelectedClaimId(claimId);
    if (socketRef.current) {
      socketRef.current.emit("join_room", { roomId: claimId });
    }
  };

  const setClaimOrderDetails = (claimId: string, orderDetails: any) => {
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, orderDetails } : c));
  };

  useEffect(() => {
    if (selectedClaimId && socketRef.current) {
      socketRef.current.emit("join_room", { roomId: selectedClaimId });
    }
  }, [selectedClaimId]);

  return {
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
    socket: socketRef.current
  };
}
