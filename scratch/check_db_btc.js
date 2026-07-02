import mysql from 'mysql2/promise';
import 'dotenv/config';
async function run() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  const [rows] = await pool.query("SELECT MIN(DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d')) as first_date, COUNT(*) as cnt FROM market_data_binance WHERE symbol = 'BTCUSDT' AND interval_type = '1d'");
  console.log(rows[0]);
  pool.end();
}
run();
