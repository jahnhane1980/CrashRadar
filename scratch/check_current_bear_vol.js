import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await db.query(`
        SELECT open_time, close, volume 
        FROM market_data_binance 
        WHERE symbol = 'BTCUSDT' AND interval_type = '1d' 
        AND open_time >= UNIX_TIMESTAMP('2025-10-01') * 1000
        AND open_time <= UNIX_TIMESTAMP('2026-06-27') * 1000
        ORDER BY open_time ASC
    `);
    
    let minClose = Infinity;
    let minDate = '';
    let minVol = 0;

    let maxVol = 0;
    let maxVolDate = '';

    rows.forEach(r => {
        const d = new Date(Number(r.open_time)).toISOString().split('T')[0];
        const c = Number(r.close);
        const v = Number(r.volume);
        
        if (c < minClose) {
            minClose = c;
            minDate = d;
            minVol = v;
        }
        
        if (v > maxVol) {
            maxVol = v;
            maxVolDate = d;
        }
    });

    console.log(`Vorläufiger Bottom seit Peak (Okt 2025): am ${minDate} (Close: ${minClose})`);
    console.log(`Volumen an diesem Tiefpunkt: ${minVol.toLocaleString('de-DE')} BTC`);
    console.log(`Höchstes Volumen im gesamten Bärenmarkt (Okt 25 - Jun 26): ${maxVol.toLocaleString('de-DE')} BTC am ${maxVolDate}`);

    db.end();
}

main().catch(console.error);
