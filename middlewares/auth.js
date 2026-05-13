const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "sinergivisi-secret-key-change-in-production";

/**
 * Middleware to verify JWT token for agents
 */
const authenticateAgent = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: "Akses ditolak. Token tidak ditemukan." });
  }

  jwt.verify(token, JWT_SECRET, (err, agent) => {
    if (err) {
      return res.status(403).json({ error: "Token tidak valid atau sudah kedaluwarsa." });
    }
    req.agent = agent;
    next();
  });
};

module.exports = {
  authenticateAgent,
  JWT_SECRET
};
