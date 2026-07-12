import 'dotenv/config';
import mysql from 'mysql2/promise';

async function run() {
    try {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DATABASE_URL nicht gefunden");
        
        const connection = await mysql.createConnection(dbUrl);
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS market_data_naaim (
                record_date DATE PRIMARY KEY,
                exposure_index DECIMAL(8,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Tabelle market_data_naaim erfolgreich verifiziert / erstellt.");
        await connection.end();
    } catch (e) {
        console.error("Fehler:", e.message);
    }
}
run();
