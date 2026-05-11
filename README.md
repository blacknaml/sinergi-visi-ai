# SinergiVisi AI - Intelligent Claim Support System

**SinergiVisi AI** adalah platform layanan pelanggan cerdas yang mengintegrasikan AI multimodal dan kolaborasi agen manusia untuk menyederhanakan proses klaim barang rusak dan bantuan belanja pada ekosistem Sinergi Visi Ecommerce.

## 🚀 Fitur Utama

- **Multimodal AI Analysis**: Verifikasi otomatis klaim kerusakan barang menggunakan **Gemini Vision** yang membandingkan foto pelanggan dengan foto katalog asli secara real-time.
- **Seamless Human Handoff**: Transisi mulus dari AI ke agen manusia berdasarkan deteksi niat (intent) atau eskalasi otomatis jika AI mengalami gangguan teknis.
- **Real-time Chat**: Komunikasi instan antara pelanggan, AI, dan agen manusia menggunakan **Socket.IO**.
- **Admin Dashboard**: Antarmuka dashboard premium dengan desain *glassmorphism* untuk manajemen antrean klaim, review foto, dan interaksi langsung dengan pelanggan.
- **E-commerce Integration**: Terhubung langsung dengan database e-commerce untuk validasi nomor order (ORD-...) dan pengambilan data produk asli.

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS.
- **Backend**: Node.js (Express), Socket.IO.
- **AI Engine**: Google Gemini API (Model: 2.5 Flash, 2.0 Flash, 1.5 Flash).
- **Database**: PostgreSQL (Log pesan & Status klaim).
- **Storage Integration**: Laravel Storage (Artisan Serve) untuk aset produk.

## ⚙️ Persiapan & Instalasi

### Prasyarat
- Node.js v18+ & pnpm/npm.
- PostgreSQL Database.
- Google Generative AI API Key (AI Studio).
- Sistem **Sinergi Visi Ecommerce** berjalan di port 8000/8001.

### Setup Environment
Buat file `.env.local` di root directory:
```env
# Database
DATABASE_URL=postgres://user:password@localhost:5432/sinergivisi_ai

# AI & Auth
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
JWT_SECRET=your-secret-key

# Ports
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Instalasi
```bash
# Install dependencies
pnpm install

# Jalankan server backend (Integrated)
node server.js

# Jalankan frontend development
pnpm dev
```

## 📐 Arsitektur Sistem

1. **AI Mode**: Pelanggan berinteraksi dengan Gemini AI. AI mendeteksi niat komplain.
2. **Analysis Mode**: AI meminta foto → Gemini Vision membandingkan foto bukti dengan foto asli dari katalog eCommerce.
3. **Review Mode**: Hasil analisis ditampilkan → Pelanggan konfirmasi → Data dikirim ke Admin Dashboard.
4. **Human Mode**: Agen manusia mengambil alih chat (AI dinonaktifkan untuk sesi tersebut) untuk resolusi akhir.

---
© 2026 Sinergi Visi AI - Solusi Support Agent Cerdas.
