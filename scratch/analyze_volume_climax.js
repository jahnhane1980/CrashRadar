import 'dotenv/config';
import mysql from 'mysql2/promise';

function calculateCorrelation(x, y) {
    let n = x.length;
    if (n === 0) return 0;
    let sum_x = 0, sum_y = 0, sum_xy = 0, sum_x2 = 0, sum_y2 = 0;
    for (let i = 0; i < n; i++) {
        sum_x += x[i];
        sum_y += y[i];
        sum_xy += x[i] * y[i];
        sum_x2 += x[i] * x[i];
        sum_y2 += y[i] * y[i];
    }
    let num = n * sum_xy - sum_x * sum_y;
    let den = Math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y));
    if (den === 0) return 0;
    return num / den;
}

function processData(rows, isBTC = false) {
    return rows.map(r => {
        let dateStr;
        if (isBTC) {
            const d = new Date(Number(r.d));
            dateStr = d.toISOString().split('T')[0];
        } else {
            dateStr = r.d; // Tiingo is YYYY-MM-DD
        }
        return { date: dateStr, close: r.close, volume: r.volume };
    });
}

function calcReturns(dataMap, dates) {
    let returns = [];
    for (let i = 1; i < dates.length; i++) {
        const d0 = dates[i-1];
        const d1 = dates[i];
        if (dataMap.has(d0) && dataMap.has(d1)) {
            const r = (dataMap.get(d1).close / dataMap.get(d0).close) - 1;
            returns.push(r);
        } else {
            returns.push(null);
        }
    }
    return returns;
}

function findTrough(dataArray, startDate, endDate) {
    let minClose = Infinity;
    let minDate = null;
    let minIdx = -1;
    for(let i=0; i<dataArray.length; i++) {
        const d = dataArray[i];
        if (d.date >= startDate && d.date <= endDate) {
            if (d.close < minClose) {
                minClose = d.close;
                minDate = d.date;
                minIdx = i;
            }
        }
    }
    return { date: minDate, close: minClose, index: minIdx };
}

