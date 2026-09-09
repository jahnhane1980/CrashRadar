import 'dotenv/config';
import mysql from 'mysql2/promise';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

async function checkNet() {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    
    // Check if NET is in market_data_yahoo or market_data_tiingo
    const [yRows] = await conn.query("SELECT COUNT(*) as cnt, MIN(date) as min_d, MAX(date) as max_d FROM market_data_yahoo WHERE symbol = 'NET';");
    console.log("NET in market_data_yahoo:", yRows);

    const [tRows] = await conn.query("SELECT COUNT(*) as cnt, MIN(date) as min_d, MAX(date) as max_d FROM market_data_tiingo WHERE symbol = 'NET';");
    console.log("NET in market_data_tiingo:", tRows);

    await conn.end();

    // Check Yahoo Finance for 5m quotes
    try {
        const y5m = await yahooFinance.chart('NET', { interval: '5m', range: '60d' });
        console.log(`Yahoo 5m für NET: ${(y5m.quotes || []).length} Kerzen verfügbar (vom ${y5m.quotes?.[0]?.date} bis ${y5m.quotes?.[y5m.quotes.length-1]?.date})`);
    } catch (e) {
        console.log("Yahoo 5m Fehler für NET:", e.message);
    }
}

checkNet().catch(console.error);
