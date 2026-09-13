import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/architecture/strategies/cache');

const smhQuotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'SMH_2014-10-01_2026-09-06.json'), 'utf8'));
const igvQuotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'IGV_2014-10-01_2026-09-06.json'), 'utf8'));
const nvdaQuotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_2014-10-01_2026-09-06.json'), 'utf8'));

console.log("================================================================================");
console.log("   EMPIRISCHE PHASEN-ANALYSE: HARDWARE (SMH/NVDA) VS. SOFTWARE (IGV)");
console.log("   Untersuchung der Zyklen: 2018, 2020-2022, 2023-2026");
console.log("================================================================================\n");

// Helper to find peaks and troughs in a date range
function findExtremes(quotes, startDate, endDate) {
    const subset = quotes.filter(q => q.date >= startDate && q.date <= endDate);
    if (subset.length === 0) return null;

    let peak = subset[0];
    let trough = subset[0];

    for (const q of subset) {
        if (q.close > peak.close) peak = q;
        if (q.close < trough.close) trough = q;
    }
    return { peak, trough };
}

// 1. ZYKLUS 2018 (Fed QT & Krypto-Kater)
console.log("--- 1. DER ZYKLUS 2018 ---");
const smh2018 = findExtremes(smhQuotes, '2018-01-01', '2018-12-31');
const igv2018 = findExtremes(igvQuotes, '2018-01-01', '2018-12-31');
const nvda2018 = findExtremes(nvdaQuotes, '2018-01-01', '2019-01-31');

console.log(`SMH (Halbleiter) Peak:  ${smh2018.peak.date} ($${smh2018.peak.close.toFixed(2)}) | Tief: ${smh2018.trough.date} ($${smh2018.trough.close.toFixed(2)}) -> Drawdown: ${(((smh2018.trough.close - smh2018.peak.close) / smh2018.peak.close) * 100).toFixed(1)}%`);
console.log(`NVDA (GPU Hardware) Peak:${nvda2018.peak.date} ($${nvda2018.peak.close.toFixed(2)}) | Tief: ${nvda2018.trough.date} ($${nvda2018.trough.close.toFixed(2)}) -> Drawdown: ${(((nvda2018.trough.close - nvda2018.peak.close) / nvda2018.peak.close) * 100).toFixed(1)}%`);
console.log(`IGV (Software) Peak:    ${igv2018.peak.date} ($${igv2018.peak.close.toFixed(2)}) | Tief: ${igv2018.trough.date} ($${igv2018.trough.close.toFixed(2)}) -> Drawdown: ${(((igv2018.trough.close - igv2018.peak.close) / igv2018.peak.close) * 100).toFixed(1)}%`);

// 2. ZYKLUS 2021 - 2022 (Bullen-Zenit & Großer Bärenmarkt)
console.log("\n--- 2. DER GROSSE BÄRENMARKT 2021 - 2022 ---");
const smh2021 = findExtremes(smhQuotes, '2021-01-01', '2022-12-31');
const igv2021 = findExtremes(igvQuotes, '2021-01-01', '2022-12-31');
const nvda2021 = findExtremes(nvdaQuotes, '2021-01-01', '2022-12-31');

console.log(`IGV (Software) Peak:    ${igv2021.peak.date} ($${igv2021.peak.close.toFixed(2)}) | Tief: ${igv2021.trough.date} ($${igv2021.trough.close.toFixed(2)}) -> Drawdown: ${(((igv2021.trough.close - igv2021.peak.close) / igv2021.peak.close) * 100).toFixed(1)}%`);
console.log(`SMH (Halbleiter) Peak:  ${smh2021.peak.date} ($${smh2021.peak.close.toFixed(2)}) | Tief: ${smh2021.trough.date} ($${smh2021.trough.close.toFixed(2)}) -> Drawdown: ${(((smh2021.trough.close - smh2021.peak.close) / smh2021.peak.close) * 100).toFixed(1)}%`);
console.log(`NVDA (GPU Hardware) Peak:${nvda2021.peak.date} ($${nvda2021.peak.close.toFixed(2)}) | Tief: ${nvda2021.trough.date} ($${nvda2021.trough.close.toFixed(2)}) -> Drawdown: ${(((nvda2021.trough.close - nvda2021.peak.close) / nvda2021.peak.close) * 100).toFixed(1)}%`);

// 3. ZYKLUS 2023 - 2026 (KI-Capex Boom)
console.log("\n--- 3. DER KI-ZYKLUS 2023 - 2026 ---");
const smhRecent = findExtremes(smhQuotes, '2023-01-01', '2026-09-04');
const igvRecent = findExtremes(igvQuotes, '2023-01-01', '2026-09-04');
const nvdaRecent = findExtremes(nvdaQuotes, '2023-01-01', '2026-09-04');

console.log(`NVDA (GPU Hardware) Peak:${nvdaRecent.peak.date} ($${nvdaRecent.peak.close.toFixed(2)}) | Tief: ${nvdaRecent.trough.date} ($${nvdaRecent.trough.close.toFixed(2)})`);
console.log(`SMH (Halbleiter) Peak:  ${smhRecent.peak.date} ($${smhRecent.peak.close.toFixed(2)}) | Tief: ${smhRecent.trough.date} ($${smhRecent.trough.close.toFixed(2)})`);
console.log(`IGV (Software) Peak:    ${igvRecent.peak.date} ($${igvRecent.peak.close.toFixed(2)}) | Tief: ${igvRecent.trough.date} ($${igvRecent.trough.close.toFixed(2)})`);
