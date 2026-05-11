require("dotenv").config({ path: ".env.local" });
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
console.log(`[STARTUP] Gemini API Key: ${apiKey ? apiKey.slice(0,12) + '... (' + apiKey.length + ' chars)' : 'TIDAK ADA!'}`);

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
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 10 * 1024 * 1024  // 10MB — untuk base64 gambar
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
        decision VARCHAR(50) DEFAULT 'pending',
        mode VARCHAR(50) DEFAULT 'ai',
        analysis_result JSONB,
        archived BOOLEAN DEFAULT false,
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

// --- Claims Archive Endpoints ---
// Migrasi kolom archived jika belum ada
pool.query("ALTER TABLE claims ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false")
  .catch(e => console.error("Migration archived column:", e.message));

app.get("/api/claims", authenticateAgent, async (req, res) => {
  const archived = req.query.archived === "true";
  try {
    const result = await pool.query(
      "SELECT * FROM claims WHERE archived = $1 ORDER BY created_at DESC",
      [archived]
    );
    res.json(result.rows.map(c => ({
      id: c.room_id,
      orderId: c.order_id,
      item: c.item_name,
      price: c.price,
      status: c.status,
      decision: c.decision,
      mode: c.mode,
      archived: c.archived,
      analysis: c.analysis_result,
      created_at: c.created_at
    })));
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data klaim." });
  }
});

