import 'dotenv/config';
import mysql from 'mysql2/promise';

const STOCKS = ['MSTR', 'MARA', 'RIOT', 'COIN', 'CLSK', 'HUT', 'IREN'];
const PEAK_DATE = '2025-10-06';
const END_DATE = '2026-06-26'; // current context

async function fetchTiingoData(symbol) {
    const url = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?startDate=2025-09-01&token=${process.env.TIINGO_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(d => ({
        date: d.date.split('T')[0],
        close: d.adjClose || d.close
    }));
}

async function getBTCData() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await db.query(`
        SELECT open_time, close 
        FROM market_data_binance 
        WHERE symbol = 'BTCUSDT' AND interval_type = '1d' 
        AND open_time >= UNIX_TIMESTAMP('2025-09-01') * 1000
        ORDER BY open_time ASC
    `);
    
    const btcData = rows.map(r => ({
        date: new Date(Number(r.open_time)).toISOString().split('T')[0],
        close: r.close
    }));
    db.end();
    return btcData;
}

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

async function main() {
    console.log(`\n=== Analyse des Bärenmarktes (Seit BTC-Peak am ${PEAK_DATE}) ===\n`);
    const btcRaw = await getBTCData();
    const btcMap = new Map();
    btcRaw.forEach(d => btcMap.set(d.date, d.close));

    const results = [];

    // Calculate BTC performance
    let btcPeakClose = btcMap.get(PEAK_DATE) || btcRaw.find(d => d.date >= PEAK_DATE)?.close;
    let btcCurrentClose = btcRaw[btcRaw.length - 1]?.close;
    let btcDrawdown = ((btcCurrentClose / btcPeakClose) - 1) * 100;
    
    console.log(`BTC Performance seit Peak: ${btcDrawdown.toFixed(2)}%`);

    for (const symbol of STOCKS) {
        const data = await fetchTiingoData(symbol);
        if (data.length === 0) continue;

        // Filter data since PEAK_DATE
        const windowData = data.filter(d => d.date >= PEAK_DATE);
        if (windowData.length === 0) continue;

        const peakClose = windowData[0].close;
        const currentClose = windowData[windowData.length - 1].close;
        const drawdown = ((currentClose / peakClose) - 1) * 100;

        // Calculate correlation with BTC in this specific period
        const syncStock = [];
        const syncBTC = [];
        for (let i = 1; i < windowData.length; i++) {
            const date = windowData[i].date;
            if (btcMap.has(date) && windowData[i-1].close > 0) {
                const prevDate = windowData[i-1].date;
                if(btcMap.has(prevDate)) {
                   const stockRet = (windowData[i].close / windowData[i-1].close) - 1;
                   const btcRet = (btcMap.get(date) / btcMap.get(prevDate)) - 1;
                   syncStock.push(stockRet);
                   syncBTC.push(btcRet);
                }
            }
        }
        
        const corr = calculateCorrelation(syncStock, syncBTC);
        results.push({ symbol, drawdown, corr });
    }

    // Sort by drawdown (worst to best)
    results.sort((a, b) => a.drawdown - b.drawdown);

    console.log(`\n--- Performance & Korrelation (Schlechteste bis Beste) ---`);
    console.table(results.map(r => ({
        "Aktie": r.symbol,
        "Performance seit Okt '25 (%)": r.drawdown.toFixed(2) + '%',
        "Korrelation mit BTC (Täglich)": r.corr.toFixed(2)
    })));
}

main().catch(console.error);
