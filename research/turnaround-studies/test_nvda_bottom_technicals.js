import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

const nvdaDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_daily.json'), 'utf8'));

// Helper for SMA and RVOL
function analyzeBottomTechnicals(quotes, troughDate) {
    const idx = quotes.findIndex(q => q.date >= troughDate);
    if (idx === -1) return null;

    // Calculate 50-day average volume before trough
    let volSum = 0;
    let count = 0;
    for (let i = Math.max(0, idx - 50); i < idx; i++) {
        volSum += quotes[i].volume;
        count++;
    }
    const avgVol = count > 0 ? volSum / count : 1;

    const troughDay = quotes[idx];
    const climaxRvol = troughDay.volume / avgVol;

    // Next 20 days volume
    let postVolSum = 0;
    let postCount = 0;
    for (let i = idx + 1; i < Math.min(quotes.length, idx + 21); i++) {
        postVolSum += quotes[i].volume;
        postCount++;
    }
    const postAvgRvol = (postVolSum / postCount) / avgVol;

    return {
        date: troughDay.date,
        price: troughDay.close,
        climaxRvol,
        postAvgRvol
    };
}

console.log("==========================================================================================");
console.log("   TECHNISCHER SPÜRHUND AN DEN HISTORISCHEN BODENPUNKTEN VON NVIDIA");
console.log("==========================================================================================");

const b2018 = analyzeBottomTechnicals(nvdaDaily, "2018-12-24");
console.log(`NVDA BODEN 2018: ${b2018.date} @ $${b2018.price.toFixed(2)} | Climax RVOL: ${b2018.climaxRvol.toFixed(2)}x | Trockenvolumen danach: ${b2018.postAvgRvol.toFixed(2)}x`);

const b2022 = analyzeBottomTechnicals(nvdaDaily, "2022-10-13");
console.log(`NVDA BODEN 2022: ${b2022.date} @ $${b2022.price.toFixed(2)} | Climax RVOL: ${b2022.climaxRvol.toFixed(2)}x | Trockenvolumen danach: ${b2022.postAvgRvol.toFixed(2)}x`);
