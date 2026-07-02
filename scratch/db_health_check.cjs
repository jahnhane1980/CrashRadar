const mysql = require('mysql2/promise');
require('dotenv').config();
async function run() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  
  console.log('--- DELETING CORRUPTED FRED DATA ---');
  const [res] = await pool.query("DELETE FROM econ_fred WHERE observation_date >= '2026-06-29'");
  console.log('Deleted rows:', res.affectedRows);
  
  console.log('\n--- HEALTH CHECK ---');
  
  const [fredCheck] = await pool.query('SELECT series_id, COUNT(*) as cnt, COUNT(DISTINCT observation_date) as unique_dates FROM econ_fred GROUP BY series_id HAVING cnt > unique_dates');
  console.log('FRED Duplicates:', fredCheck.length > 0 ? fredCheck : 'None');
  
  const [binanceCheck] = await pool.query('SELECT symbol, COUNT(*) as cnt, COUNT(DISTINCT open_time) as unique_dates FROM market_data_binance GROUP BY symbol HAVING cnt > unique_dates');
  console.log('Binance Duplicates:', binanceCheck.length > 0 ? binanceCheck : 'None');
  
  const [tiingoCheck] = await pool.query('SELECT symbol, COUNT(*) as cnt, COUNT(DISTINCT record_date) as unique_dates FROM market_data_tiingo GROUP BY symbol HAVING cnt > unique_dates');
  console.log('Tiingo Duplicates:', tiingoCheck.length > 0 ? tiingoCheck : 'None');
  
  // secCheck removed
  
  const [syncStates] = await pool.query('SELECT job_id, cursor_data FROM sync_states');
  console.log('\n--- SYNC STATES vs DB ---');
  for (const state of syncStates) {
    if (!state.cursor_data) continue;
    try {
       const data = JSON.parse(state.cursor_data);
       console.log('Task: ' + state.job_id.padEnd(25) + ' Cursor Date: ' + (data.date || data.record_date || data.observation_date || data.open_time || data.end_date));
    } catch(e) {}
  }

  await pool.end();
}
run().catch(console.error);
