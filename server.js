require("dotenv").config({ path: ".env.local" });
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "sinergivisi-secret-key-change-in-production";

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

// Verifikasi Koneksi & Inisialisasi Tabel Otomatis
pool.connect(async (err, client, release) => {
  if (err) {
    return console.error("Database connection error:", err.stack);
  }
  console.log("PostgreSQL Connected!");
  
  try {
    // Inisialisasi tabel jika belum ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'text',
        image_url TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS claims (
        room_id VARCHAR(255) PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        item_name VARCHAR(255),
        price DECIMAL(12, 2),
        status VARCHAR(50) DEFAULT 'pending',
        mode VARCHAR(50) DEFAULT 'ai',
        analysis_result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'success',
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'agent',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agent_logs (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
        agent_email VARCHAR(255),
        event_type VARCHAR(50) NOT NULL,
        description TEXT,
        ip_address VARCHAR(100),
        success BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database Tables Verified/Created.");

    // Seed default admin jika tabel agents masih kosong
    const agentCount = await client.query("SELECT COUNT(*) FROM agents");
    if (parseInt(agentCount.rows[0].count) === 0) {
      const defaultPassword = await bcrypt.hash("admin123", 10);
      await client.query(
        "INSERT INTO agents (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        ["Admin SinergiVisi", "admin@sinergivisi.ai", defaultPassword, "admin"]
      );
      console.log("Default admin account created: admin@sinergivisi.ai / admin123");
    }
  } catch (dbErr) {
    console.error("Error initializing tables:", dbErr);
  } finally {
    release();
  }
});

// --- Auth Middleware ---
const authenticateAgent = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Akses ditolak. Token tidak ditemukan." });

  jwt.verify(token, JWT_SECRET, (err, agent) => {
    if (err) return res.status(403).json({ error: "Token tidak valid atau sudah kedaluwarsa." });
    req.agent = agent;
    next();
  });
};

// Helper: Catat aktivitas ke agent_logs
async function logEvent(agentId, agentEmail, eventType, description, ip, success = true) {
  try {
    await pool.query(
      "INSERT INTO agent_logs (agent_id, agent_email, event_type, description, ip_address, success) VALUES ($1, $2, $3, $4, $5, $6)",
      [agentId || null, agentEmail, eventType, description, ip, success]
    );
  } catch (e) { console.error("Log error:", e.message); }
}

// --- Auth Endpoints ---
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress;
  if (!email || !password) return res.status(400).json({ error: "Email dan password wajib diisi." });

  try {
    const result = await pool.query("SELECT * FROM agents WHERE email = $1", [email]);
    const agent = result.rows[0];
    if (!agent) {
      await logEvent(null, email, "LOGIN_FAILED", "Email tidak ditemukan", ip, false);
      return res.status(401).json({ error: "Email atau password salah." });
    }
    if (!agent.is_active) {
      await logEvent(agent.id, email, "LOGIN_BLOCKED", "Akun dinonaktifkan", ip, false);
      return res.status(403).json({ error: "Akun Anda telah dinonaktifkan." });
    }

    const isValid = await bcrypt.compare(password, agent.password_hash);
    if (!isValid) {
      await logEvent(agent.id, email, "LOGIN_FAILED", "Password salah", ip, false);
      return res.status(401).json({ error: "Email atau password salah." });
    }

    const token = jwt.sign(
      { id: agent.id, email: agent.email, name: agent.name, role: agent.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    await logEvent(agent.id, email, "LOGIN_SUCCESS", "Login berhasil", ip, true);
    res.json({ token, agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});

app.get("/api/auth/me", authenticateAgent, (req, res) => {
  res.json({ agent: req.agent });
});

// --- Agents Management Endpoints ---
app.get("/api/agents", authenticateAgent, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role, is_active, created_at FROM agents ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data agen." });
  }
});

app.post("/api/agents", authenticateAgent, async (req, res) => {
  if (req.agent.role !== "admin") return res.status(403).json({ error: "Hanya admin yang bisa menambah agen." });
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Nama, email, dan password wajib diisi." });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO agents (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_active, created_at",
      [name, email, hash, role || "agent"]
    );
    await logEvent(req.agent.id, req.agent.email, "AGENT_CREATED", `Membuat agen baru: ${email}`, req.ip);
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email sudah terdaftar." });
    res.status(500).json({ error: "Gagal menambah agen." });
  }
});

app.patch("/api/agents/:id", authenticateAgent, async (req, res) => {
  if (req.agent.role !== "admin") return res.status(403).json({ error: "Hanya admin yang bisa mengubah agen." });
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    await pool.query("UPDATE agents SET is_active = $1 WHERE id = $2", [is_active, id]);
    await logEvent(req.agent.id, req.agent.email, "AGENT_UPDATED", `Status agen ID ${id} diubah ke ${is_active ? 'aktif' : 'nonaktif'}`, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui agen." });
  }
});

app.delete("/api/agents/:id", authenticateAgent, async (req, res) => {
  if (req.agent.role !== "admin") return res.status(403).json({ error: "Hanya admin yang bisa menghapus agen." });
  const { id } = req.params;
  if (parseInt(id) === req.agent.id) return res.status(400).json({ error: "Tidak bisa menghapus akun sendiri." });
  try {
    const agentRes = await pool.query("SELECT email FROM agents WHERE id = $1", [id]);
    await pool.query("DELETE FROM agents WHERE id = $1", [id]);
    await logEvent(req.agent.id, req.agent.email, "AGENT_DELETED", `Menghapus agen: ${agentRes.rows[0]?.email}`, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus agen." });
  }
});

// --- Security Logs Endpoints ---
app.get("/api/security/logs", authenticateAgent, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT 100"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil log keamanan." });
  }
});

