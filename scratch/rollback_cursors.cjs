const mysql = require('mysql2/promise');
require('dotenv').config();
async function run() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  
  const [del] = await pool.query("DELETE FROM econ_fred WHERE observation_date >= '2026-06-25'");
  console.log('Deleted rows:', del.affectedRows);
  
  const [res] = await pool.query("UPDATE sync_states SET cursor_data = '{\"date\":\"2026-06-24\"}' WHERE job_id LIKE 'fred_%'");
  console.log('Rolled back FRED sync_states cursors:', res.affectedRows);
  
  await pool.end();
}
run().catch(console.error);
