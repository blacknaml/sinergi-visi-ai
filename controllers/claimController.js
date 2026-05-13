const pool = require("../lib/db");
const { logEvent } = require("../lib/logger");
const { reportClaimToMCP, getOrderDetails, ECOM_STORAGE_BASE, ECOM_API_BASE, MCP_TOKEN } = require("../services/mcpService");
const { genAI, getImageAsBase64 } = require("../services/aiService");

/**
 * List all active/non-archived claims
 */
const getClaims = async (req, res) => {
  const isArchived = req.query.archived === 'true';
  try {
    const query = isArchived 
      ? "SELECT * FROM claims WHERE archived = true ORDER BY created_at DESC"
      : "SELECT * FROM claims WHERE archived = false OR archived IS NULL ORDER BY created_at DESC";
      
    const result = await pool.query(query);
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
};

/**
 * Archive or restore a claim
 */
const archiveClaim = async (req, res, io) => {
  const { roomId } = req.params;
  const { archived } = req.body;
  try {
    await pool.query("UPDATE claims SET archived = $1 WHERE room_id = $2", [archived, roomId]);
    await logEvent(req.agent.id, req.agent.email, "CLAIM_ARCHIVED",
      `Klaim ${roomId} ${archived ? "diarsipkan" : "dipulihkan"}`, req.ip);
    
    if (archived && io) {
      io.to(roomId).emit("chat_archived");
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengarsipkan klaim." });
  }
};

/**
 * Handle claim decision (Approve/Reject)
 */
const decideClaim = async (req, res, io) => {
  const { roomId } = req.params;
  const { decision, note } = req.body;
  
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: "Keputusan tidak valid." });
  }

  try {
    await pool.query("UPDATE claims SET decision = $1, status = 'complete' WHERE room_id = $2", [decision, roomId]);
    
    if (io) {
      io.emit("claim_decision_sync", { roomId, decision, status: 'complete' });
    }
    
    if (decision === 'approved') {
      const claimRes = await pool.query("SELECT order_id, analysis_result FROM claims WHERE room_id = $1", [roomId]);
      if (claimRes.rows.length > 0) {
        const claim = claimRes.rows[0];
        let reasonStr = "Approved by Human Agent";
        if (claim.analysis_result) {
          try {
            const analysis = typeof claim.analysis_result === 'string' ? JSON.parse(claim.analysis_result) : claim.analysis_result;
            if (analysis.description) reasonStr = analysis.description;
          } catch(e) {}
        }
        if (claim.order_id) {
          const lowerId = claim.order_id.toLowerCase().trim();
          if (lowerId !== "unknown" && lowerId !== "null" && lowerId !== "") {
            await reportClaimToMCP(claim.order_id, reasonStr);
          }
        }
      }
    }

    const systemMsg = decision === 'approved' 
      ? `✅ KEPUTUSAN AGEN: Pengajuan Refund DISETUJUI. Dana akan dikembalikan ke metode pembayaran asal dalam 1-3 hari kerja.`
      : `❌ KEPUTUSAN AGEN: Pengajuan Refund DITOLAK. ${note || "Berdasarkan hasil inspeksi, kerusakan tidak memenuhi kriteria pengembalian."}`;
    
    const insertRes = await pool.query(
      "INSERT INTO messages (room_id, role, content, type) VALUES ($1, $2, $3, $4) RETURNING *",
      [roomId, "agent", systemMsg, "text"]
    );
    
    if (io) {
      io.to(roomId).emit("new_message", insertRes.rows[0]);
    }
    
    await logEvent(req.agent.id, req.agent.email, "CLAIM_DECISION", 
      `Klaim ${roomId} status: ${decision.toUpperCase()}`, req.ip);
      
    res.json({ success: true, message: insertRes.rows[0] });
  } catch (err) {
    console.error("Error updating decision:", err);
    res.status(500).json({ error: "Gagal menyimpan keputusan." });
  }
};

/**
 * Update Order ID for a claim
 */
const updateClaimOrder = async (req, res, io) => {
  const { roomId } = req.params;
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: "Order ID diperlukan" });

  try {
    const mcpRes = await fetch(`${ECOM_API_BASE}/orders/${orderId}`, {
      headers: { "X-MCP-Token": MCP_TOKEN, "Accept": "application/json" }
    });
    
    if (!mcpRes.ok) {
      return res.status(404).json({ error: "Order tidak ditemukan di eCommerce." });
    }
    
    await pool.query("UPDATE claims SET order_id = $1 WHERE room_id = $2", [orderId.toUpperCase(), roomId]);
    
    // Ambil detail pesanan terbaru untuk dikirim balik ke frontend
    const orderData = await getOrderDetails(orderId);
    
    if (io) {
      io.emit("claim_order_updated", { roomId, orderId: orderId.toUpperCase() });
    }
    
    res.json({ success: true, orderId: orderId.toUpperCase(), orderData });
  } catch (err) {
    console.error("Error updating order ID:", err);
    res.status(500).json({ error: "Gagal menyimpan Order ID" });
  }
};

/**
 * Analyze photo using Gemini Vision AI
 */
