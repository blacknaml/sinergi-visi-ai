-- =============================================
-- Schema Lengkap SinergiVisi AI
-- =============================================

-- 1. Tabel untuk Pesan Chat
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'user', 'ai', 'agent'
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'text',
    image_url TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel untuk Klaim & Analisis
CREATE TABLE IF NOT EXISTS claims (
    room_id VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    item_name VARCHAR(255),
    price DECIMAL(12, 2),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'complete'
    decision VARCHAR(50) DEFAULT 'pending', -- 'approved', 'rejected'
    mode VARCHAR(50) DEFAULT 'ai', -- 'ai', 'human'
    analysis_result JSONB,
    archived BOOLEAN DEFAULT false,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel untuk Log Refund
CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'success',
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel untuk Data Agen/Admin
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'agent', -- 'admin' atau 'agent'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabel untuk Log Keamanan Aktivitas Agen
CREATE TABLE IF NOT EXISTS agent_logs (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    agent_email VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    ip_address VARCHAR(100),
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk Performa
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_claims_order ON claims(order_id);

-- =============================================
-- SEED DATA (Admin Default)
-- Password: admin123
-- =============================================
INSERT INTO agents (name, email, password_hash, role) 
SELECT 'Admin SinergiVisi', 'admin@sinergivisi.ai', '$2a$10$Xm0tQZ0G5Y6iKz7V.bS8O.X0k9p8Z4f3V4k9P7z4o2E1W.T5y7q3q', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE email = 'admin@sinergivisi.ai');
