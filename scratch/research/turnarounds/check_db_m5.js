import 'dotenv/config';
import mysql from 'mysql2/promise';

async function checkM5() {
    console.log("Verbinde mit DATABASE_URL...");
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    console.log("\n1. Prüfe Symbole in market_data_m5:");
    const [symbols] = await connection.query(`
        SELECT symbol, COUNT(*) as cnt, MIN(record_time) as min_time, MAX(record_time) as max_time
        FROM market_data_m5
        GROUP BY symbol;
    `);
    console.table(symbols);

    console.log("\n2. Prüfe PLTR in allen Tabellen:");
    const [tables] = await connection.query(`
        SHOW TABLES;
    `);
    console.log("Tabellen in DB:", tables.map(t => Object.values(t)[0]));

    await connection.end();
}

checkM5().catch(console.error);
