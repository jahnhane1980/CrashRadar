import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    
    const [spyRows] = await db.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'SPY' ORDER BY record_date ASC`);
    const [vixRows] = await db.query(`SELECT record_date as date, close, high FROM market_data_yahoo WHERE symbol = '^VIX' ORDER BY record_date ASC`);
    db.end();

    const spy = spyRows.map(r => ({ date: r.date, close: Number(r.close) }));
    const vix = vixRows.map(r => ({ date: r.date, close: Number(r.close), high: Number(r.high) }));

    const cycles = [
        { name: 'Dotcom-Crash', troughWindow: ['2002-09-01', '2002-11-30'] },
        { name: 'Finanzkrise', troughWindow: ['2008-09-01', '2009-06-30'] },
        { name: 'Zins-Panik 2018', troughWindow: ['2018-12-01', '2019-01-31'] },
        { name: 'Corona-Crash 2020', troughWindow: ['2020-02-15', '2020-04-30'] },
        { name: 'Inflations-Schock 2022', troughWindow: ['2022-09-01', '2022-12-31'] },
        { name: 'Crash 2025', troughWindow: ['2025-03-01', '2025-06-30'] }
    ];

    console.log("=== VIX Crush Analyse an S&P 500 Tiefpunkten ===\n");

    for (const c of cycles) {
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

        let maxVix = 0;
        let vixPeak = '';

        for (let i = 0; i < vix.length; i++) {
            if (vix[i].date >= c.troughWindow[0] && vix[i].date <= c.troughWindow[1]) {
                if (vix[i].high > maxVix) { // using high of day
                    maxVix = vix[i].high;
                    vixPeak = vix[i].date;
                }
            }
        }

        if (spyTrough && vixPeak) {
            const diffDays = Math.round((new Date(spyTrough) - new Date(vixPeak)) / (1000 * 60 * 60 * 24));
            console.log(`[${c.name}]`);
            console.log(`VIX Peak: ${vixPeak} (Max: ${maxVix.toFixed(1)})`);
            console.log(`SPY Boden: ${spyTrough}`);
            console.log(`-> SPY Boden lag ${diffDays >= 0 ? diffDays + ' Tage NACH' : Math.abs(diffDays) + ' Tage VOR'} dem VIX Peak.`);
            console.log('---');
        }
    }
}

main().catch(console.error);
