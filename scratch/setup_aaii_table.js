import 'dotenv/config';
import mysql from 'mysql2/promise';

async function run() {
    try {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DATABASE_URL nicht gefunden");
        
        const connection = await mysql.createConnection(dbUrl);
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS market_data_aaii (
                record_date DATE PRIMARY KEY,
                bullish DECIMAL(6,4),
                neutral DECIMAL(6,4),
                bearish DECIMAL(6,4),
                spread DECIMAL(6,4),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Tabelle market_data_aaii erfolgreich verifiziert / erstellt.");
        await connection.end();
    } catch (e) {
        console.error("Fehler:", e.message);
    }
}
run();
