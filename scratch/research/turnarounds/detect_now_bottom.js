import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));

// Filter March to August 2026
const bottomPeriod = quotes.filter(q => q.date >= '2026-03-01' && q.date <= '2026-08-31');

console.log("================================================================================");
console.log("   DETEKTIV-ANALYSE: DER BODEN BEI SERVICENOW (MÄRZ BIS AUGUST 2026)");
console.log("   Warum stürzte sie auf $83 ab? Wann drehte sie? Was verriet das Volumen?");
console.log("================================================================================\n");

// Calculate 20-day average volume
for (let i = 0; i < bottomPeriod.length; i++) {
    const q = bottomPeriod[i];
    // Find index in main quotes
    const mainIdx = quotes.findIndex(item => item.date === q.date);
    let avgVol20 = 0;
    for (let j = 0; j < 20; j++) {
        avgVol20 += quotes[mainIdx - j].volume;
    }
    avgVol20 /= 20;
    const rvol = (q.volume / avgVol20).toFixed(1);

    const isBottom = q.close <= 85.0;
    const isBigVol = parseFloat(rvol) >= 2.0;

    const flag = isBottom ? '🔴 DAS TIEF ($83)!' : (isBigVol ? '⚡ INSTITUTIONELLES RIESEN-VOLUMEN!' : '');

    console.log(`${q.date} | O: ${q.open.toFixed(1).padStart(5)} | H: ${q.high.toFixed(1).padStart(5)} | L: ${q.low.toFixed(1).padStart(5)} | C: ${q.close.toFixed(1).padStart(5)} | Vol: ${(q.volume/1e6).toFixed(1).padStart(4)}M (RVOL: ${rvol.padStart(4)}x) | ${flag}`);
}
