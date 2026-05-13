const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Verifikasi Koneksi & Inisialisasi Tabel Otomatis
pool.connect(async (err, client, release) => {
  if (err) {
    return console.error("Database connection error:", err.stack);
  }
  console.log("PostgreSQL Connected!");
  
  try {
    // Inisialisasi tabel jika belum ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'text',
        image_url TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS claims (
        room_id VARCHAR(255) PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        item_name VARCHAR(255),
        price DECIMAL(12, 2),
        status VARCHAR(50) DEFAULT 'pending',
        decision VARCHAR(50) DEFAULT 'pending',
        mode VARCHAR(50) DEFAULT 'ai',
        analysis_result JSONB,
        archived BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'success',
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'agent',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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
    `);
    
    // Migrasi aman untuk menambah kolom jika tabel claims sudah ada dari versi sebelumnya
    await client.query(`
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS decision VARCHAR(50) DEFAULT 'pending';
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);

    console.log("Database Tables Verified/Created.");

    // Seed default admin jika tabel agents masih kosong
    const agentCount = await client.query("SELECT COUNT(*) FROM agents");
    if (parseInt(agentCount.rows[0].count) === 0) {
      const defaultPassword = await bcrypt.hash("admin123", 10);
      await client.query(
        "INSERT INTO agents (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        ["Admin SinergiVisi", "admin@sinergivisi.ai", defaultPassword, "admin"]
      );
      console.log("Default admin account created: admin@sinergivisi.ai / admin123");
    }
  } catch (dbErr) {
    console.error("Error initializing tables:", dbErr);
  } finally {
    release();
  }
});

module.exports = pool;
