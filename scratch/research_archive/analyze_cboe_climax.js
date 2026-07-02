import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    
    const [spyRows] = await db.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'SPY' ORDER BY record_date ASC`);
    const [cboeRows] = await db.query(`SELECT record_date as date, volume FROM market_data_cboe WHERE symbol = 'SPY' ORDER BY record_date ASC`);
    db.end();

    const formatDate = (d) => {
        const date = new Date(d);
        return date.toISOString().split('T')[0];
    };
    const spy = spyRows.map(r => ({ date: formatDate(r.date), close: Number(r.close) }));
    const cboe = cboeRows.map(r => ({ date: formatDate(r.date), volume: Number(r.volume) }));

    if (cboe.length === 0) {
        console.log("Noch keine CBOE Daten in der DB.");
        return;
    }

    const minCboeDate = cboe[0].date;
    console.log(`CBOE Daten verfügbar ab: ${minCboeDate}`);

    const cycles = [
        { name: 'Finanzkrise', troughWindow: ['2008-09-01', '2009-06-30'] },
        { name: 'Zins-Panik 2018', troughWindow: ['2018-12-01', '2019-01-31'] },
        { name: 'Corona-Crash 2020', troughWindow: ['2020-02-15', '2020-04-30'] },
        { name: 'Inflations-Schock 2022', troughWindow: ['2022-09-01', '2022-12-31'] },
        { name: 'Crash 2025', troughWindow: ['2025-03-01', '2025-06-30'] }
    ];

    console.log("\n=== CBOE Options-Volumen Climax Analyse für SPY ===");

    for (const c of cycles) {
        if (minCboeDate > c.troughWindow[1]) continue;

        let minSpy = Infinity;
        let spyTrough = '';

        for (let i = 0; i < spy.length; i++) {
            if (spy[i].date >= c.troughWindow[0] && spy[i].date <= c.troughWindow[1]) {
                if (spy[i].close < minSpy) {
                    minSpy = spy[i].close;
                    spyTrough = spy[i].date;
                }
            }
        }

        // Fallback for troughIdx if exact date is missing (weekend/holiday)
        let troughIdx = -1;
        for (let i = 0; i < cboe.length; i++) {
            if (cboe[i].date >= spyTrough) {
                troughIdx = i;
                break;
            }
        }

        if (troughIdx === -1) {
             console.log(`[${c.name}] Konnte kein passendes CBOE-Datum für den Boden am ${spyTrough} finden.`);
             continue;
        }

        // Search for highest volume around the trough (-5 to +2 days)
        let maxVol = 0;
        let climaxDate = '';
        let climaxIdx = -1;

        for (let i = Math.max(0, troughIdx - 5); i <= Math.min(cboe.length - 1, troughIdx + 2); i++) {
            if (cboe[i].volume > maxVol) {
                maxVol = cboe[i].volume;
                climaxDate = cboe[i].date;
                climaxIdx = i;
            }
        }

        const getAvg = (days) => {
            if (climaxIdx - days < 0) return 0;
            let sum = 0;
            for(let i = climaxIdx - days; i < climaxIdx; i++) sum += cboe[i].volume;
            return sum / days;
        };

        const sma30 = getAvg(30);
        const sma90 = getAvg(90);
        
        console.log(`[${c.name}] SPY Boden: ${spyTrough}`);
        console.log(`   -> Climax-Tag (Optionsvolumen): ${climaxDate} | Vol: ${maxVol.toLocaleString('de-DE')}`);
        if (sma30) console.log(`   -> Vielfaches (30D SMA): ${(maxVol/sma30).toFixed(2)}x`);
        if (sma90) console.log(`   -> Vielfaches (90D SMA): ${(maxVol/sma90).toFixed(2)}x`);
    }
}

main().catch(console.error);
