import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    
    const fetchAsset = async (symbol) => {
        const [rows] = await db.query(`SELECT record_date as date, close, volume FROM market_data_tiingo WHERE symbol = ? ORDER BY record_date ASC`, [symbol]);
        return rows.map(r => ({ date: r.date, close: Number(r.close), volume: Number(r.volume) }));
    };

    const spy = await fetchAsset('SPY');
    const qqq = await fetchAsset('QQQ');
    db.end();

    const cycles = [
        { name: 'Dotcom-Crash', troughWindow: ['2002-09-01', '2002-11-30'] },
        { name: 'Finanzkrise', troughWindow: ['2008-10-01', '2009-06-30'] },
        { name: 'Zins-Panik 2018', troughWindow: ['2018-12-01', '2019-01-31'] },
        { name: 'Corona-Crash 2020', troughWindow: ['2020-03-01', '2020-04-30'] },
        { name: 'Inflations-Schock 2022', troughWindow: ['2022-09-01', '2022-12-31'] },
        { name: 'Crash 2025', troughWindow: ['2025-03-01', '2025-06-30'] }
    ];

    const analyzeClimax = (data, name) => {
        console.log(`\n=== Volumen-Climax Analyse für ${name} ===`);
        for (const c of cycles) {
            let minClose = Infinity;
            let troughDate = '';
            let troughIdx = -1;

            for (let i = 0; i < data.length; i++) {
                if (data[i].date >= c.troughWindow[0] && data[i].date <= c.troughWindow[1]) {
                    if (data[i].close < minClose) {
                        minClose = data[i].close;
                        troughDate = data[i].date;
                        troughIdx = i;
                    }
                }
            }

            if (troughIdx === -1) continue;

            // Find max volume around trough (-5 to +2 days)
            let maxVol = 0;
            let climaxDate = '';
            let climaxIdx = -1;

            for (let i = Math.max(0, troughIdx - 5); i <= Math.min(data.length - 1, troughIdx + 2); i++) {
                if (data[i].volume > maxVol) {
                    maxVol = data[i].volume;
                    climaxDate = data[i].date;
                    climaxIdx = i;
                }
            }

            const getAvg = (days) => {
                if (climaxIdx - days < 0) return 0;
                let sum = 0;
                for(let i = climaxIdx - days; i < climaxIdx; i++) sum += data[i].volume;
                return sum / days;
            };

            const sma30 = getAvg(30);
            const sma90 = getAvg(90);
            
            if (sma30 > 0 && sma90 > 0) {
                console.log(`[${c.name}] Boden: ${troughDate}`);
                console.log(`   -> Climax-Tag: ${climaxDate} | Vol: ${maxVol.toLocaleString('de-DE')}`);
                console.log(`   -> Vielfaches (30D): ${(maxVol/sma30).toFixed(2)}x`);
                console.log(`   -> Vielfaches (90D): ${(maxVol/sma90).toFixed(2)}x`);
            }
        }
    };

    analyzeClimax(spy, 'SPY (S&P 500)');
    analyzeClimax(qqq, 'QQQ (Nasdaq 100)');
}

main().catch(console.error);
