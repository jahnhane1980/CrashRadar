import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await db.query(`
        SELECT open_time, volume 
        FROM market_data_binance 
        WHERE symbol = 'BTCUSDT' AND interval_type = '1d' 
        AND open_time >= UNIX_TIMESTAMP('2025-03-01') * 1000
        AND open_time <= UNIX_TIMESTAMP('2026-06-26') * 1000
        ORDER BY open_time ASC
    `);
    
    const data = rows.map(r => ({
        date: new Date(Number(r.open_time)).toISOString().split('T')[0],
        volume: Number(r.volume)
    }));

    // Find April 2025 spike
    for(let i=30; i<data.length; i++) {
        if (data[i].date === '2025-04-07' || data[i].date === '2025-04-08') {
            let sum = 0;
            for(let j=i-30; j<i; j++) sum += data[j].volume;
            let sma = sum/30;
            console.log(`${data[i].date}: Volume = ${data[i].volume.toLocaleString('de-DE')} (SMA: ${sma.toLocaleString('de-DE')})`);
        }
    }

    // Find the max volume day in 2026 to see if we had a capitulation recently
    const d2026 = data.filter(d => d.date >= '2026-01-01');
    if (d2026.length > 0) {
        let maxVol = 0; let maxDate = '';
        d2026.forEach(d => { if(d.volume > maxVol) { maxVol = d.volume; maxDate = d.date; }});
        console.log(`Max Volume in 2026: ${maxVol.toLocaleString('de-DE')} am ${maxDate}`);
    }

    db.end();
}

main().catch(console.error);
