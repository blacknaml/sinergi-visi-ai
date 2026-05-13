const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../lib/db");
const { logEvent } = require("../lib/logger");
const { JWT_SECRET } = require("../middlewares/auth");

/**
 * Handle agent login
 */
const login = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password wajib diisi." });
  }

  try {
    const result = await pool.query("SELECT * FROM agents WHERE email = $1", [email]);
    const agent = result.rows[0];
    
    if (!agent) {
      await logEvent(null, email, "LOGIN_FAILED", "Email tidak ditemukan", ip, false);
      return res.status(401).json({ error: "Email atau password salah." });
    }
    
    if (!agent.is_active) {
      await logEvent(agent.id, email, "LOGIN_BLOCKED", "Akun dinonaktifkan", ip, false);
      return res.status(403).json({ error: "Akun Anda telah dinonaktifkan." });
    }

    const isValid = await bcrypt.compare(password, agent.password_hash);
    if (!isValid) {
      await logEvent(agent.id, email, "LOGIN_FAILED", "Password salah", ip, false);
      return res.status(401).json({ error: "Email atau password salah." });
    }

    const token = jwt.sign(
      { id: agent.id, email: agent.email, name: agent.name, role: agent.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    await logEvent(agent.id, email, "LOGIN_SUCCESS", "Login berhasil", ip, true);
    res.json({ token, agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Terjadi kesalahan server." });
  }
};

/**
 * Handle "me" request to get current agent profile
 */
const getMe = (req, res) => {
  res.json({ agent: req.agent });
};

/**
 * Handle listing all agents
 */
const getAgents = async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role, is_active, created_at FROM agents ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data agen." });
  }
};

module.exports = {
  login,
  getMe,
  getAgents
};
