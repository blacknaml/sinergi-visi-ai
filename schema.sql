-- Schema for SinergiVisi AI Database

-- 1. Table for Chat Messages
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'user', 'ai', 'agent'
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'text',
    image_url TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table for Claims & Analysis
CREATE TABLE IF NOT EXISTS claims (
    room_id VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    item_name VARCHAR(255),
    price DECIMAL(12, 2),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    mode VARCHAR(50) DEFAULT 'ai', -- 'ai', 'human'
    analysis_result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table for Refund Logs
CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'success',
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_claims_order ON claims(order_id);
