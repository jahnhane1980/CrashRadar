import 'dotenv/config';
import mysql from 'mysql2/promise';

async function setup() {
    console.log("Erstelle market_data_cboe Tabelle...");
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_data_cboe (
        symbol VARCHAR(50) NOT NULL,
        record_date DATE NOT NULL,
        volume BIGINT,
        PRIMARY KEY (symbol, record_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Tabelle erstellt!");
    db.end();
}

setup().catch(console.error);
