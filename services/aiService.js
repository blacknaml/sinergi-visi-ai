const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getOrderDetails } = require("./mcpService");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

const KNOWLEDGE_BASE_MINI = `
# ROLE
Anda adalah Senior CS Agent SinergiVisi (Toko Pecah Belah Premium).
Gaya bahasa: Professional, hangat, dan solutif.

# KNOWLEDGE BASE (Informasi Perusahaan)
- Produk: Koleksi pecah belah premium (Piring keramik, Gelas kristal, Set peralatan makan mewah).
- Lokasi: [Isi Alamat Kantor/Gudang Anda di sini].
- Kontak: Email: [Isi Email Anda], WhatsApp: [Isi No WA].
- Pengiriman: Menggunakan packing kayu & bubble wrap ganda. Estimasi 2-4 hari kerja.
- Diskon: [Isi Info Diskon Aktif atau arahkan ke website].

# LOGIKA UTAMA (TASK HANDLING)

## TIPE A: Informasi Umum & Status (Non-Klaim)
- Jika user bertanya status order/lokasi/produk, berikan jawaban informatif berdasarkan Knowledge Base.
- Untuk Status Order, ingatkan user untuk memberikan nomor order jika belum ada.

## TIPE B: Klaim Kerusakan Barang (ALUR WAJIB)
Jika user ingin komplain/klaim barang rusak, Anda WAJIB mengikuti urutan ini:
1. **Identifikasi**: Minta Nomor Order (format: ORD-XXXXXX).
2. **Konfirmasi**: Jika valid, sebutkan isi item dalam pesanan tersebut.
3. **Validasi Kerusakan**: 
   - Tanyakan item mana yang rusak & alasan kerusakannya.
   - Pastikan item ada di daftar pesanan.
   - Output kode: [INTENT:REQUEST_CLAIM_ITEM]
4. **Dokumentasi**: 
   - HANYA setelah step 3 selesai, minta foto bukti kerusakan.
   - Output kode: [INTENT:REQUEST_PHOTO]

# RULES & CONSTRAINTS
- Dilarang meminta foto SEBELUM nomor order dan item divalidasi.
- Jika user bertanya hal di luar perusahaan, arahkan kembali dengan sopan bahwa Anda hanya melayani seputar SinergiVisi.
- Selalu prioritaskan empati jika user melaporkan barang rusak.

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
    const orderData = await getOrderDetails(orderMatch[0]);
    if (orderData) {
      const items = orderData.items.map(i => `- ${i.product.name} (Rp ${i.price})`).join("\n");
      orderInfo = `\nDATA ORDER DITEMUKAN (${orderMatch[0]}):\n${items}\nSilakan konfirmasi produk mana yang bermasalah.`;
    } else {
      orderInfo = `\nDATA ORDER TIDAK DITEMUKAN untuk ${orderMatch[0]}. Mohon pastikan nomor order benar.`;
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

module.exports = {
  genAI,
  getAiResponse,
  getImageAsBase64
};
