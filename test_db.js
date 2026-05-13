require("dotenv").config({ path: ".env.local" });
const pool = require("./lib/db");

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("DB Test Failed:", err.message);
  } else {
    console.log("DB Test Success:", res.rows[0]);
  }
  process.exit();
});
