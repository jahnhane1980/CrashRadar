import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'META_daily.json'), 'utf8'));

// Filter October 2022 to March 2023
const metaBottom = quotes.filter(q => q.date >= '2022-10-01' && q.date <= '2023-03-31');

console.log("================================================================================");
console.log("   DETEKTIV-ANALYSE: DER HISTORISCHE BODEN BEI META (OKTOBER 2022 - MÄRZ 2023)");
console.log("   Crash von $384 auf $88: Wann schlug der Spürhund an?");
console.log("================================================================================\n");

// Calculate 20-day average volume for each day
for (let i = 0; i < metaBottom.length; i++) {
    const q = metaBottom[i];
    const mainIdx = quotes.findIndex(item => item.date === q.date);
    let avgVol20 = 0;
    for (let j = 0; j < 20; j++) {
        avgVol20 += quotes[mainIdx - j].volume;
    }
    avgVol20 /= 20;
    const rvol = (q.volume / avgVol20).toFixed(1);

    const isNearBottom = q.close <= 95.0;
    const isExtremeVol = parseFloat(rvol) >= 2.0;

    let flag = "";
    if (q.date === '2022-10-27') flag = "💥 DIE META-EARNINGS-KAPITULATION! (-24% an einem Tag!)";
    else if (q.date === '2022-11-03' || q.date === '2022-11-04') flag = "🔴 ABSOLUTES CRASH-TIEF ($88,09)!";
    else if (q.date === '2022-11-09') flag = "⚡ ZUCKERBERG ENTLÄSST 11.000 MITARBEITER (WENDEPUNKT)!";
    else if (isExtremeVol) flag = "⚡ EXTREMES INSTITUTIONELLES VOLUMEN!";

    if (isNearBottom || isExtremeVol || flag !== "") {
        console.log(`${q.date} | O: ${q.open.toFixed(1).padStart(5)} | H: ${q.high.toFixed(1).padStart(5)} | L: ${q.low.toFixed(1).padStart(5)} | C: ${q.close.toFixed(1).padStart(5)} | Vol: ${(q.volume/1e6).toFixed(1).padStart(5)}M (RVOL: ${rvol.padStart(4)}x) | ${flag}`);
    }
}
