import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NFLX_daily.json'), 'utf8'));

// Filter April 2022 to October 2022
const nflxBottom = quotes.filter(q => q.date >= '2022-04-01' && q.date <= '2022-10-31');

console.log("================================================================================");
console.log("   DETEKTIV-ANALYSE: DER HISTORISCHE BODEN BEI NETFLIX (APRIL - OKTOBER 2022)");
console.log("   Crash von $700 auf $162: Wann schlug der Spürhund an?");
console.log("================================================================================\n");

for (let i = 0; i < nflxBottom.length; i++) {
    const q = nflxBottom[i];
    const mainIdx = quotes.findIndex(item => item.date === q.date);
    let avgVol20 = 0;
    for (let j = 0; j < 20; j++) {
        avgVol20 += quotes[mainIdx - j].volume;
    }
    avgVol20 /= 20;
    const rvol = (q.volume / avgVol20).toFixed(1);

    const isExtremeVol = parseFloat(rvol) >= 2.0;
    const isNearBottom = q.close <= 180.0;

    let flag = "";
    if (q.date === '2022-04-20') flag = "💥 DIE NETFLIX-ABONNENTEN-KAPITULATION! (-35% an einem Tag!)";
    else if (q.date === '2022-05-11' || q.date === '2022-05-12') flag = "🔴 ABSOLUTES CRASH-TIEF ($162,71)!";
    else if (q.date === '2022-06-23' || q.date === '2022-06-30') flag = "🎯 WYCKOFF L2 RETEST (Higher Low bei $170-$175)";
    else if (q.date === '2022-07-20') flag = "⚡ EARNINGS-BEFREIUNG: WERBE-MODELL ANGEKÜNDIGT (+7% bei 3.5x Vol)!";
    else if (isExtremeVol) flag = "⚡ EXTREMES VOLUMEN!";

    if (isNearBottom || isExtremeVol || flag !== "") {
        console.log(`${q.date} | O: ${q.open.toFixed(1).padStart(5)} | H: ${q.high.toFixed(1).padStart(5)} | L: ${q.low.toFixed(1).padStart(5)} | C: ${q.close.toFixed(1).padStart(5)} | Vol: ${(q.volume/1e6).toFixed(1).padStart(5)}M (RVOL: ${rvol.padStart(4)}x) | ${flag}`);
    }
}
