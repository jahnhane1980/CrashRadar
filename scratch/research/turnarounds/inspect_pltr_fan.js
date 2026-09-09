import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data_cache');
const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'PLTR_daily.json'), 'utf8'));

// Check PLTR prices in late 2025 and 2026
const p2025 = quotes.filter(q => q.date >= '2025-09-01' && q.date <= '2026-03-01');
console.log(`PLTR candles from Sept 2025 to Feb 2026:`);
let maxPrice = 0;
let maxDate = '';
p2025.forEach(q => {
    if (q.high > maxPrice) {
        maxPrice = q.high;
        maxDate = q.date;
    }
});
console.log(`Peak was: $${maxPrice.toFixed(2)} on ${maxDate}`);

// Let's check SMA50 and distance around peak
function calculateSMA(prices, period) {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) sma.push(null);
        else {
            let s = 0;
            for (let j = 0; j < period; j++) s += prices[i - j];
            sma.push(s / period);
        }
    }
    return sma;
}
const closes = quotes.map(q => q.close);
const sma50 = calculateSMA(closes, 50);

p2025.filter(q => q.high >= 170).forEach(q => {
    const idx = quotes.findIndex(x => x.date === q.date);
    const s50 = sma50[idx];
    const dist = s50 ? ((q.close - s50) / s50) * 100 : 0;
    console.log(`  ${q.date}: Close $${q.close.toFixed(2)} (High $${q.high.toFixed(2)}) | SMA50 $${s50.toFixed(2)} | Dist: +${dist.toFixed(0)}%`);
});
