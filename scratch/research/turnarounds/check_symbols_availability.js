import 'dotenv/config';
import mysql from 'mysql2/promise';

async function check() {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await conn.query(`
        SELECT symbol, COUNT(*) as cnt, MIN(record_time) as min_t, MAX(record_time) as max_t 
        FROM market_data_m5 
        WHERE symbol IN ('NET', 'CLOUDFLARE', 'NVTS', 'IBRX', 'PLTR', 'HIMS', 'S', 'SOFI', 'APP') 
        GROUP BY symbol;
    `);
    console.log("1. M5 Daten in market_data_m5:");
    console.table(rows);

    const [allM5] = await conn.query(`
        SELECT DISTINCT symbol FROM market_data_m5;
    `);
    console.log("\n2. Alle Symbole in market_data_m5:", allM5.map(r => r.symbol));

    await conn.end();
}
check().catch(console.error);
