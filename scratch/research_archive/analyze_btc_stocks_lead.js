import 'dotenv/config';
import mysql from 'mysql2/promise';

const SYMBOLS = ['MSTR', 'MARA', 'RIOT', 'COIN'];

// Helper to calculate Pearson correlation
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

// Fetch Tiingo Data
async function fetchTiingoData(symbol) {
    const url = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?startDate=2017-08-17&token=${process.env.TIINGO_API_KEY}`;
    console.log(`Lade Tiingo Daten für ${symbol}...`);
    const res = await fetch(url);
    if (!res.ok) {
        console.error(`Fehler bei ${symbol}: ${res.statusText}`);
        return [];
    }
    const data = await res.json();
    return data.map(d => ({
        date: d.date.split('T')[0],
        close: d.adjClose || d.close
    }));
}

async function getBTCData() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    console.log(`Lade BTC Daten aus TiDB...`);
    // We assume 1d interval data. If not 1d, this query will fail or return empty, we'll handle it.
    const [rows] = await db.query(`
        SELECT open_time, close, interval_type
        FROM market_data_binance 
        WHERE symbol = 'BTCUSDT' AND interval_type = '1d'
        ORDER BY open_time ASC
    `);
    
    // Convert to Date string
    const btcData = rows.map(r => {
        const d = new Date(Number(r.open_time));
        return {
            date: d.toISOString().split('T')[0],
            close: r.close
        };
    });
    
    db.end();
    return btcData;
}

// Find Peak/Trough within a specific window
function findExtremes(data, startIdx, endIdx) {
    let maxVal = -Infinity, minVal = Infinity;
    let maxDate = null, minDate = null;
    
    for (let i = startIdx; i <= endIdx; i++) {
        if (!data[i]) continue;
        if (data[i].close > maxVal) { maxVal = data[i].close; maxDate = data[i].date; }
        if (data[i].close < minVal) { minVal = data[i].close; minDate = data[i].date; }
    }
    return { maxDate, minDate };
}

async function main() {
    const btcRaw = await getBTCData();
    if (btcRaw.length === 0) {
        console.error("Keine BTC 1d Daten gefunden!");
        return;
    }
    
    // Map BTC data by date for quick lookup
    const btcMap = new Map();
    btcRaw.forEach(d => btcMap.set(d.date, d.close));
    
    // Define some major crash windows for peak/trough analysis based on Analyse.md
    const crashWindows = [
        { name: '2018 Crypto Winter', start: '2017-10-01', end: '2019-02-01' },
        { name: '2020 Corona', start: '2020-01-01', end: '2020-05-01' },
        { name: '2021 China Ban', start: '2021-03-01', end: '2021-09-01' },
        { name: '2022 FTX/Celsius', start: '2021-10-01', end: '2023-01-01' },
        { name: '2025 Crash', start: '2024-12-01', end: '2025-06-01' }
    ];

    for (const symbol of SYMBOLS) {
        console.log(`\n=========================================`);
        console.log(`Analysiere ${symbol} vs. BTC`);
        console.log(`=========================================`);
        
        const stockData = await fetchTiingoData(symbol);
        if (stockData.length === 0) continue;
        
        // 1. Sync data (only trading days)
        const syncedData = [];
        for (let i = 0; i < stockData.length; i++) {
            const date = stockData[i].date;
            if (btcMap.has(date)) {
                syncedData.push({
                    date: date,
                    stockClose: stockData[i].close,
                    btcClose: btcMap.get(date)
                });
            }
        }
        
        console.log(`Synchronisierte Handelstage: ${syncedData.length}`);
        
        // 2. Calculate daily returns
        const returns = [];
        for (let i = 1; i < syncedData.length; i++) {
            const stockRet = (syncedData[i].stockClose / syncedData[i-1].stockClose) - 1;
            const btcRet = (syncedData[i].btcClose / syncedData[i-1].btcClose) - 1;
            returns.push({ date: syncedData[i].date, stockRet, btcRet });
        }
        
        // 3. Shifted Correlation
        // k = -5 to +5
        // If k = -1, we compare Stock[t] with BTC[t+1] -> Stock leads BTC by 1 day
        // If k = +1, we compare Stock[t] with BTC[t-1] -> BTC leads Stock by 1 day
        console.log(`\n--- Kreuzkorrelation (Lead/Lag) ---`);
        for (let k = -5; k <= 5; k++) {
            const arrStock = [];
            const arrBTC = [];
            
            for (let i = 0; i < returns.length; i++) {
                const targetBtcIdx = i + k;
                if (targetBtcIdx >= 0 && targetBtcIdx < returns.length) {
                    arrStock.push(returns[i].stockRet);
                    arrBTC.push(returns[targetBtcIdx].btcRet);
                }
            }
            
            const corr = calculateCorrelation(arrStock, arrBTC);
            let leadStr = k === 0 ? "Synchron" : (k < 0 ? `${symbol} FÜHRT um ${Math.abs(k)} Tag(e)` : `BTC FÜHRT um ${k} Tag(e)`);
            console.log(`Shift ${k > 0 ? '+'+k : k} Tage (${leadStr.padEnd(20)}): Korrelation = ${corr.toFixed(4)}`);
        }
        
        // 4. Peak/Trough Analysis
        console.log(`\n--- Wendepunkt-Analyse (Wer drehte zuerst?) ---`);
        for (const w of crashWindows) {
            // Find data in window
            const windowStock = syncedData.filter(d => d.date >= w.start && d.date <= w.end);
            if (windowStock.length < 10) continue; // Not enough data (e.g. COIN in 2018)
            
            let stockMax = -Infinity, stockMaxDate = null;
            let btcMax = -Infinity, btcMaxDate = null;
            
            let stockMin = Infinity, stockMinDate = null;
            let btcMin = Infinity, btcMinDate = null;
            
            windowStock.forEach(d => {
                if (d.stockClose > stockMax) { stockMax = d.stockClose; stockMaxDate = d.date; }
                if (d.btcClose > btcMax) { btcMax = d.btcClose; btcMaxDate = d.date; }
                
                if (d.stockClose < stockMin) { stockMin = d.stockClose; stockMinDate = d.date; }
                if (d.btcClose < btcMin) { btcMin = d.btcClose; btcMinDate = d.date; }
            });
            
            // Calculate differences in days
            const getDaysDiff = (d1, d2) => Math.round((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));
            
            const peakDiff = getDaysDiff(btcMaxDate, stockMaxDate); // Positive if Stock was earlier
            const troughDiff = getDaysDiff(btcMinDate, stockMinDate); // Positive if Stock was earlier
            
            const peakLeader = peakDiff > 0 ? `${symbol} führte um ${peakDiff} Tage` : (peakDiff < 0 ? `BTC führte um ${Math.abs(peakDiff)} Tage` : "Gleicher Tag");
            const troughLeader = troughDiff > 0 ? `${symbol} führte um ${troughDiff} Tage` : (troughDiff < 0 ? `BTC führte um ${Math.abs(troughDiff)} Tage` : "Gleicher Tag");
            
            console.log(`[${w.name}] PEAK  : BTC am ${btcMaxDate}, ${symbol} am ${stockMaxDate} -> ${peakLeader}`);
            console.log(`[${w.name}] TROUGH: BTC am ${btcMinDate}, ${symbol} am ${stockMinDate} -> ${troughLeader}`);
        }
    }
}

main().catch(console.error);
