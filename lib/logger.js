const pool = require("./db");

/**
 * Helper to log security and administrative events to the database
 */
async function logEvent(agentId, agentEmail, eventType, description, ip, success = true) {
  try {
    await pool.query(
      "INSERT INTO agent_logs (agent_id, agent_email, event_type, description, ip_address, success) VALUES ($1, $2, $3, $4, $5, $6)",
      [agentId || null, agentEmail, eventType, description, ip, success]
    );
  } catch (e) { 
    console.error("Log error:", e.message); 
  }
}

module.exports = { logEvent };