const analyzePhoto = async (req, res) => {
  try {
    const file = req.file;
    const orderNumber = req.body.orderId;
    const customerReason = req.body.reason || "Tidak ada penjelasan";

    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (!orderNumber || orderNumber.trim() === "") {
      return res.status(400).json({ error: "Order ID tidak ditemukan. Mulai ulang proses klaim." });
    }

    let orderData = await getOrderDetails(orderNumber);
    if (!orderData) return res.status(404).json({ error: "Order data not found. Please verify order number." });

    if (Array.isArray(orderData)) {
      orderData = orderData.find(o => 
        o.order_number === orderNumber || o.order_number === orderNumber.toUpperCase()
      ) || null;
      if (!orderData) return res.status(404).json({ error: "Order tidak ditemukan di sistem." });
    }

    const originalProducts = [];
    const items = Array.isArray(orderData.items) ? orderData.items : [];

    if (items.length === 0) {
      return res.status(404).json({ error: "Data item pesanan tidak ditemukan." });
    }

    // Filter item yang akan dibandingkan berdasarkan alasan atau intent
    const reasonLower = customerReason.toLowerCase();
    let targetItems = items;

    // Jika alasan mengandung intent khusus, filter secara ketat
    if (customerReason.includes("[INTENT:REQUEST_CLAIM_ITEM]")) {
      const selectedItem = customerReason.replace("[INTENT:REQUEST_CLAIM_ITEM]", "").trim().toLowerCase();
      targetItems = items.filter(item => {
        const productNameLower = item.product.name.toLowerCase();
        return selectedItem.includes(productNameLower) || productNameLower.includes(selectedItem);
      });
    } else {
      // Fuzzy matching biasa
      targetItems = items.filter(item => {
        const productNameLower = item.product.name.toLowerCase();
        const words = productNameLower.split(/\s+/).filter(w => w.length > 2);
        return reasonLower.includes(productNameLower) || words.some(w => reasonLower.includes(w));
      });
    }

    // Jika filter menghasilkan kosong, gunakan semua item sebagai cadangan
    if (targetItems.length === 0) targetItems = items;

    for (const item of targetItems) {
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
    
    const prompt = `
    # ROLE
    Anda adalah Pakar Inspeksi Kualitas SinergiVisi AI yang memiliki ketelitian tinggi dalam mendeteksi kerusakan pada barang pecah belah premium.

    # CONTEXT & INPUT
    - RIWAYAT PESAN USER: "${customerReason}"
    - INPUT GAMBAR: Beberapa gambar awal adalah Referensi Katalog (Produk Asli). Gambar terakhir adalah Foto Kondisi Barang yang dilaporkan pelanggan.

    # TUGAS & LANGKAH ANALISIS
    1. **Ekstraksi Konteks**: Temukan deskripsi kerusakan dari riwayat pesan di atas (Abaikan kode internal seperti [INTENT:...]).
    2. **Verifikasi Produk**: Bandingkan visual (bentuk, pola, warna) antara Foto Pelanggan dengan Foto Referensi Katalog. Gunakan nama produk yang relevan.
    3. **Analisis Kerusakan**:
      - Cari bukti visual kerusakan (pecah, retak, gompel, goresan) pada foto pelanggan.
      - Bandingkan apakah kerusakan tersebut sesuai dengan alasan yang ditulis pelanggan di riwayat pesan.

    # OUTPUT FORMAT (JSON ONLY)
    Anda wajib memberikan output dalam format JSON mentah tanpa markdown:
    {
      "isProductMatch": boolean, 
      "isDamageMatch": boolean, 
      "isDamaged": boolean, 
      "confidence": number, 
      "description": "Penjelasan detail hasil perbandingan visual", 
      "detectedItem": "Nama item yang terdeteksi dari katalog", 
      "detectedDamage": "Jenis kerusakan yang teramati secara visual"
    }
    `;

    const visionModels = ["gemini-3.1-flash-lite", "gemini-3.1-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite"];
    let analysisResult = null;

    const parts = [{ text: prompt }];
    
    // Tambahkan gambar referensi dengan label teks
    originalProducts.forEach(p => {
      parts.push({ text: `PRODUK ASLI (REFERENSI KATALOG): ${p.name}` });
      parts.push({ inlineData: { data: p.base64, mimeType: p.mimeType } });
    });

    // Tambahkan foto pelanggan dengan label teks
    parts.push({ text: "FOTO KONDISI BARANG DARI PELANGGAN (UNTUK DIANALISIS):" });
    parts.push({ inlineData: { data: customerPhotoB64, mimeType: file.mimetype } });

    for (const vModelName of visionModels) {
      try {
        const model = genAI.getGenerativeModel({ model: vModelName });
        const result = await model.generateContent(parts);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (analysisResult) break;
      } catch (vErr) { continue; }
    }

    if (!analysisResult) throw new Error("Gagal menganalisa foto.");
    res.json({ ...analysisResult, totalPrice: orderData.total_price });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Log refund event and notify MCP
 */
const logRefund = async (req, res) => {
  const { orderId, amount, reason } = req.body;
  try {
    const insertRes = await pool.query(
      "INSERT INTO refunds (order_id, amount, status) VALUES ($1, $2, $3) RETURNING *",
      [orderId, amount, "success"]
    );
    if (reason) await reportClaimToMCP(orderId, reason);
    res.json({ success: true, refund: insertRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Gagal mencatat refund." });
  }
};

/**
 * Get full order details from eCommerce for human agent verification
 */
const getOrderDetail = async (req, res) => {
  const { orderId } = req.params;
  try {
    const orderData = await getOrderDetails(orderId);
    if (!orderData) return res.status(404).json({ error: "Order tidak ditemukan." });
    res.json(orderData);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil detail order." });
  }
};

module.exports = {
  getClaims,
  archiveClaim,
  decideClaim,
  updateClaimOrder,
  getOrderDetail,
  analyzePhoto,
  logRefund
};
