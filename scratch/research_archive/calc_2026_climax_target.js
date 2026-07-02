import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await db.query(`
        SELECT open_time, volume 
        FROM market_data_binance 
        WHERE symbol = 'BTCUSDT' AND interval_type = '1d' 
        ORDER BY open_time DESC LIMIT 90
    `);
    
    let sum30 = 0, sum90 = 0;
    for (let i = 0; i < 90; i++) {
        const v = Number(rows[i].volume);
        sum90 += v;
        if (i < 30) sum30 += v;
    }
    
    const sma30 = sum30 / 30;
    const sma90 = sum90 / 90;
    
    console.log(`Aktueller 30D-Schnitt: ${Math.round(sma30).toLocaleString('de-DE')} BTC`);
    console.log(`Aktueller 90D-Schnitt: ${Math.round(sma90).toLocaleString('de-DE')} BTC`);
    console.log(`Erforderliches Climax-Volumen (4x bis 7x SMA30): ${Math.round(sma30 * 4).toLocaleString('de-DE')} - ${Math.round(sma30 * 7).toLocaleString('de-DE')} BTC`);
    console.log(`Erforderliches Climax-Volumen (4x bis 7x SMA90): ${Math.round(sma90 * 4).toLocaleString('de-DE')} - ${Math.round(sma90 * 7).toLocaleString('de-DE')} BTC`);

    db.end();
}
main().catch(console.error);
