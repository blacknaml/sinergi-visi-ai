import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { KNOWLEDGE_BASE } from "@/lib/knowledge-base";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = body.messages || [];
    
    if (messages.length === 0) {
      return NextResponse.json({ content: "Pesan tidak ditemukan.", intent: "general" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1].content;

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY === "GANTI_DENGAN_API_KEY_ANDA") {
      return NextResponse.json({
        content: "Halo! Saya adalah SinergiVisi AI. Maaf, saat ini sistem AI sedang dalam mode simulasi. Ada yang bisa saya bantu terkait produk pecah belah kami?",
        intent: "general"
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const systemPrompt = `
      Anda adalah SinergiVisi AI, asisten customer service cerdas untuk toko e-commerce barang pecah belah.
      Gunakan basis pengetahuan berikut untuk menjawab pertanyaan:
      ${JSON.stringify(KNOWLEDGE_BASE)}

      Aturan:
      1. Jawablah dengan sopan dan membantu.
      2. Jika user bertanya hal umum (stok, pengiriman, info toko), jawab berdasarkan data.
      3. SANGAT PENTING: Deteksi jika user sedang komplain tentang KERUSAKAN barang (pecah, retak, cacat).
      4. Jika terdeteksi komplain kerusakan, Anda HARUS menyisipkan kode khusus [INTENT:COMPLAINT] di akhir jawaban Anda.

      Berikan jawaban dalam format JSON:
      {
        "content": "jawaban Anda di sini",
        "intent": "general" atau "complaint"
      }
    `;

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Saya mengerti. Saya siap melayani pelanggan SinergiVisi." }] },
      ],
    });

    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    
    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      analysis = {
        content: text,
        intent: text.includes("[INTENT:COMPLAINT]") ? "complaint" : "general"
      };
    }

    return NextResponse.json(analysis);

  } catch (error: any) {
    console.error("FULL Chat Error:", error);
    return NextResponse.json({ content: `Maaf, terjadi gangguan teknis (${error.message || 'Unknown Error'}). Bisakah Anda mengulanginya?`, intent: "general" }, { status: 500 });
  }
}
