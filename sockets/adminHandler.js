const pool = require("../lib/db");

module.exports = (io, socket) => {
  /**
   * Admin joins the dashboard sync room
   */
  socket.on("join_admin", async () => {
    socket.join("admin_room");
    try {
      // Hanya muat klaim yang BELUM diarsipkan untuk antrean aktif
      const res = await pool.query(
        "SELECT * FROM claims WHERE archived = false OR archived IS NULL ORDER BY created_at DESC"
      );
      
      console.log(`[DEBUG] Loading ${res.rows.length} claims for admin.`);
      
      socket.emit("load_claims", res.rows.map(c => ({
        id: c.room_id,
        orderId: c.order_id,
        item: c.item_name,
        price: c.price,
        status: c.status,
        decision: c.decision,
        mode: c.mode,
        analysis: c.analysis_result
      })));
    } catch (err) {
      console.error("Error loading claims for admin:", err);
    }
  });
};
