import 'dotenv/config';
import mysql from 'mysql2/promise';

function calculateRSI(prices, period = 14) {
    let rsi = new Array(prices.length).fill(null);
    if (prices.length <= period) return rsi;

    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    rsi[period] = 100 - (100 / (1 + (avgGain / avgLoss)));

    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        if (avgLoss === 0) {
            rsi[i] = 100;
        } else {
            rsi[i] = 100 - (100 / (1 + (avgGain / avgLoss)));
        }
    }
    return rsi;
}

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    
    const [spyRows] = await db.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'SPY' AND record_date >= '2007-01-01' ORDER BY record_date ASC`);
    const [vixRows] = await db.query(`SELECT record_date as date, close FROM market_data_yahoo WHERE symbol = '^VIX' AND record_date >= '2007-01-01' ORDER BY record_date ASC`);
    const [cboeRows] = await db.query(`SELECT record_date as date, volume FROM market_data_cboe WHERE symbol = 'SPY' AND record_date >= '2007-01-01' ORDER BY record_date ASC`);
    db.end();

    const formatDate = (d) => {
        const date = new Date(d);
        return date.toISOString().split('T')[0];
    };

    const mapByDate = (rows, valKey) => {
        const m = {};
        for(const r of rows) m[formatDate(r.date)] = Number(r[valKey]);
        return m;
    };

    const vixMap = mapByDate(vixRows, 'close');
    const cboeMap = mapByDate(cboeRows, 'volume');

    const prices = spyRows.map(r => Number(r.close));
    const dates = spyRows.map(r => formatDate(r.date));
    const rsi = calculateRSI(prices, 14);

    console.log("Starte Backtest (2007-2026): VIX > 35 + CBOE > 1.5x + RSI Divergenz\n");

    let signalCount = 0;

    for (let i = 90; i < prices.length; i++) {
        const date = dates[i];
        const currentPrice = prices[i];
        const currentRsi = rsi[i];
        const currentVix = vixMap[date] || 0;
        const currentCboe = cboeMap[date] || 0;

        // 1. VIX Condition
        if (currentVix < 35) continue;

        // 2. CBOE Volume Spike Condition
        let sumVol = 0;
        let countVol = 0;
        for (let j = 1; j <= 90; j++) {
            const pastDate = dates[i - j];
            if (cboeMap[pastDate]) {
                sumVol += cboeMap[pastDate];
                countVol++;
            }
        }
        const sma90Vol = countVol > 0 ? sumVol / countVol : 0;
        if (sma90Vol === 0 || currentCboe < sma90Vol * 1.5) continue;

        // 3. RSI Divergence Condition
        let prevLowPrice = Infinity;
        let prevLowRsi = 0;
        
        for (let j = 5; j <= 40; j++) {
            if (prices[i - j] < prevLowPrice) {
                prevLowPrice = prices[i - j];
                prevLowRsi = rsi[i - j];
            }
        }

        const isNewLow = currentPrice <= prevLowPrice * 1.02; // at or below prev low (with 2% buffer)
        const isRsiHigher = currentRsi > prevLowRsi + 2;      // RSI is definitively higher

        if (isNewLow && isRsiHigher) {
            signalCount++;
            console.log(`[SIGNAL FEUERT] Datum: ${date}`);
            console.log(`  -> SPY Preis: $${currentPrice.toFixed(2)} (Prev Low: $${prevLowPrice.toFixed(2)})`);
            console.log(`  -> RSI: ${currentRsi.toFixed(1)} (Prev Low RSI: ${prevLowRsi.toFixed(1)}) -> BULLISH DIVERGENCE!`);
            console.log(`  -> VIX: ${currentVix.toFixed(2)}`);
            console.log(`  -> CBOE Vol: ${(currentCboe / sma90Vol).toFixed(2)}x Spike`);
            console.log("---------------------------------------------------------");
        }
    }
    
    console.log(`\nFertig. Das kombinierte Setup hat in fast 20 Jahren exakt ${signalCount} mal gefeuert.`);
}

main().catch(console.error);
