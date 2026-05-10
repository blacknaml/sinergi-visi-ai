require("dotenv").config({ path: ".env.local" });
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const upload = multer({ storage: multer.memoryStorage() });

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Verifikasi Koneksi Database
pool.connect((err, client, release) => {
  if (err) {
    return console.error("Database connection error:", err.stack);
  }
  console.log("PostgreSQL Connected!");
  release();
});

// Mock eCommerce Database (Simulated MCP/RAG) - Tetap ada untuk referensi produk
const ECOMMERCE_DB = {
  "SV-1001": { item: "Piring Keramik Putih", price: 150000 },
  "SV-1002": { item: "Gelas Kristal Premium", price: 250000 },
  "SV-9001": { item: "Sendok Makan Stainless", price: 45000 },
  "SV-2002": { item: "Mangkuk Soup Set", price: 600000 }
};

const KNOWLEDGE_BASE_MINI = `
SinergiVisi AI: Toko pecah belah premium.
ALUR KOMPLAIN WAJIB:
1. Minta Nomor Order (SV-XXXX).
2. CEK: Jika Nomor Order ada di database (Sebutkan item-nya), konfirmasikan ke customer.
3. JANGAN minta foto sebelum Nomor Order tervalidasi.
4. Jika Nomor Order Valid, baru minta customer upload foto bukti.
5. Gunakan kode [INTENT:REQUEST_PHOTO] jika data order sudah benar dan siap menerima foto.
`;

// --- AI Logic ---
async function getAiResponse(userMessage, history) {
  const models = ["gemini-2.0-flash", "gemini-2.5-flash"];
  let lastError = null;

  for (const modelName of models) {
    try {
      console.log(`[AI] Using model: ${modelName}`);
      const model = genAI.getGenerativeModel(
        { model: modelName },
        { apiVersion: "v1beta" }
      );
      const systemPrompt = `
        Anda adalah SinergiVisi AI Customer Service. 
        Pengetahuan: ${KNOWLEDGE_BASE_MINI}
        Database Order (Simulasi): ${JSON.stringify(ECOMMERCE_DB)}
        
        Tugas Anda:
        - Jawab pertanyaan umum pelanggan dengan ramah.
        - Jika pelanggan ingin komplain:
          1. WAJIB tanya Nomor Order.
          2. Cek apakah Nomor Order ada di Database Order di atas.
          3. Jika ADA: Sebutkan item-nya (misal: "Oh, pesanan SV-9001 untuk Sendok Stainless ya?") dan tanyakan detail kerusakannya.
          4. Jika SUDAH JELAS: Minta foto bukti dan sisipkan kode [INTENT:REQUEST_PHOTO] di akhir jawaban.
          5. Jika TIDAK ADA: Beritahu pelanggan bahwa nomor order tidak ditemukan.
      `;
      
      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Siap." }] },
          ...history.map(m => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }]
          }))
        ],
      });

      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      return response.text();
    } catch (err) {
      lastError = err;
      if (err.status === 404 || err.status === 429 || err.message?.includes("quota") || err.message?.includes("not found")) {
        console.warn(`[WARN] ${modelName} unavailable. Trying next model...`);
        continue;
      }
      break; 
    }
  }
  return null;
}

