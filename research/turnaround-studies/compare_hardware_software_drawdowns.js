import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

const nvdaDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_daily.json'), 'utf8'));
const amdDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'AMD_daily.json'), 'utf8'));
const smhDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'SMH_daily.json'), 'utf8'));
const igvDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'IGV_daily.json'), 'utf8'));
const nowDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));
const crmDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'CRM_daily.json'), 'utf8'));

function findDrawdowns(quotes, thresholdPct = 25) {
    let peak = quotes[0].close;
    let peakDate = quotes[0].date;
    let trough = quotes[0].close;
    let troughDate = quotes[0].date;
    let inDd = false;

    const list = [];

    for (let i = 0; i < quotes.length; i++) {
        const q = quotes[i];
        if (q.close > peak) {
            if (inDd) {
                const drop = ((trough - peak) / peak) * 100;
                if (drop <= -thresholdPct) {
                    list.push({
                        peakDate,
                        peakPrice: peak,
                        troughDate,
                        troughPrice: trough,
                        dropPct: drop,
                        recoveryDate: q.date
                    });
                }
                inDd = false;
            }
            peak = q.close;
            peakDate = q.date;
            trough = q.close;
            troughDate = q.date;
        } else {
            const currentDrop = ((q.close - peak) / peak) * 100;
            if (currentDrop <= -thresholdPct) {
                inDd = true;
                if (q.close < trough) {
                    trough = q.close;
                    troughDate = q.date;
                }
            }
        }
    }

    if (inDd) {
        const drop = ((trough - peak) / peak) * 100;
        if (drop <= -thresholdPct) {
            list.push({
                peakDate,
                peakPrice: peak,
                troughDate,
                troughPrice: trough,
                dropPct: drop,
                recoveryDate: 'NOT YET RECOVERED'
            });
        }
    }

    return list;
}

function getPerfBetween(quotes, startDate, endDate) {
    const startQ = quotes.find(q => q.date >= startDate);
    const endQ = quotes.find(q => q.date >= endDate) || quotes[quotes.length - 1];
    if (!startQ || !endQ) return null;
    return ((endQ.close - startQ.close) / startQ.close) * 100;
}

console.log("==========================================================================================");
console.log(" HISTORISCHE NVIDIA CRASHES & VERGLEICH: WAS MACHTE SOFTWARE IM GLEICHEN ZEITRAUM?");
console.log("==========================================================================================\n");

const nvdaDrops = findDrawdowns(nvdaDaily, 25);

for (const dd of nvdaDrops) {
    const smhPerf = getPerfBetween(smhDaily, dd.peakDate, dd.troughDate);
    const igvPerf = getPerfBetween(igvDaily, dd.peakDate, dd.troughDate);
    const nowPerf = getPerfBetween(nowDaily, dd.peakDate, dd.troughDate);
    const crmPerf = getPerfBetween(crmDaily, dd.peakDate, dd.troughDate);

    console.log(`CRASH-PHASE: ${dd.peakDate} bis ${dd.troughDate} (Dauer: ${Math.round((new Date(dd.troughDate) - new Date(dd.peakDate)) / 86400000)} Tage)`);
    console.log(`  • NVDA: $${dd.peakPrice.toFixed(2)} -> $${dd.troughPrice.toFixed(2)} (${dd.dropPct.toFixed(1)}%) | Recovery: ${dd.recoveryDate}`);
    console.log(`  • SMH (Semis ETF):       ${smhPerf ? (smhPerf >= 0 ? '+' : '') + smhPerf.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  • IGV (Software ETF):    ${igvPerf ? (igvPerf >= 0 ? '+' : '') + igvPerf.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  • NOW (ServiceNow):      ${nowPerf ? (nowPerf >= 0 ? '+' : '') + nowPerf.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  • CRM (Salesforce):      ${crmPerf ? (crmPerf >= 0 ? '+' : '') + crmPerf.toFixed(1) + '%' : 'N/A'}`);
    console.log("------------------------------------------------------------------------------------------");
}

console.log("\n==========================================================================================");
console.log(" UMGEKEHRT: WAS MACHTE HARDWARE (NVDA / SMH), WÄHREND SOFTWARE CRASHTE?");
console.log("==========================================================================================\n");

const nowDrops = findDrawdowns(nowDaily, 25);
for (const dd of nowDrops) {
    const nvdaPerf = getPerfBetween(nvdaDaily, dd.peakDate, dd.troughDate);
    const smhPerf = getPerfBetween(smhDaily, dd.peakDate, dd.troughDate);
    const igvPerf = getPerfBetween(igvDaily, dd.peakDate, dd.troughDate);

    console.log(`NOW DRAWDOWN: ${dd.peakDate} bis ${dd.troughDate} (${dd.dropPct.toFixed(1)}%)`);
    console.log(`  • NOW:  $${dd.peakPrice.toFixed(2)} -> $${dd.troughPrice.toFixed(2)}`);
    console.log(`  • IGV:  ${igvPerf ? (igvPerf >= 0 ? '+' : '') + igvPerf.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  • NVDA: ${nvdaPerf ? (nvdaPerf >= 0 ? '+' : '') + nvdaPerf.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  • SMH:  ${smhPerf ? (smhPerf >= 0 ? '+' : '') + smhPerf.toFixed(1) + '%' : 'N/A'}`);
    console.log("------------------------------------------------------------------------------------------");
}
