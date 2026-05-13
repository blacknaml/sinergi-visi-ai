const pool = require("../lib/db");
const { getAiResponse } = require("../services/aiService");
const { getOrderDetails } = require("../services/mcpService");

const aiFailCount = {};

module.exports = (io, socket) => {
  /**
   * User joins a specific chat room
   */
  socket.on("join_room", async ({ roomId }) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
    try {
      const claimCheck = await pool.query("SELECT archived FROM claims WHERE room_id = $1", [roomId]);
      if (claimCheck.rows.length > 0 && claimCheck.rows[0].archived === true) {
        socket.emit("chat_archived");
      }
      const res = await pool.query("SELECT * FROM messages WHERE room_id = $1 ORDER BY timestamp ASC", [roomId]);
      socket.emit("load_history", { roomId, history: res.rows });
    } catch (err) {
      console.error("Error loading history:", err);
    }
  });

  /**
   * User sends a message (processed by AI or routed to Agent)
   */
  socket.on("send_message", async (data) => {
    const { roomId, content, role } = data;
    try {
      const claimRes = await pool.query("SELECT mode FROM claims WHERE room_id = $1", [roomId]);
      const mode = claimRes.rows.length > 0 ? claimRes.rows[0].mode : "ai";

      let roomHistory = [];
      if (mode === "ai" && role === "user") {
        const historyRes = await pool.query(
          "SELECT role, content FROM messages WHERE room_id = $1 ORDER BY timestamp ASC",
          [roomId]
        );
        const rawHistory = historyRes.rows.map(r => ({
          role: r.role === "user" ? "user" : "model",
          content: r.content
        }));
        const filtered = [];
        for (const msg of rawHistory) {
          if (filtered.length === 0 && msg.role !== "user") continue;
          if (filtered.length > 0 && filtered[filtered.length - 1].role === msg.role) continue;
          filtered.push(msg);
        }
        if (filtered.length > 0 && filtered[filtered.length - 1].role === "user") {
          filtered.pop();
        }
        roomHistory = filtered.slice(-8);
      }

      const insertRes = await pool.query(
        "INSERT INTO messages (room_id, role, content, type) VALUES ($1, $2, $3, $4) RETURNING *",
        [roomId, role, content, "text"]
      );
      const userMsg = insertRes.rows[0];
      io.to(roomId).emit("new_message", userMsg);

      if (mode === "ai" && role === "user") {
        const aiContent = await getAiResponse(content, roomHistory);

        if (aiContent === null) {
          aiFailCount[roomId] = (aiFailCount[roomId] || 0) + 1;
          if (aiFailCount[roomId] >= 2) {
            delete aiFailCount[roomId];
            const escalateMsg = "Mohon maaf, sistem AI kami sedang tidak tersedia. Kami menghubungkan Anda dengan agen manusia. Mohon tunggu sebentar.";
            const aiInsert = await pool.query(
              "INSERT INTO messages (room_id, role, content) VALUES ($1, $2, $3) RETURNING *",
              [roomId, "ai", escalateMsg]
            );
            io.to(roomId).emit("new_message", aiInsert.rows[0]);
            await pool.query(
              "INSERT INTO claims (room_id, order_id, mode) VALUES ($1, $2, $3) ON CONFLICT (room_id) DO UPDATE SET mode = 'human'",
              [roomId, "Unknown", "human"]
            );
            io.to(roomId).emit("mode_update", { mode: "human" });
            io.emit("new_claim_alert", {
              id: roomId, orderId: "Unknown",
              content: "AI tidak tersedia — escalasi otomatis ke agen manusia",
              claimData: { item: "Escalasi AI", reason: content }
            });
          } else {
            const retryMsg = "Mohon maaf, saya sedang mengalami gangguan teknis sesaat. Silakan kirim pesan Anda kembali.";
            const aiInsert = await pool.query(
              "INSERT INTO messages (room_id, role, content) VALUES ($1, $2, $3) RETURNING *",
              [roomId, "ai", retryMsg]
            );
            io.to(roomId).emit("new_message", aiInsert.rows[0]);
          }
          return;
        }

        delete aiFailCount[roomId];
        const cleanContent = aiContent.replace(/\[INTENT:.*?\]/g, "").trim();
        let intent = "general";
        if (aiContent.includes("[INTENT:COMPLAINT]")) intent = "verify_order";
        if (aiContent.includes("[INTENT:REQUEST_CLAIM_ITEM]")) intent = "select_item";
        if (aiContent.includes("[INTENT:REQUEST_PHOTO]")) intent = "request_photo";
        
        const orderIdMatch = aiContent.match(/ORD-[A-Z0-9]+/i) || content.match(/ORD-[A-Z0-9]+/i);
        const extractedOrderId = orderIdMatch ? orderIdMatch[0].toUpperCase() : null;

        let orderItems = null;
        if (extractedOrderId) {
          try {
            const orderData = await getOrderDetails(extractedOrderId);
            if (orderData && Array.isArray(orderData.items) && orderData.items.length > 0) {
              orderItems = orderData.items.map(i => ({
                name: i.product.name,
                price: i.price
              }));
            }
          } catch (oErr) {
            console.warn("[WARN] Could not fetch order items for button rendering:", oErr.message);
          }
        }

        const aiInsert = await pool.query(
          "INSERT INTO messages (room_id, role, content) VALUES ($1, $2, $3) RETURNING *",
          [roomId, "ai", cleanContent]
        );
        const aiMsg = { ...aiInsert.rows[0], intent, orderId: extractedOrderId, orderItems };
        io.to(roomId).emit("new_message", aiMsg);
      }
    } catch (err) {
      console.error("Error in send_message:", err);
    }
  });

  /**
   * Request manual handoff to human agent
   */
  socket.on("request_handoff", async (data) => {
    const { roomId, claimData } = data;
    try {
      const status = claimData.status === "approved" ? "complete" : "pending";
      const decision = claimData.status === "approved" ? "approved" : "pending";
      const archived = claimData.status === "approved";

      await pool.query(
        `INSERT INTO claims (room_id, order_id, item_name, price, status, decision, mode, analysis_result, archived) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         ON CONFLICT (room_id) DO UPDATE SET 
         status = $5, decision = $6, mode = $7, analysis_result = $8, archived = $9`,
        [
          roomId, 
          claimData.orderId, 
          claimData.item, 
          claimData.price, 
          status, 
          decision, 
          "human", 
          JSON.stringify(claimData.analysis),
          archived
        ]
      );
      
      io.emit("new_claim_alert", {
        id: roomId,
        orderId: claimData.orderId,
        content: claimData.status === "approved" ? `Auto-Approved: ${claimData.reason}` : `Review Manual: ${claimData.reason}`,
        claimData: claimData,
        timestamp: new Date()
      });

      io.to(roomId).emit("mode_update", { mode: "human" });
      const aiInsert = await pool.query(
        "INSERT INTO messages (room_id, role, content) VALUES ($1, $2, $3) RETURNING *",
        [roomId, "ai", "Sistem telah meneruskan laporan ini ke tim klaim manusia. Mohon tunggu sebentar."]
      );
      io.to(roomId).emit("new_message", aiInsert.rows[0]);
    } catch (err) {
      console.error("Error in request_handoff:", err);
    }
  });

  /**
   * Agent sends a message to a specific room
   */
  socket.on("agent_message", async (data) => {
    const { roomId, content, role, imageUrl } = data;
    try {
      const insertRes = await pool.query(
        "INSERT INTO messages (room_id, role, content, image_url) VALUES ($1, $2, $3, $4) RETURNING *",
        [roomId, role || "agent", content, imageUrl]
      );
      io.to(roomId).emit("new_message", insertRes.rows[0]);
      await pool.query("UPDATE claims SET mode = 'human' WHERE room_id = $1", [roomId]);
      io.to(roomId).emit("mode_update", { mode: "human" });
    } catch (err) {
      console.error("Error in agent_message:", err);
    }
  });
};
