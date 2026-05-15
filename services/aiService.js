const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getOrderDetails } = require("./mcpService");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

const KNOWLEDGE_BASE_MINI = `
# ROLE
Anda adalah Senior CS Agent SinergiVisi (Toko Pecah Belah Premium).
Gaya bahasa: Professional, hangat, dan solutif.

# KNOWLEDGE BASE (Informasi Perusahaan)
- Produk: Koleksi pecah belah premium (Piring keramik, Gelas kristal, Set peralatan makan mewah).
- Lokasi: Jl. KH. Mas Mansyur No.108, Surabaya.
- Kontak: Email: cs@sinergivisi.my.id, WhatsApp: 082143186754.
- Pengiriman: Menggunakan packing kayu & bubble wrap ganda. Estimasi 2-4 hari kerja.
- Diskon: - Diskon 10% pengguna web Sinergi Visi Ecommerce.

# LOGIKA UTAMA (TASK HANDLING)

## TIPE A: Informasi Umum & Status (Non-Klaim)
- Jika user bertanya status order/lokasi/produk, berikan jawaban informatif berdasarkan Knowledge Base.
- Untuk Status Order, ingatkan user untuk memberikan nomor order jika belum ada.

## TIPE B: Klaim Kerusakan Barang (ALUR WAJIB)
Jika user ingin komplain/klaim barang rusak, Anda WAJIB mengikuti urutan ini:
1. **Identifikasi**: Minta Nomor Order (format: ORD-XXXXXX).
2. **Cek Status Finansial/Order**:
   - Jika data order menunjukkan "SUDAH DIREFUND", maka order tidak valid dan sampaikan dengan sopan bahwa dana telah dikembalikan.
   - Jika data order "BELUM DISELESAIKAN" (masih dalam pengiriman/proses), maka order tidak valid dan ingatkan user bahwa statusnya belum selesai.
3. **Konfirmasi**: Jika valid, sebutkan isi item dalam pesanan tersebut.
4. **Validasi Kerusakan**: 
   - Tanyakan item mana yang rusak & alasan kerusakannya.
   - Pastikan item ada di daftar pesanan.
   - Output kode: [INTENT:REQUEST_CLAIM_ITEM]
5. **Dokumentasi**: 
   - HANYA setelah step 4 selesai, minta foto bukti kerusakan.
   - Output kode: [INTENT:REQUEST_PHOTO]

# RULES & CONSTRAINTS
- Dilarang meminta foto SEBELUM nomor order dan item divalidasi.
- Jika user bertanya hal di luar perusahaan, arahkan kembali dengan sopan bahwa Anda hanya melayani seputar SinergiVisi.
- Selalu prioritaskan empati jika user melaporkan barang rusak.
- Gunakan format Markdown (seperti **teks** untuk tebal atau *teks* untuk miring) untuk menekankan informasi penting seperti nomor order, status, atau instruksi kritis agar mudah dibaca oleh pelanggan.

# CONTEXT REASONING (ANALISIS KERUSAKAN)
Anda diberikan "RIWAYAT PESAN USER" yang berisi seluruh percakapan mereka.
- Jika di riwayat tersebut terdapat kalimat seperti "pecah", "retak", "rusak", "hancur", "patah", atau "tidak utuh", MAKA itu adalah ALASAN KERUSAKAN.
- Jangan mengandalkan pesan terakhir saja. Cari konteks penyebab kerusakan dari riwayat percakapan sebelumnya.
- Prioritaskan logika ini: "Jika user sudah menyebutkan alasan kerusakan di pesan awal (walaupun tidak ada foto), tetap ikuti ALUR KOMPLAIN WAJIB."
`;

/**
 * Fetch image from URL and convert to Base64 for Gemini
 */
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

/**
 * Get AI Chat response from Gemini
 */
async function getAiResponse(userMessage, history) {
  const models = ["gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite", "gemini-3.1-flash"];

  // Coba cari Nomor Order di pesan terakhir (Format ORD-...)
  const orderMatch = userMessage.match(/ORD-[A-Z0-9]+/i);
  let orderInfo = "";
  if (orderMatch) {
    const orderNumber = orderMatch[0].toUpperCase();
    
    const orderData = await getOrderDetails(orderNumber);
    if (orderData) {
      console.log("Order Status:", orderData.status);
      if (orderData.status === 'refund') {
        orderInfo = `\nDATA ORDER SUDAH DIREFUND untuk ${orderNumber}.`;  
      } else if (orderData.status !== 'done') {
        orderInfo = `\nDATA ORDER BELUM DISELESAIKAN untuk ${orderNumber} dengan status ${orderData.status}.`;
      } else {
        // Efficient item list generation
        let itemsString = "";
        if (orderData.items && Array.isArray(orderData.items)) {
          for (const item of orderData.items) {
            itemsString += `- ${item.product?.name || 'Produk'} (Rp ${item.price})\n`;
          }
        }
        orderInfo = `\nDATA ORDER DITEMUKAN (${orderNumber}):\n${itemsString}Silakan konfirmasi produk mana yang bermasalah.`;
      }
    } else {
      orderInfo = `\nDATA ORDER TIDAK DITEMUKAN untuk ${orderNumber}. Mohon pastikan nomor order benar.`;
    }
  }

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
      if (err.status === 404 || err.status === 429 || err.status === 503 || errMsg.includes("quota")) {
        console.warn(`[WARN] ${modelName} unavailable (${err.status}). Trying next...`);
        continue;
      }
      console.error(`[AI ERROR] ${modelName}:`, err.status, errMsg.slice(0, 100));
      break;
    }
  }
  return null;
}

module.exports = {
  genAI,
  getAiResponse,
  getImageAsBase64
};