async function main() {
    console.log("Verbinde mit TiDB...");
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    
    // Fetch Data
    const btcRows = await db.query(`SELECT open_time as d, close, volume FROM market_data_binance WHERE symbol = 'BTCUSDT' AND interval_type = '1d' ORDER BY open_time ASC`);
    const mstrRows = await db.query(`SELECT record_date as d, close, volume FROM market_data_tiingo WHERE symbol = 'MSTR' ORDER BY record_date ASC`);
    const coinRows = await db.query(`SELECT record_date as d, close, volume FROM market_data_tiingo WHERE symbol = 'COIN' ORDER BY record_date ASC`);
    const spyRows = await db.query(`SELECT record_date as d, close, volume FROM market_data_tiingo WHERE symbol = 'SPY' ORDER BY record_date ASC`);
    const qqqRows = await db.query(`SELECT record_date as d, close, volume FROM market_data_tiingo WHERE symbol = 'QQQ' ORDER BY record_date ASC`);
    
    db.end();

    const btc = processData(btcRows[0], true);
    const mstr = processData(mstrRows[0]);
    const coin = processData(coinRows[0]);
    const spy = processData(spyRows[0]);
    const qqq = processData(qqqRows[0]);

    // Create maps for quick lookup
    const toMap = (arr) => { const m = new Map(); arr.forEach(x => m.set(x.date, x)); return m; };
    const bMap = toMap(btc);
    const mMap = toMap(mstr);
    const cMap = toMap(coin);
    const sMap = toMap(spy);
    const qMap = toMap(qqq);

    // Filter to common dates (trading days) where MSTR has data since 2017-08-17 (when BTC starts)
    const tradingDates = mstr.filter(d => d.date >= '2017-08-17').map(d => d.date);

    // Calculate returns
    const rBtc = calcReturns(bMap, tradingDates);
    const rMstr = calcReturns(mMap, tradingDates);
    const rCoin = calcReturns(cMap, tradingDates);
    const rSpy = calcReturns(sMap, tradingDates);
    const rQqq = calcReturns(qMap, tradingDates);

    // --- PART 1: CORRELATION ---
    console.log(`\n=== TEIL 1: Korrelations-Analyse (Wer treibt den Preis?) ===`);
    
    const filterNulls = (arr1, arr2) => {
        let clean1 = [], clean2 = [];
        for(let i=0; i<arr1.length; i++) {
            if (arr1[i] !== null && arr2[i] !== null) {
                clean1.push(arr1[i]); clean2.push(arr2[i]);
            }
        }
        return { c1: clean1, c2: clean2 };
    };

    let pMstrBtc = filterNulls(rMstr, rBtc);
    let pMstrSpy = filterNulls(rMstr, rSpy);
    let pMstrQqq = filterNulls(rMstr, rQqq);
    
    let pCoinBtc = filterNulls(rCoin, rBtc);
    let pCoinSpy = filterNulls(rCoin, rSpy);
    let pCoinQqq = filterNulls(rCoin, rQqq);

    console.log(`MSTR Korrelation mit BTC:   ${calculateCorrelation(pMstrBtc.c1, pMstrBtc.c2).toFixed(3)}`);
    console.log(`MSTR Korrelation mit QQQ:   ${calculateCorrelation(pMstrQqq.c1, pMstrQqq.c2).toFixed(3)}`);
    console.log(`MSTR Korrelation mit SPY:   ${calculateCorrelation(pMstrSpy.c1, pMstrSpy.c2).toFixed(3)}`);
    console.log(`---`);
    console.log(`COIN Korrelation mit BTC:   ${calculateCorrelation(pCoinBtc.c1, pCoinBtc.c2).toFixed(3)}`);
    console.log(`COIN Korrelation mit QQQ:   ${calculateCorrelation(pCoinQqq.c1, pCoinQqq.c2).toFixed(3)}`);
    console.log(`COIN Korrelation mit SPY:   ${calculateCorrelation(pCoinSpy.c1, pCoinSpy.c2).toFixed(3)}`);


    // --- PART 2: SELLING CLIMAX ---
    console.log(`\n=== TEIL 2: Selling Climax (Volumen-Analyse an den Crash-Tiefpunkten) ===`);
    
    // Add SMA-30 Volume to arrays
    const addSmaVol = (arr) => {
        for(let i=0; i<arr.length; i++) {
            let sum = 0;
            let count = 0;
            for(let j=Math.max(0, i-30); j<i; j++) {
                sum += arr[j].volume;
                count++;
            }
            arr[i].smaVol = count > 0 ? (sum / count) : arr[i].volume;
        }
    };
    addSmaVol(btc); addSmaVol(mstr); addSmaVol(coin);

    const crashes = [
        { name: '2020 Corona-Crash', start: '2020-02-15', end: '2020-04-15' },
        { name: '2022 FTX/Celsius', start: '2022-10-01', end: '2023-01-15' },
        { name: '2025 Crash', start: '2025-03-01', end: '2025-05-30' }
    ];

    const analyzeClimax = (assetName, arr) => {
        console.log(`\n--- ${assetName} ---`);
        for (const crash of crashes) {
            const trough = findTrough(arr, crash.start, crash.end);
            if (!trough.date) {
                console.log(`[${crash.name}] Keine Daten.`);
                continue;
            }
            
            // Check volume around the trough (+/- 2 days)
            let maxSpikeRatio = 0;
            let climaxDate = null;
            let climaxVol = 0;
            let normalVol = 0;

            for(let i = Math.max(0, trough.index - 2); i <= Math.min(arr.length - 1, trough.index + 2); i++) {
                const day = arr[i];
                if (day.smaVol > 0) {
                    const ratio = day.volume / day.smaVol;
                    if (ratio > maxSpikeRatio) {
                        maxSpikeRatio = ratio;
                        climaxDate = day.date;
                        climaxVol = day.volume;
                        normalVol = day.smaVol;
                    }
                }
            }

            const isClimax = maxSpikeRatio > 2.0; // Define climax as > 200% average
            const label = isClimax ? "🔥 SELLING CLIMAX!" : "Kein Climax";
            const diffDays = Math.round((new Date(climaxDate) - new Date(trough.date)) / (1000*60*60*24));
            
            console.log(`[${crash.name}] Tiefpunkt am: ${trough.date} | Volumen-Spike am: ${climaxDate} (${diffDays > 0 ? '+'+diffDays : diffDays} Tage)`);
            console.log(`   -> Ratio: ${(maxSpikeRatio*100).toFixed(0)}% vom 30D-Schnitt | Status: ${label}`);
        }
    };

    analyzeClimax('BTC (Binance)', btc);
    analyzeClimax('MSTR', mstr);
    analyzeClimax('COIN', coin);

}

main().catch(console.error);
