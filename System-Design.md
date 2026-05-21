# SinergiVisi AI System Design

## 1. Overview
SinergiVisi AI mengadopsi bahasa desain **Elegant Light Glassmorphism**. Fokus utama adalah pada antarmuka yang bersih, mewah, dan menenangkan, yang sangat cocok untuk representasi toko pecah belah. Desain ini memberikan kesan eksklusif namun tetap hangat dan ramah untuk pelayanan pelanggan.

## 2. Design Principles
- **Light-First Approach**: Desain dioptimalkan untuk mode terang (pearl/warm white) sebagai default guna memberikan kesan kebersihan, transparansi, dan kemewahan yang identik dengan kristal atau keramik.
- **Frosted Glass (Glassmorphism)**: Penggunaan efek transparansi dan blur (`backdrop-filter`) pada latar terang untuk menciptakan tekstur kaca berembun yang elegan.
- **Subtle Feedback**: Setiap interaksi disertai dengan micro-animations dan efek bayangan lembut (soft shadow) daripada neon glow.
- **Premium Aesthetic**: Penggunaan aksen emas (gold) dan typography yang elegan untuk memperkuat kesan toko kelas atas.

## 3. Color Palette

### 3.1 Core Colors
| Color | Token | Hex Code | Purpose |
| :--- | :--- | :--- | :--- |
| ![#cda434](https://img.shields.io/badge/-cda434-cda434?style=flat-square) | **Primary** | `#cda434` | Elegant Gold - Brand color, AI bubbles, primary actions |
| ![#94a3b8](https://img.shields.io/badge/-94a3b8-94a3b8?style=flat-square) | **Secondary** | `#94a3b8` | Slate Blue/Grey - Agent highlights, secondary actions |
| ![#e11d48](https://img.shields.io/badge/-e11d48-e11d48?style=flat-square) | **Accent** | `#e11d48` | Rose - Critical alerts, rejected status |
| ![#fdfbf7](https://img.shields.io/badge/-fdfbf7-fdfbf7?style=flat-square) | **Background** | `#fdfbf7` | Pearl/Warm White - Latar belakang utama |
| ![#292524](https://img.shields.io/badge/-292524-292524?style=flat-square) | **Foreground** | `#292524` | Stone 800 - Primary text content |

### 3.2 UI States (Light Mode)
- **Card Background**: ![#ffffff](https://img.shields.io/badge/-ffffffb3-ffffffb3?style=flat-square) `rgba(255, 255, 255, 0.7)` (Frosted Glass)
- **Card Border**: ![#ffffff](https://img.shields.io/badge/-ffffffcc-ffffffcc?style=flat-square) `rgba(255, 255, 255, 0.8)`
- **Muted Text**: ![#78716c](https://img.shields.io/badge/-78716c-78716c?style=flat-square) `#78716c` (stone-500)
- **Input Background**: ![#ffffff](https://img.shields.io/badge/-ffffffe6-ffffffe6?style=flat-square) `rgba(255, 255, 255, 0.9)`

### 3.3 Dark Mode Support
Sistem mendukung `prefers-color-scheme: dark` untuk kenyamanan di malam hari:
- **Background**: ![#1c1917](https://img.shields.io/badge/-1c1917-1c1917?style=flat-square) `#1c1917` (Stone 900)
- **Foreground**: ![#f5f5f4](https://img.shields.io/badge/-f5f5f4-f5f5f4?style=flat-square) `#f5f5f4` (Stone 100)
- **Card Background**: ![#292524](https://img.shields.io/badge/-292524b3-292524b3?style=flat-square) `rgba(41, 37, 36, 0.7)`
- **Card Border**: ![#ffffff](https://img.shields.io/badge/-ffffff1a-ffffff1a?style=flat-square) `rgba(255, 255, 255, 0.1)`

## 4. Typography
Sistem menggunakan keluarga font **Inter** sebagai standar utama.

- **Body**: `Inter, system-ui, sans-serif`
- **System Labels**: `Inter` dengan `tracking-[0.2em]` dan `uppercase` untuk kesan elegan.
- **Gradient Text**: Menggunakan linear gradient dari Gold ke Soft Slate untuk heading utama.

## 5. Components & UI Elements

### 5.1 Glass Cards (`.glass-card`)
Elemen kontainer utama dengan properti:
- `backdrop-filter: blur(24px)`
- `border: 1px solid var(--card-border)`
- `border-radius: 1rem`

### 5.2 Glow Buttons (`.glow-button`)
Tombol interaktif dengan efek:
- **Hover**: Box shadow lembut sesuai warna emas brand ![#cda434](https://img.shields.io/badge/-cda43433-cda43433?style=flat-square).
- **Active**: Transformasi `scale(0.95)` untuk feedback fisik.

### 5.3 Chat Interface
- **AI Bubble**: ![#cda434](https://img.shields.io/badge/-Primary-cda434?style=flat-square) Latar belakang semi-transparan dengan border kiri emas.
- **User Bubble**: ![#cda434](https://img.shields.io/badge/-User-cda43426?style=flat-square) Latar belakang emas transparan.
- **Agent Bubble**: ![#94a3b8](https://img.shields.io/badge/-Agent-94a3b826?style=flat-square) Latar belakang slate transparan dengan border kiri slate.

### 5.4 Badges & Status
- **Pulsing Badge**: Digunakan untuk status 'Menunggu' dengan animasi `pulse-glow`.
- **Status Indicators**: 
  - ![#10b981](https://img.shields.io/badge/-Approved-10b981?style=flat-square) (Emerald)
  - ![#ef4444](https://img.shields.io/badge/-Rejected-ef4444?style=flat-square) (Red)
  - ![#f59e0b](https://img.shields.io/badge/-Pending-f59e0b?style=flat-square) (Amber)

## 6. Visual Effects & Animations

### 6.1 Background Mesh (`.bg-mesh`)
Latar belakang statis namun dinamis menggunakan tiga layer radial gradient:
1. Top-left: ![#cda434](https://img.shields.io/badge/-Primary-cda434?style=flat-square) (Gold)
2. Bottom-right: ![#94a3b8](https://img.shields.io/badge/-Secondary-94a3b8?style=flat-square) (Soft Slate)
3. Top-right: ![#f43f5e](https://img.shields.io/badge/-Accent-f43f5e?style=flat-square) (Soft Rose)
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
