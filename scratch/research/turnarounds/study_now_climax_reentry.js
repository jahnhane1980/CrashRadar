import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));

// Calculate SMA 50, SMA 200, EMA 20, RSI 14
function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) sma.push(null);
        else {
            let s = 0;
            for (let j = 0; j < period; j++) s += data[i - j].close;
            sma.push(s / period);
        }
    }
    return sma;
}

function calculateEMA(data, period) {
    const ema = [];
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) ema.push(null);
        else if (i === period - 1) {
            let s = 0;
            for (let j = 0; j < period; j++) s += data[i - j].close;
            prev = s / period;
            ema.push(prev);
        } else {
            const val = data[i].close * k + prev * (1 - k);
            ema.push(val);
            prev = val;
        }
    }
    return ema;
}

function calculateRSI(data, period = 14) {
    const rsi = new Array(data.length).fill(null);
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    rsi[period] = 100 - (100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss)));

    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi[i] = 100 - (100 / (1 + rs));
    }
    return rsi;
}

const sma50 = calculateSMA(quotes, 50);
const sma200 = calculateSMA(quotes, 200);
const ema20 = calculateEMA(quotes, 20);
const rsi = calculateRSI(quotes, 14);

console.log("================================================================================");
console.log("   FALLSTUDIE: SERVICENOW (NOW) 2024 - 2026 TOP & CRASH DYNAMIK");
console.log("   Untersuchung von Climax-Signalen am Allzeithoch ($228) und Re-Entry am Boden ($88)");
console.log("================================================================================\n");

// Look at dates around late 2024 (peak)
let maxPrice = 0;
let maxIdx = -1;

for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    if (q.date >= '2024-01-01' && q.close > maxPrice) {
        maxPrice = q.close;
        maxIdx = i;
    }
}

const peakQuote = quotes[maxIdx];
console.log(`Peak Quote: Date ${peakQuote.date}, Close: $${peakQuote.close.toFixed(2)}`);
console.log(`  EMA 20: $${ema20[maxIdx]?.toFixed(2)} (Distanz: ${(((peakQuote.close - ema20[maxIdx]) / ema20[maxIdx]) * 100).toFixed(1)}%)`);
console.log(`  SMA 50: $${sma50[maxIdx]?.toFixed(2)} (Distanz: ${(((peakQuote.close - sma50[maxIdx]) / sma50[maxIdx]) * 100).toFixed(1)}%)`);
console.log(`  SMA 200: $${sma200[maxIdx]?.toFixed(2)} (Distanz: ${(((peakQuote.close - sma200[maxIdx]) / sma200[maxIdx]) * 100).toFixed(1)}%)`);
console.log(`  RSI 14: ${rsi[maxIdx]?.toFixed(1)}`);

// Look at crash from peak
console.log("\nVerlauf nach dem Peak:");
let minPrice = maxPrice;
let minIdx = -1;

for (let i = maxIdx; i < quotes.length; i++) {
    const q = quotes[i];
    if (q.close < minPrice) {
        minPrice = q.close;
        minIdx = i;
    }
}

const bottomQuote = quotes[minIdx];
console.log(`Bottom Quote: Date ${bottomQuote.date}, Close: $${bottomQuote.close.toFixed(2)}`);
console.log(`  Drawdown vom Hoch: ${(((bottomQuote.close - peakQuote.close) / peakQuote.close) * 100).toFixed(1)}%`);
console.log(`  Distanz zu SMA 200 am Tief: ${(((bottomQuote.close - sma200[minIdx]) / sma200[minIdx]) * 100).toFixed(1)}%`);
console.log(`  RSI 14 am Tief: ${rsi[minIdx]?.toFixed(1)}`);

// Look at rebound
const lastQuote = quotes[quotes.length - 1];
console.log(`\nAktueller Stand (${lastQuote.date}): Close $${lastQuote.close.toFixed(2)}`);
console.log(`  Erholung vom Tief: +${(((lastQuote.close - bottomQuote.close) / bottomQuote.close) * 100).toFixed(1)}%`);
