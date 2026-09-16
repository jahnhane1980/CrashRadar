import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(REPO_ROOT, 'data/cache/turnarounds');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NFLX_daily.json'), 'utf8'));

// Filter April 18 to May 20, 2022
const nflxApril = quotes.filter(q => q.date >= '2022-04-18' && q.date <= '2022-05-20');

for (const q of nflxApril) {
    const mainIdx = quotes.findIndex(item => item.date === q.date);
    let avgVol20 = 0;
    for (let j = 0; j < 20; j++) {
        avgVol20 += quotes[mainIdx - j].volume;
    }
    avgVol20 /= 20;
    const rvol = (q.volume / avgVol20).toFixed(1);
    console.log(`${q.date} | O: ${q.open.toFixed(1).padStart(5)} | H: ${q.high.toFixed(1).padStart(5)} | L: ${q.low.toFixed(1).padStart(5)} | C: ${q.close.toFixed(1).padStart(5)} | Vol: ${(q.volume/1e6).toFixed(1).padStart(5)}M (RVOL: ${rvol.padStart(4)}x)`);
}