app.patch("/api/claims/:roomId/archive", authenticateAgent, async (req, res) => {
  const { roomId } = req.params;
  const { archived } = req.body;
  try {
    await pool.query("UPDATE claims SET archived = $1 WHERE room_id = $2", [archived, roomId]);
    await logEvent(req.agent.id, req.agent.email, "CLAIM_ARCHIVED",
      `Klaim ${roomId} ${archived ? "diarsipkan" : "dipulihkan"}`, req.ip);
    // Beritahu customer di room ini bahwa sesi sudah diarsipkan
    if (archived) {
      io.to(roomId).emit("chat_archived");
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengarsipkan klaim." });
  }
});

app.patch("/api/claims/:roomId/decision", authenticateAgent, async (req, res) => {
  const { roomId } = req.params;
  const { decision, note } = req.body; // decision: 'approved' | 'rejected'
  
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: "Keputusan tidak valid." });
  }

  try {
    await pool.query("UPDATE claims SET decision = $1 WHERE room_id = $2", [decision, roomId]);
    
    // Kirim pesan otomatis ke chat
    const systemMsg = decision === 'approved' 
      ? `✅ KEPUTUSAN AGEN: Pengajuan Refund DISETUJUI. Dana akan dikembalikan ke metode pembayaran asal dalam 1-3 hari kerja.`
      : `❌ KEPUTUSAN AGEN: Pengajuan Refund DITOLAK. ${note || "Berdasarkan hasil inspeksi, kerusakan tidak memenuhi kriteria pengembalian."}`;
    
    const insertRes = await pool.query(
      "INSERT INTO messages (room_id, role, content, type) VALUES ($1, $2, $3, $4) RETURNING *",
      [roomId, "agent", systemMsg, "text"]
    );
    
    io.to(roomId).emit("new_message", insertRes.rows[0]);
    
    await logEvent(req.agent.id, req.agent.email, "CLAIM_DECISION", 
      `Klaim ${roomId} status: ${decision.toUpperCase()}`, req.ip);
      
    res.json({ success: true, message: insertRes.rows[0] });
  } catch (err) {
    console.error("Error updating decision:", err);
    res.status(500).json({ error: "Gagal menyimpan keputusan." });
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
const MCP_TOKEN = process.env.MCP_TOKEN || "";

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
    const response = await fetch(`${ECOM_API_BASE}/orders/${orderNumber}`, {
      headers: {
        'X-MCP-Token': MCP_TOKEN,
        'Accept': 'application/json'
      }
    });
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
  // Model yang tersedia untuk key ini (dari /v1beta/models)
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite"];

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

  // Bangun konteks percakapan dalam format teks biasa
  const historyText = history.length > 0
    ? history.map(m => `${m.role === "user" ? "Customer" : "AI"}: ${m.content}`).join("\n")
    : "";

  const fullPrompt = `${KNOWLEDGE_BASE_MINI}${orderInfo}

${historyText ? `Riwayat percakapan:\n${historyText}\n` : ""}Customer: ${userMessage}
AI:`;

  for (const modelName of models) {
    try {
      console.log(`[AI] Using model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(fullPrompt);
      return result.response.text();
    } catch (err) {
      const errMsg = err.message || "";
      if (err.status === 400 && errMsg.includes("API_KEY_INVALID")) {
        console.error("[FATAL] API Key Gemini tidak valid!");
        break;
      }
      if (err.status === 404 || err.status === 429 || errMsg.includes("quota")) {
        console.warn(`[WARN] ${modelName} unavailable (${err.status}). Trying next...`);
        continue;
      }
      console.error(`[AI ERROR] ${modelName}:`, err.status, errMsg.slice(0, 100));
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

    console.log("[DEBUG] /api/analyze - orderId received:", JSON.stringify(req.body));

    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (!orderNumber || orderNumber.trim() === "") {
      return res.status(400).json({ error: "Order ID tidak ditemukan. Mulai ulang proses klaim." });
    }

    // 1. Ambil data pesanan untuk mendapatkan foto produk asli dari API
    let orderData = await getOrderDetails(orderNumber);
    if (!orderData) return res.status(404).json({ error: "Order data not found. Please verify order number." });

    // Handle jika API mengembalikan array (endpoint tidak spesifik) — cari berdasarkan order_number
    if (Array.isArray(orderData)) {
      console.warn("[WARN] getOrderDetails returned array — searching for:", orderNumber);
      orderData = orderData.find(o => 
        o.order_number === orderNumber || o.order_number === orderNumber.toUpperCase()
      ) || null;
      if (!orderData) return res.status(404).json({ error: "Order tidak ditemukan di sistem." });
    }

    const originalProducts = [];
    const items = Array.isArray(orderData.items) ? orderData.items : [];

    if (items.length === 0) {
      console.warn("[WARN] No items in order:", orderNumber, "orderData keys:", Object.keys(orderData));
      return res.status(404).json({ error: "Data item pesanan tidak ditemukan." });
    }

    for (const item of items) {
      console.log("[DEBUG] /api/analyze - image:", JSON.stringify(item.product));
      const b64 = await getImageAsBase64(`${ECOM_STORAGE_BASE}${item.product.image_path}`);
      if (b64) {
        originalProducts.push({
          name: item.product.name,
          base64: b64,
          mimeType: "image/png"
        });
        console.log("[DEBUG] /api/analyze - image:", JSON.stringify(originalProducts));
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

    const visionModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite"];
    let analysisResult = null;

    // Siapkan array gambar (Semua produk asli + 1 foto pelanggan)
    const imageParts = originalProducts.map(p => ({
      inlineData: { data: p.base64, mimeType: p.mimeType }
    }));
    imageParts.push({
      inlineData: { data: customerPhotoB64, mimeType: file.mimetype }
    });

    for (const vModelName of visionModels) {
      try {
        console.log(`[VISION] Using model: ${vModelName}`);
        const model = genAI.getGenerativeModel({ model: vModelName });
        const result = await model.generateContent([prompt, ...imageParts]);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (analysisResult) break;
      } catch (vErr) {
        console.error(`[VISION ERROR] ${vModelName}:`, vErr.status, vErr.message?.slice(0, 120));
        if (vErr.status === 429 || vErr.status === 404) continue;
        break;
      }
    }

    if (!analysisResult) throw new Error("Vision analysis failed to produce valid JSON");
    res.json({ ...analysisResult, totalPrice: orderData.total_price });
  } catch (error) {
    console.error("Analysis Error:", error.message);
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

// Counter kegagalan AI per room (untuk escalasi otomatis ke human)
const aiFailCount = {};

// --- WebSocket Logic ---
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join_room", async ({ roomId }) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
    try {
      // Cek apakah room ini sudah diarsipkan
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

  socket.on("send_message", async (data) => {
    const { roomId, content, role } = data;
    try {
      // 2. Cek status klaim untuk menentukan mode (AI atau Human)
      const claimRes = await pool.query("SELECT mode FROM claims WHERE room_id = $1", [roomId]);
      const mode = claimRes.rows.length > 0 ? claimRes.rows[0].mode : "ai";

      // Ambil history SEBELUM insert — agar pesan saat ini tidak masuk history Gemini
      let roomHistory = [];
      if (mode === "ai" && role === "user") {
        const historyRes = await pool.query(
          "SELECT role, content FROM messages WHERE room_id = $1 ORDER BY timestamp ASC",
          [roomId]
        );
        // Filter: hanya ambil pasangan user-model yang valid untuk Gemini Chat
        const rawHistory = historyRes.rows.map(r => ({
          role: r.role === "user" ? "user" : "model",
          content: r.content
        }));
        // Pastikan history diawali dengan "user" dan tidak ada dua role berturut
        const filtered = [];
        for (const msg of rawHistory) {
          if (filtered.length === 0 && msg.role !== "user") continue;
          if (filtered.length > 0 && filtered[filtered.length - 1].role === msg.role) continue;
          filtered.push(msg);
        }
        // History untuk Gemini tidak boleh diakhiri "user" (karena kita akan sendMessage user)
        if (filtered.length > 0 && filtered[filtered.length - 1].role === "user") {
          filtered.pop();
        }
        roomHistory = filtered.slice(-8); // Maks 8 pesan terakhir
      }

      // 1. Simpan pesan user ke DB SETELAH ambil history
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
        if (aiContent.includes("[INTENT:REQUEST_PHOTO]")) intent = "request_photo";

        const orderIdMatch = aiContent.match(/ORD-[A-Z0-9]+/i) || content.match(/ORD-[A-Z0-9]+/i);
        const extractedOrderId = orderIdMatch ? orderIdMatch[0] : null;

        const aiInsert = await pool.query(
          "INSERT INTO messages (room_id, role, content) VALUES ($1, $2, $3) RETURNING *",
          [roomId, "ai", cleanContent]
        );
        const aiMsg = { ...aiInsert.rows[0], intent, orderId: extractedOrderId };
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
      // Hanya muat klaim yang BELUM diarsipkan untuk antrean aktif
      const res = await pool.query(
        "SELECT * FROM claims WHERE archived = false OR archived IS NULL ORDER BY created_at DESC"
      );
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
