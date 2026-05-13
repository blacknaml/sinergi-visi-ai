const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getOrderDetails } = require("./mcpService");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

const KNOWLEDGE_BASE_MINI = `
SinergiVisi AI: Toko pecah belah premium.
ALUR KOMPLAIN WAJIB:
1. Minta Nomor Order (Format: ORD-XXXXXX).
2. CEK: Jika Nomor Order valid, konfirmasikan item-item yang ada di pesanan tersebut.
3. CEK: Jika Nomor Order Valid, minta customer menginfokan item/barang yang rusak. Cek item/barang yang rusak tersebut apakah ada di dalam daftar pesanan.
4. Minta customer memberikan alasan kerusakan.
5. JANGAN minta foto sebelum Nomor Order, dan Item yang rusak tervalidasi.
6. Gunakan kode [INTENT:REQUEST_CLAIM_ITEM] jika item order sudah dipilih.
7. Gunakan kode [INTENT:REQUEST_PHOTO] jika data order sudah benar dan siap menerima foto.
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
