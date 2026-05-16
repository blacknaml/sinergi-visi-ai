# SinergiVisi AI System Design

## 1. Overview
SinergiVisi AI mengadopsi bahasa desain **Premium Glassmorphism**. Fokus utama adalah pada antarmuka yang bersih, futuristik, dan sangat responsif, yang memberikan kesan sistem otonom yang canggih namun mudah diakses.

## 2. Design Principles
- **Dark-First Approach**: Desain dioptimalkan untuk mode gelap sebagai default guna mengurangi kelelahan mata dan menonjolkan elemen bercahaya (glow).
- **Glassmorphism**: Penggunaan efek transparansi dan blur (`backdrop-filter`) untuk menciptakan kedalaman visual.
- **Dynamic Feedback**: Setiap interaksi disertai dengan micro-animations atau perubahan visual halus (glow, scale, pulse).
- **Autonomous Aesthetic**: Penggunaan gradient mesh dan typography yang lebar untuk memperkuat kesan teknologi AI masa depan.

## 3. Color Palette

### 3.1 Core Colors
| Color | Token | Hex Code | Purpose |
| :--- | :--- | :--- | :--- |
| ![#8b5cf6](https://img.shields.io/badge/-8b5cf6-8b5cf6?style=flat-square) | **Primary** | `#8b5cf6` | Brand color, AI bubbles, primary buttons |
| ![#06b6d4](https://img.shields.io/badge/-06b6d4-06b6d4?style=flat-square) | **Secondary** | `#06b6d4` | Agent highlights, secondary actions |
| ![#f43f5e](https://img.shields.io/badge/-f43f5e-f43f5e?style=flat-square) | **Accent** | `#f43f5e` | Critical alerts, rejected status |
| ![#050505](https://img.shields.io/badge/-050505-050505?style=flat-square) | **Background** | `#050505` | Deep black for maximum contrast (Dark Mode) |
| ![#ffffff](https://img.shields.io/badge/-ffffff-ffffff?style=flat-square) | **Foreground** | `#ffffff` | Primary text content |

### 3.2 UI States (Dark Mode)
- **Card Background**: ![#141414](https://img.shields.io/badge/-141414-141414?style=flat-square) `rgba(20, 20, 20, 0.8)`
- **Card Border**: ![#ffffff](https://img.shields.io/badge/-ffffff1a-ffffff1a?style=flat-square) `rgba(255, 255, 255, 0.1)`
- **Muted Text**: ![#94a3b8](https://img.shields.io/badge/-94a3b8-94a3b8?style=flat-square) `#94a3b8` (slate-400)
- **Input Background**: ![#ffffff](https://img.shields.io/badge/-ffffff0d-ffffff0d?style=flat-square) `rgba(255, 255, 255, 0.05)`

### 3.3 Light Mode Support
Sistem mendukung `prefers-color-scheme: light` dengan transisi halus:
- **Background**: ![#f8fafc](https://img.shields.io/badge/-f8fafc-f8fafc?style=flat-square) `#f8fafc`
- **Foreground**: ![#0f172a](https://img.shields.io/badge/-0f172a-0f172a?style=flat-square) `#0f172a`
- **Card Background**: ![#ffffff](https://img.shields.io/badge/-ffffff-ffffff?style=flat-square) `#ffffff`
- **Card Border**: ![#000000](https://img.shields.io/badge/-00000014-00000014?style=flat-square) `rgba(0, 0, 0, 0.08)`

## 4. Typography
Sistem menggunakan keluarga font **Inter** sebagai standar utama.

- **Body**: `Inter, system-ui, sans-serif`
- **System Labels**: `Inter` dengan `tracking-[0.2em]` dan `uppercase` untuk kesan teknis.
- **Gradient Text**: Menggunakan linear gradient dari Violet ke Pink ke Cyan untuk heading utama.

## 5. Components & UI Elements

### 5.1 Glass Cards (`.glass-card`)
Elemen kontainer utama dengan properti:
- `backdrop-filter: blur(24px)`
- `border: 1px solid var(--card-border)`
- `border-radius: 1rem`

### 5.2 Glow Buttons (`.glow-button`)
Tombol interaktif dengan efek:
- **Hover**: Box shadow bercahaya sesuai warna brand ![#8b5cf6](https://img.shields.io/badge/-8b5cf666-8b5cf666?style=flat-square).
- **Active**: Transformasi `scale(0.95)` untuk feedback fisik.

### 5.3 Chat Interface
- **AI Bubble**: ![#8b5cf6](https://img.shields.io/badge/-Primary-8b5cf6?style=flat-square) Latar belakang semi-transparan dengan border kiri tebal.
- **User Bubble**: ![#8b5cf6](https://img.shields.io/badge/-User-8b5cf633?style=flat-square) Latar belakang ungu transparan.
- **Agent Bubble**: ![#06b6d4](https://img.shields.io/badge/-Agent-06b6d426?style=flat-square) Latar belakang cyan transparan dengan border kiri cyan.

### 5.4 Badges & Status
- **Pulsing Badge**: Digunakan untuk status 'Menunggu' dengan animasi `pulse-glow`.
- **Status Indicators**: 
  - ![#10b981](https://img.shields.io/badge/-Approved-10b981?style=flat-square) (Emerald)
  - ![#ef4444](https://img.shields.io/badge/-Rejected-ef4444?style=flat-square) (Red)
  - ![#f59e0b](https://img.shields.io/badge/-Pending-f59e0b?style=flat-square) (Amber)

## 6. Visual Effects & Animations

### 6.1 Background Mesh (`.bg-mesh`)
Latar belakang statis namun dinamis menggunakan tiga layer radial gradient:
1. Top-left: ![#8b5cf6](https://img.shields.io/badge/-Primary-8b5cf6?style=flat-square) (Violet)
2. Bottom-right: ![#06b6d4](https://img.shields.io/badge/-Secondary-06b6d4?style=flat-square) (Cyan)
3. Top-right: ![#f43f5e](https://img.shields.io/badge/-Accent-f43f5e?style=flat-square) (Rose)
Semua difilter dengan `blur(100px)` dan opasitas rendah (`0.15`).

### 6.2 Animations
- **Transition**: `0.3s ease` untuk perubahan warna background dan teks.
- **Pulse Glow**: Animasi box-shadow pada elemen status untuk menarik perhatian pengguna tanpa mengganggu.

## 7. Layout Standards
- **Container**: Max-width `4xl` (960px) untuk antarmuka chat agar tetap fokus.
- **Sidebar (Admin)**: Lebar tetap `64` (256px) dengan border tipis dan background gelap transparan.
- **Spacing**: Menggunakan sistem spacing standar Tailwind (p-4, m-6, gap-8) untuk konsistensi.

---
*Dokumen ini merupakan standar resmi untuk pengembangan UI SinergiVisi AI.*
