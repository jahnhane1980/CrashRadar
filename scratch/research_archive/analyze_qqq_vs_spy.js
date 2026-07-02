import 'dotenv/config';
import mysql from 'mysql2/promise';

function findExtremes(dataArray, startDate, endDate) {
    let maxClose = -Infinity;
    let maxDate = null;
    let minClose = Infinity;
    let minDate = null;
    
    for(let i=0; i<dataArray.length; i++) {
        const d = dataArray[i];
        if (d.date >= startDate && d.date <= endDate) {
            if (d.close > maxClose) {
                maxClose = d.close;
                maxDate = d.date;
            }
            if (d.close < minClose) {
                minClose = d.close;
                minDate = d.date;
            }
        }
    }
    return { maxDate, maxClose, minDate, minClose };
}

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    
    const spyRows = await db.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'SPY' ORDER BY record_date ASC`);
    const qqqRows = await db.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'QQQ' ORDER BY record_date ASC`);
    db.end();

    const spy = spyRows[0].map(r => ({ date: r.date, close: Number(r.close) }));
    const qqq = qqqRows[0].map(r => ({ date: r.date, close: Number(r.close) }));

    const cycles = [
        { name: 'Dotcom-Crash', peakWindow: ['1999-12-01', '2000-09-01'], troughWindow: ['2001-01-01', '2003-03-31'] },
        { name: 'Finanzkrise', peakWindow: ['2007-06-01', '2008-01-31'], troughWindow: ['2008-10-01', '2009-06-30'] },
        { name: 'Zins-Panik 2018', peakWindow: ['2018-08-01', '2018-10-31'], troughWindow: ['2018-11-01', '2019-01-31'] },
        { name: 'Corona-Crash 2020', peakWindow: ['2020-01-01', '2020-02-28'], troughWindow: ['2020-03-01', '2020-04-30'] },
        { name: 'Inflations-Schock 2022', peakWindow: ['2021-10-01', '2022-02-28'], troughWindow: ['2022-09-01', '2022-12-31'] },
        { name: 'Crash 2025', peakWindow: ['2024-11-01', '2025-03-31'], troughWindow: ['2025-03-01', '2025-06-30'] }
    ];

    console.log("=== Analyse: QQQ (Nasdaq) vs SPY (S&P 500) an Makro-Wendepunkten ===\n");

    const getDaysDiff = (d1, d2) => Math.round((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));

    for (const c of cycles) {
        const pSpy = findExtremes(spy, c.peakWindow[0], c.peakWindow[1]);
        const pQqq = findExtremes(qqq, c.peakWindow[0], c.peakWindow[1]);
        
        const tSpy = findExtremes(spy, c.troughWindow[0], c.troughWindow[1]);
        const tQqq = findExtremes(qqq, c.troughWindow[0], c.troughWindow[1]);

        if (!pSpy.maxDate || !pQqq.maxDate || !tSpy.minDate || !tQqq.minDate) continue;

        // Positive diff means QQQ was earlier
        const peakDiff = getDaysDiff(pSpy.maxDate, pQqq.maxDate);
        const troughDiff = getDaysDiff(tSpy.minDate, tQqq.minDate);

        console.log(`[${c.name}]`);
        
        // Peak Evaluation
        let peakResult = peakDiff > 0 ? `QQQ führte um ${peakDiff} Tage` : (peakDiff < 0 ? `SPY führte um ${Math.abs(peakDiff)} Tage` : "Synchron (gleicher Tag)");
        console.log(`  TOP (Peak)   | SPY: ${pSpy.maxDate} | QQQ: ${pQqq.maxDate} -> ${peakResult}`);

        // Trough Evaluation
        let troughResult = troughDiff > 0 ? `QQQ führte um ${troughDiff} Tage` : (troughDiff < 0 ? `SPY führte um ${Math.abs(troughDiff)} Tage` : "Synchron (gleicher Tag)");
        console.log(`  BOTTOM       | SPY: ${tSpy.minDate} | QQQ: ${tQqq.minDate} -> ${troughResult}`);
        console.log('------------------------------------------------------------------');
    }
}

main().catch(console.error);
