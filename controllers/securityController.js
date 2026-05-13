const pool = require("../lib/db");

/**
 * Get recent security logs
 */
const getSecurityLogs = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT 100"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil log keamanan." });
  }
};

/**
 * Get security statistics
 */
const getSecurityStats = async (req, res) => {
  try {
    const [total, failed, today] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM agent_logs"),
      pool.query("SELECT COUNT(*) FROM agent_logs WHERE success = false"),
      pool.query("SELECT COUNT(*) FROM agent_logs WHERE created_at >= NOW() - INTERVAL '24 hours'")
    ]);
    res.json({
      total: parseInt(total.rows[0].count),
      failed: parseInt(failed.rows[0].count),
      today: parseInt(today.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil statistik." });
  }
};

module.exports = {
  getSecurityLogs,
  getSecurityStats
};
