import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));

// Calculate SMA 200
const sma200 = [];
for (let i = 0; i < quotes.length; i++) {
    if (i < 199) sma200.push(null);
    else {
        let s = 0;
        for (let j = 0; j < 200; j++) s += quotes[i - j].close;
        sma200.push(s / 200);
    }
}

console.log("Date | Close ($) | SMA 200 ($) | Diff % | State");
let below = false;
for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    if (q.date >= '2025-01-01') {
        const s = sma200[i];
        if (!s) continue;
        const diff = ((q.close - s) / s) * 100;
        if (!below && q.close < s) {
            below = true;
            console.log(`${q.date} | ${q.close.toFixed(2).padStart(9)} | ${s.toFixed(2).padStart(11)} | ${diff.toFixed(1).padStart(6)}% | 🔴 KURS FÄLLT UNTER SMA 200`);
        } else if (below && q.close > s) {
            below = false;
            console.log(`${q.date} | ${q.close.toFixed(2).padStart(9)} | ${s.toFixed(2).padStart(11)} | ${diff.toFixed(1).padStart(6)}% | 🟢 KURS STEIGT ÜBER SMA 200`);
        }
    }
}
