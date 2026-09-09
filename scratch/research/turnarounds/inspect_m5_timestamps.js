import 'dotenv/config';
import mysql from 'mysql2/promise';

async function inspectTimestamps() {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    // Sample 2024-08-05 (August 2024 dip/turnaround day)
    const [rows] = await connection.query(`
        SELECT record_time, open, high, low, close, volume
        FROM market_data_m5
        WHERE symbol = 'PLTR'
          AND record_time >= '2024-08-05 00:00:00'
          AND record_time < '2024-08-06 00:00:00'
        ORDER BY record_time ASC;
    `);

    console.log(`Anzahl M5 Kerzen am 2024-08-05: ${rows.length}`);
    if (rows.length > 0) {
        console.log("Erste 3 Kerzen:", rows.slice(0, 3));
        console.log("Kerzen um 13:30 - 14:00 UTC (US Open EDT):", rows.filter(r => {
            const h = new Date(r.record_time).getUTCHours();
            const m = new Date(r.record_time).getUTCMinutes();
            return (h === 13 && m >= 30) || (h === 14 && m <= 0);
        }));
        console.log("Letzte 3 Kerzen:", rows.slice(-3));
    }

    await connection.end();
}

inspectTimestamps().catch(console.error);
