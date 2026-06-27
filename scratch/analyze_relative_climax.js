import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await db.query(`SELECT open_time as d, close, volume FROM market_data_binance WHERE symbol = 'BTCUSDT' AND interval_type = '1d' ORDER BY open_time ASC`);
    db.end();

    const data = rows.map(r => ({
        date: new Date(Number(r.d)).toISOString().split('T')[0],
        close: Number(r.close),
        volume: Number(r.volume)
    }));

    const crashes = [
        { name: '2018 Crypto Winter', start: '2018-11-01', end: '2019-01-31' },
        { name: '2020 Corona-Crash', start: '2020-02-15', end: '2020-04-15' },
        { name: '2021 China Ban', start: '2021-05-01', end: '2021-07-31' },
        { name: '2022 FTX-Kollaps', start: '2022-10-15', end: '2022-12-31' }
    ];

    console.log("=== Suche nach einer universellen Volumen-Konstante ===\n");

    for (const c of crashes) {
        // Find Trough and Climax
        let minClose = Infinity;
        let troughDate = '';
        let maxVol = 0;
        let climaxDate = '';
        let climaxIdx = -1;

        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            if (d.date >= c.start && d.date <= c.end) {
                if (d.close < minClose) {
                    minClose = d.close;
                    troughDate = d.date;
                }
                if (d.volume > maxVol) {
                    maxVol = d.volume;
                    climaxDate = d.date;
                    climaxIdx = i;
                }
            }
        }

        if (climaxIdx === -1) continue;

        // Calculate averages prior to the climax day
        const getAvg = (days) => {
            if (climaxIdx - days < 0) return 0;
            let sum = 0;
            for(let i = climaxIdx - days; i < climaxIdx; i++) {
                sum += data[i].volume;
            }
            return sum / days;
        };

        const sma30 = getAvg(30);
        const sma90 = getAvg(90);
        const sma180 = getAvg(180);
        const sma365 = getAvg(365);

        const diffDays = Math.round((new Date(troughDate) - new Date(climaxDate)) / (1000*60*60*24));

        console.log(`[${c.name}]`);
        console.log(`Tiefpunkt: ${troughDate} | Volumen-Climax: ${climaxDate} (${diffDays} Tage Differenz)`);
        console.log(`Climax Volumen: ${maxVol.toLocaleString('de-DE')} BTC`);
        console.log(`Vielfaches vom 30D-Schnitt:  ${(maxVol / sma30).toFixed(1)}x`);
        console.log(`Vielfaches vom 90D-Schnitt:  ${(maxVol / sma90).toFixed(1)}x`);
        console.log(`Vielfaches vom 180D-Schnitt: ${(maxVol / sma180).toFixed(1)}x`);
        console.log(`Vielfaches vom 365D-Schnitt: ${(maxVol / sma365).toFixed(1)}x`);
        console.log('---');
    }
}

main().catch(console.error);