// --- HTTP API: Analyze Photo ---
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const orderItem = req.body.item || "Produk";

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const base64Image = file.buffer.toString("base64");
    const customerReason = req.body.reason || "Tidak ada penjelasan";
    const prompt = `
      Anda adalah pakar inspeksi kualitas SinergiVisi AI.
      Tugas Anda adalah memvalidasi klaim kerusakan untuk item: "${orderItem}".
      Alasan kerusakan dari pelanggan: "${customerReason}".

      LANGKAH ANALISIS:
      1. VERIFIKASI PRODUK: Apakah benda di foto ini adalah "${orderItem}"? 
         (match: true/false)
      2. VERIFIKASI KERUSAKAN: Apakah tipe kerusakan di foto SESUAI dengan alasan pelanggan ("${customerReason}")?
         Contoh: Jika alasan "Pecah" tapi di foto cuma "Lecet", maka isDamageMatch: false.
      3. ANALISIS AKHIR: Apakah ada kerusakan fisik yang nyata?

      Berikan output dalam format JSON:
      {
        "isProductMatch": boolean,
        "isDamageMatch": boolean,
        "isDamaged": boolean,
        "confidence": number (0-1),
        "description": "string",
        "detectedItem": "string",
        "detectedDamage": "string"
      }
    `;

    const modelsToTry = ["gemini-2.0-flash", "gemini-2.5-flash"];
    let analysisResult = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[ANALYSIS] Using: ${modelName}`);
        const model = genAI.getGenerativeModel(
          { model: modelName },
          { apiVersion: "v1beta" }
        );
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Image, mimeType: file.mimetype } }
        ]);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        analysisResult = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        break;
      } catch (err) {
        console.warn(`[ANALYSIS] ${modelName} failed. Trying next...`);
      }
    }

    if (!analysisResult) throw new Error("All analysis models failed");
    res.json(analysisResult);
  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/log-refund", async (req, res) => {
  const { orderId, amount } = req.body;
  try {
    const insertRes = await pool.query(
      "INSERT INTO refunds (order_id, amount, status) VALUES ($1, $2, $3) RETURNING *",
      [orderId, amount, "success"]
    );
    res.json({ success: true, refund: insertRes.rows[0] });
  } catch (err) {
    console.error("Error logging refund:", err);
    res.status(500).json({ error: "Failed to log refund" });
  }
});

// --- WebSocket Logic ---
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join_room", async ({ roomId }) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
    try {
      const res = await pool.query("SELECT * FROM messages WHERE room_id = $1 ORDER BY timestamp ASC", [roomId]);
      socket.emit("load_history", res.rows);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  });

  socket.on("send_message", async (data) => {
    const { roomId, content, role } = data;
    try {
      // 1. Simpan pesan user ke DB
      const insertRes = await pool.query(
        "INSERT INTO messages (room_id, role, content, type) VALUES ($1, $2, $3, $4) RETURNING *",
        [roomId, role, content, "text"]
      );
      const userMsg = insertRes.rows[0];
      io.to(roomId).emit("new_message", userMsg);

      // 2. Cek status klaim untuk menentukan mode (AI atau Human)
      const claimRes = await pool.query("SELECT mode FROM claims WHERE room_id = $1", [roomId]);
      const mode = claimRes.rows.length > 0 ? claimRes.rows[0].mode : "ai";

      if (mode === "ai" && role === "user") {
        const historyRes = await pool.query(
          "SELECT role, content FROM messages WHERE room_id = $1 ORDER BY timestamp DESC LIMIT 5",
          [roomId]
        );
        const roomHistory = historyRes.rows.map(r => ({ role: r.role, content: r.content })).reverse();
        
        const aiContent = await getAiResponse(content, roomHistory);
        
        if (aiContent === null) {
          const quotaMsg = "Maaf, sistem AI kami sedang sibuk. Mohon tunggu agen manusia.";
          const aiInsert = await pool.query(
            "INSERT INTO messages (room_id, role, content) VALUES ($1, $2, $3) RETURNING *",
            [roomId, "ai", quotaMsg]
          );
          io.to(roomId).emit("new_message", aiInsert.rows[0]);
          
          await pool.query("INSERT INTO claims (room_id, order_id, mode) VALUES ($1, $2, $3) ON CONFLICT (room_id) DO UPDATE SET mode = 'human'", [roomId, "Unknown", "human"]);
          io.to(roomId).emit("mode_update", { mode: "human" });
          
          io.emit("new_claim_alert", { id: roomId, content: "AI Quota Exceeded. Human needed." });
          return;
        }

        const cleanContent = aiContent.replace(/\[INTENT:.*?\]/g, "").trim();
        let intent = "general";
        if (aiContent.includes("[INTENT:COMPLAINT]")) intent = "verify_order";
        if (aiContent.includes("[INTENT:REQUEST_PHOTO]")) intent = "request_photo";

        const aiInsert = await pool.query(
          "INSERT INTO messages (room_id, role, content) VALUES ($1, $2, $3) RETURNING *",
          [roomId, "ai", cleanContent]
        );
        const aiMsg = { ...aiInsert.rows[0], intent };
        io.to(roomId).emit("new_message", aiMsg);
      }
    } catch (err) {
      console.error("Error in send_message:", err);
    }
  });

  socket.on("request_handoff", async (data) => {
    const { roomId, claimData } = data;
    try {
      await pool.query(
        "INSERT INTO claims (room_id, order_id, item_name, price, status, mode, analysis_result) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (room_id) DO UPDATE SET mode = 'human', analysis_result = $7",
        [roomId, claimData.orderId, claimData.item, claimData.price, "pending", "human", JSON.stringify(claimData.analysis)]
      );
      
      io.emit("new_claim_alert", {
        id: roomId,
        orderId: claimData.orderId,
        content: `Review Manual: ${claimData.reason}`,
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

  socket.on("join_admin", async () => {
    socket.join("admin_room");
    try {
      const res = await pool.query("SELECT * FROM claims ORDER BY created_at DESC");
      socket.emit("load_claims", res.rows.map(c => ({
        id: c.room_id,
        orderId: c.order_id,
        item: c.item_name,
        price: c.price,
        status: c.status,
        mode: c.mode,
        analysis: c.analysis_result
      })));
    } catch (err) {
      console.error("Error loading claims for admin:", err);
    }
  });

  socket.on("disconnect", () => console.log("Disconnected:", socket.id));
});

const PORT = process.env.WS_PORT || 3001;
httpServer.listen(PORT, () => console.log(`Integrated Server running on port ${PORT}`));
