# Panduan Deployment ke Google Cloud Run 🚀

Dokumen ini menjelaskan langkah-langkah untuk mendeploy ekosistem **SinergiVisi** ke Google Cloud Run. Ekosistem ini terdiri dari dua bagian utama:
1. **SinergiVisi Ecommerce** (Laravel Backend & Dashboard)
2. **SinergiVisi AI** (Next.js Frontend & Node.js Express/Socket server)

---

## 🏗️ Persiapan Awal

1. **Google Cloud Project**: Pastikan Anda memiliki project di [Google Cloud Console](https://console.cloud.google.com/).
2. **GCloud CLI**: Instal [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) di mesin lokal Anda.
3. **Enable APIs**: Jalankan perintah berikut untuk mengaktifkan API yang diperlukan:
   ```bash
   gcloud services enable run.googleapis.com \
                          containerregistry.googleapis.com \
                          cloudbuild.googleapis.com \
                          sqladmin.googleapis.com \
                          secretmanager.googleapis.com
   ```

---

## 1. Mendeploy SinergiVisi AI (Node.js & Next.js)

Project ini menggunakan arsitektur hybrid (Next.js + Express). Untuk efisiensi di Cloud Run, kita akan menggabungkannya menjadi satu layanan.

### A. Buat `Dockerfile` di root `sinergi-visi-ai/`
```dockerfile
FROM node:20-slim AS base

# 1. Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build Next.js
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 3. Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV PORT 8080

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/middlewares ./middlewares
COPY --from=builder /app/services ./services
COPY --from=builder /app/sockets ./sockets

# Cloud Run mendengarkan pada port 8080
EXPOSE 8080
CMD ["node", "server.js"]
```

### B. Konfigurasi `server.js` untuk Cloud Run
Pastikan `server.js` menggunakan port dari environment variable:
```javascript
const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### C. Build & Deploy
```bash
# Ganti [PROJECT_ID] dengan ID Project Google Cloud Anda
gcloud builds submit --tag gcr.io/[PROJECT_ID]/sinergi-visi-ai

gcloud run deploy sinergi-visi-ai \
  --image gcr.io/[PROJECT_ID]/sinergi-visi-ai \
  --platform managed \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=your_db_url,GOOGLE_GENERATIVE_AI_API_KEY=your_key,MCP_TOKEN=your_token"
```

---

## 2. Mendeploy SinergiVisi Ecommerce (Laravel)

### A. Buat `Dockerfile` di root `sinergi-visi-ecommerce/`
Gunakan image PHP resmi dengan konfigurasi Apache/Nginx.
```dockerfile
FROM php:8.2-apache

# Install dependencies sistem
RUN apt-get update && apt-get install -y \
    libpng-dev libjpeg-dev libfreetype6-dev zip libzip-dev unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd pdo pdo_mysql pdo_pgsql zip

# Enable apache modules
RUN a2enmod rewrite

# Set working directory
COPY . /var/www/html
WORKDIR /var/www/html

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
RUN composer install --no-dev --optimize-autoloader

# Set Permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

# Konfigurasi Apache Port untuk Cloud Run
RUN sed -i 's/80/${PORT}/g' /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf

ENV PORT 8080
EXPOSE 8080
```

### B. Deploy
```bash
gcloud builds submit --tag gcr.io/[PROJECT_ID]/sinergi-visi-ecommerce

gcloud run deploy sinergi-visi-ecommerce \
  --image gcr.io/[PROJECT_ID]/sinergi-visi-ecommerce \
  --platform managed \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars="APP_KEY=base64:...,DB_CONNECTION=pgsql,DB_HOST=..."
```

---

## 3. Konfigurasi PostgreSQL (Google Cloud SQL)

Cloud Run bersifat *stateless* (data hilang saat restart), jadi Anda **tidak boleh** menjalankan database di dalam container yang sama. Gunakan **Google Cloud SQL** untuk database PostgreSQL yang persisten.

### A. Buat Instance Cloud SQL
1. Pergi ke [Cloud SQL Console](https://console.cloud.google.com/sql).
2. Buat Instance baru -> Pilih **PostgreSQL**.
3. Pilih **Public IP** (lebih mudah untuk awal) atau **Private IP** (lebih aman, butuh VPC).
4. Catat `Connection Name` (format: `project-id:region:instance-id`).

### B. Hubungkan Cloud Run ke Cloud SQL
Cloud Run memiliki integrasi bawaan dengan Cloud SQL. Saat mendeploy, Anda harus menambahkan flag `--add-cloudsql-instances`.

#### Untuk SinergiVisi AI (Node.js):
Gunakan Unix Socket untuk koneksi paling stabil di Cloud Run.
Update `DATABASE_URL` di env:
```bash
# Format Unix Socket: postgres://user:password@/db_name?host=/cloudsql/CONNECTION_NAME
gcloud run services update sinergi-visi-ai \
  --add-cloudsql-instances=[CONNECTION_NAME] \
  --set-env-vars="DATABASE_URL=postgres://postgres:password@/sinergivisi-ai?host=/cloudsql/[CONNECTION_NAME]"
```

#### Untuk SinergiVisi Ecommerce (Laravel):
Update `.env` untuk menggunakan socket:
```bash
gcloud run services update sinergi-visi-ecommerce \
  --add-cloudsql-instances=[CONNECTION_NAME] \
  --set-env-vars="DB_CONNECTION=pgsql,DB_SOCKET=/cloudsql/[CONNECTION_NAME],DB_DATABASE=sinergivisi,DB_USERNAME=postgres,DB_PASSWORD=..."
```

### C. Menjalankan Migrasi Database
Gunakan **Cloud Run Jobs** untuk menjalankan migrasi agar tidak mengganggu trafik:
```bash
# Contoh Migrasi Laravel
gcloud run jobs create migrate-db \
  --image gcr.io/[PROJECT_ID]/sinergi-visi-ecommerce \
  --command="php","artisan","migrate","--force" \
  --add-cloudsql-instances=[CONNECTION_NAME] \
  --region asia-southeast2

gcloud run jobs execute migrate-db --region asia-southeast2
```

---

## 🔐 Tips Keamanan & Optimasi

1. **Cloud SQL**: Gunakan [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/mysql/connect-run) untuk koneksi database yang aman.
2. **Secret Manager**: Jangan masukkan API Key di environment variables secara langsung. Gunakan Secret Manager:
   ```bash
   --set-secrets="GOOGLE_GENERATIVE_AI_API_KEY=GEMINI_KEY:latest"
   ```
3. **VPC Connector**: Jika database Anda berada di jaringan private, gunakan VPC Connector.
4. **WebSocket (Socket.io)**: Cloud Run mendukung WebSocket, namun pastikan untuk mengaktifkan **Session Affinity** di pengaturan layanan agar client tetap terhubung ke instance yang sama.
   ```bash
   gcloud run services update sinergi-visi-ai --session-affinity
   ```

---

## 🔄 Alur Integrasi
Setelah deploy:
1. Update `APP_URL` di Laravel ke URL Cloud Run AI.
2. Update URL WebSocket di frontend Next.js ke URL Cloud Run AI (HTTPS).