app.get("/api/security/stats", authenticateAgent, async (req, res) => {
  try {
    const [total, failed, today] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM agent_logs"),
      pool.query("SELECT COUNT(*) FROM agent_logs WHERE success = false"),
      pool.query("SELECT COUNT(*) FROM agent_logs WHERE created_at >= NOW() - INTERVAL '24 hours'")
    ]);
    res.json({
      total: parseInt(total.rows[0].count),
      failed: parseInt(failed.rows[0].count),
      today: parseInt(today.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil statistik." });
  }
});

const ECOM_API_BASE = "http://127.0.0.1:8001/api/mcp";
const ECOM_STORAGE_BASE = "http://127.0.0.1:8001/storage/";

// Helper: Ubah URL Gambar ke Base64 untuk Gemini
async function getImageAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  } catch (error) {
    console.error("Error fetching image:", url, error.message);
    return null;
  }
}

// Helper: Ambil Order dari API eCommerce
async function getOrderDetails(orderNumber) {
  try {
    const response = await fetch(`${ECOM_API_BASE}/orders/${orderNumber}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.message === "Pesanan tidak ditemukan") return null;
    return data;
  } catch (error) {
    console.error("Error fetching order:", orderNumber, error.message);
    return null;
  }
}

const KNOWLEDGE_BASE_MINI = `
SinergiVisi AI: Toko pecah belah premium.
ALUR KOMPLAIN WAJIB:
1. Minta Nomor Order (Format: ORD-XXXXXX).
2. CEK: Jika Nomor Order valid, konfirmasikan item-item yang ada di pesanan tersebut.
3. JANGAN minta foto sebelum Nomor Order tervalidasi.
4. Jika Nomor Order Valid, baru minta customer upload foto bukti.
5. Gunakan kode [INTENT:REQUEST_PHOTO] jika data order sudah benar dan siap menerima foto.
`;

// --- AI Logic ---
async function getAiResponse(userMessage, history) {
  const models = ["gemini-2.0-flash", "gemini-2.5-flash"];
  let lastError = null;

  // Coba cari Nomor Order di pesan terakhir (Format ORD-...)
  const orderMatch = userMessage.match(/ORD-[A-Z0-9]+/i);
  let orderInfo = "";
  if (orderMatch) {
    const orderData = await getOrderDetails(orderMatch[0]);
    if (orderData) {
      const items = orderData.items.map(i => `- ${i.product.name} (Rp ${i.price})`).join("\n");
      orderInfo = `\nDATA ORDER DITEMUKAN (${orderMatch[0]}):\n${items}\nSilakan konfirmasi produk mana yang bermasalah.`;
    } else {
      orderInfo = `\nDATA ORDER TIDAK DITEMUKAN untuk ${orderMatch[0]}. Mohon pastikan nomor order benar.`;
    }
  }

  for (const modelName of models) {
    try {
      console.log(`[AI] Using model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1beta" });
      
      const chat = model.startChat({
        history: history.map(m => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }]
        })),
        systemInstruction: KNOWLEDGE_BASE_MINI + orderInfo,
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
    const orderNumber = req.body.orderId;
    const customerReason = req.body.reason || "Tidak ada penjelasan";

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // 1. Ambil data pesanan untuk mendapatkan foto produk asli dari API
    const orderData = await getOrderDetails(orderNumber);
    if (!orderData) return res.status(404).json({ error: "Order data not found. Please verify order number." });

    const originalProducts = [];
    for (const item of orderData.items) {
      const b64 = await getImageAsBase64(`${ECOM_STORAGE_BASE}${item.product.image_path}`);
      if (b64) {
        originalProducts.push({
          name: item.product.name,
          base64: b64,
          mimeType: "image/png"
        });
      }
    }

    const customerPhotoB64 = file.buffer.toString("base64");
    
    // 2. Prompt Vision: Membandingkan Foto Pelanggan dengan Foto Katalog
    const prompt = `
      Anda adalah pakar inspeksi kualitas SinergiVisi AI.
      Tugas Anda adalah membandingkan FOTO PELANGGAN (gambar terakhir) dengan FOTO PRODUK ASLI dari katalog kami (gambar-gambar sebelumnya).

      ALASAN PELANGGAN: "${customerReason}"

      LANGKAH ANALISIS:
      1. Identifikasi apakah barang di FOTO PELANGGAN ada di dalam daftar PRODUK ASLI.
      2. Berikan isProductMatch: true jika cocok dengan salah satu produk dalam order ini.
      3. Periksa apakah ada kerusakan fisik di FOTO PELANGGAN yang sesuai dengan ALASAN PELANGGAN.
      4. Jika alasan "Pecah" tapi di foto cuma "Lecet", maka isDamageMatch: false.

      Berikan output dalam format JSON:
      {
        "isProductMatch": boolean,
        "isDamageMatch": boolean,
        "isDamaged": boolean,
        "confidence": number (0-1),
        "description": "string",
        "detectedItem": "string (Nama barang yang terdeteksi)",
        "detectedDamage": "string (Jenis kerusakan yang terlihat)"
      }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1beta" });

    // Siapkan array gambar (Semua produk asli + 1 foto pelanggan)
    const imageParts = originalProducts.map(p => ({
      inlineData: { data: p.base64, mimeType: p.mimeType }
    }));
    
    imageParts.push({
      inlineData: { data: customerPhotoB64, mimeType: file.mimetype }
    });

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!analysisResult) throw new Error("Vision analysis failed to produce JSON");
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
