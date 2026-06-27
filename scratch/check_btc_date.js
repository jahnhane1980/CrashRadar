import 'dotenv/config';
import mysql from 'mysql2/promise';

async function checkDate() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    const [rowsBinance] = await db.query("SELECT MIN(open_time) as min_time FROM market_data_binance WHERE symbol = 'BTCUSDT'");
    if (rowsBinance[0] && rowsBinance[0].min_time) {
        console.log('Earliest Binance Date:', new Date(rowsBinance[0].min_time));
    }
    const [rowsYahoo] = await db.query("SELECT MIN(record_date) as min_date FROM market_data_yahoo WHERE symbol = 'BTC-USD'");
    if (rowsYahoo[0] && rowsYahoo[0].min_date) {
        console.log('Earliest Yahoo Date:', rowsYahoo[0].min_date);
    }
  } catch(e) {
    console.error(e);
  } finally {
    db.end();
  }
}

checkDate();
