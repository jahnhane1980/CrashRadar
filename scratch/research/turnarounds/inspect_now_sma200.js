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

console.log("Date | Close ($) | SMA 200 ($) | Diff SMA200 % | Event");
let brokeBelow = false;
let brokeAbove = false;

for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    if (q.date >= '2025-01-01') {
        const s = sma200[i];
        const diff = s ? ((q.close - s) / s) * 100 : 0;
        
        let evt = "";
        if (!brokeBelow && q.close < s) {
            brokeBelow = true;
            evt = "🔴 BRUCH UNTER SMA 200!";
        }
        if (brokeBelow && !brokeAbove && q.close > s) {
            brokeAbove = true;
            evt = "🟢 RÜCKEROBERUNG SMA 200!";
        }
        if (q.date === '2025-01-28' || q.date === '2026-04-10' || evt !== "") {
            console.log(`${q.date} | ${q.close.toFixed(2).padStart(9)} | ${s ? s.toFixed(2).padStart(11) : 'N/A'} | ${diff.toFixed(1).padStart(12)}% | ${evt}`);
        }
    }
}
