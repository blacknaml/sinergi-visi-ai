import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const orderItem = formData.get("item") as string;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Debugging: Cek apakah key terbaca
    console.log("Checking API Key...", process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "FOUND (Length: " + process.env.GOOGLE_GENERATIVE_AI_API_KEY.length + ")" : "NOT FOUND");

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY === "GANTI_DENGAN_API_KEY_ANDA") {
      console.warn("GOOGLE_GENERATIVE_AI_API_KEY is missing or using placeholder. Returning mock analysis.");
      return NextResponse.json({
        isDamaged: true,
        damageType: "Pecah/Retak",
        confidence: 0.98,
        description: "Terdeteksi kerusakan fisik pada material kaca sesuai dengan bukti foto.",
        isMock: true
      });
    }

    const buffer = await file.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");

    const prompt = `
      Anda adalah agen asuransi e-commerce yang ahli dalam memvalidasi kerusakan barang pecah belah rumah tangga.
      Analisis gambar ini untuk produk: ${orderItem}.
      
      Tugas Anda:
      1. Tentukan apakah ada kerusakan nyata (pecah, retak, robek, cacat produksi).
      2. Identifikasi jenis kerusakannya.
      3. Berikan skor kepercayaan (confidence) dari 0 ke 1.
      4. Pastikan ini bukan foto palsu atau manipulasi.

      Berikan jawaban dalam format JSON mentah:
      {
        "isDamaged": boolean,
        "damageType": string,
        "confidence": number,
        "description": string
      }
    `;

    // Last Updated: 2026-05-06 19:35
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-3-flash-preview", "gemini-1.5-flash-latest"];
    let result: any = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Analyzing image with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const genResult = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: file.type,
            },
          },
        ]);
        
        result = genResult;
        break;
      } catch (err: any) {
        lastError = err;
        if (err.status === 429 || err.status === 404 || err.message?.includes("quota")) {
          console.warn(`Model ${modelName} failed/quota exceeded. Trying next...`);
          continue;
        }
        throw err;
      }
    }

    if (!result) {
      throw new Error("All models failed for analysis: " + (lastError?.message || "Unknown error"));
    }

    const response = await result.response;
    const text = response.text();
    
    // Robust JSON extraction (handles markdown blocks or raw text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    
    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", text);
      // Fallback if Gemini returns plain text
      analysis = {
        isDamaged: text.toLowerCase().includes("rusak") || text.toLowerCase().includes("damage"),
        damageType: "Analisis Manual",
        confidence: 0.5,
        description: text
      };
    }

    // Ensure description exists
    const finalAnalysis = {
      isDamaged: !!(analysis.isDamaged || analysis.damaged),
      damageType: analysis.damageType || analysis.type || "Fisik",
      confidence: analysis.confidence || 0.8,
      description: analysis.description || analysis.explanation || analysis.summary || "Deskripsi tidak tersedia."
    };

    return NextResponse.json(finalAnalysis);

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
