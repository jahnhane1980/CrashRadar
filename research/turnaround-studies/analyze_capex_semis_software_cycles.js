import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

// Load cached data
const msftFacts = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'MSFT_sec_facts.json'), 'utf8'));
const googlFacts = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'GOOGL_sec_facts.json'), 'utf8'));
const metaFacts = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'META_sec_facts.json'), 'utf8'));
const amznFacts = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'AMZN_sec_facts.json'), 'utf8'));
const nvdaFacts = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_sec_facts.json'), 'utf8'));

const nvdaDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_daily.json'), 'utf8'));
const amdDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'AMD_daily.json'), 'utf8'));
const smhDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'SMH_daily.json'), 'utf8'));
const igvDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'IGV_daily.json'), 'utf8'));
const nowDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));
const msftDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'MSFT_daily.json'), 'utf8'));

// Helper to get discrete quarterly CapEx from US-GAAP cash flows
function extractDiscreteCapEx(facts, tags) {
    const usGaap = facts?.facts?.['us-gaap'] || {};
    let units = null;
    for (const tag of tags) {
        if (usGaap[tag]?.units?.USD) {
            units = usGaap[tag].units.USD;
            break;
        }
    }
    if (!units) return [];

    // Filter valid entries
    const items = units
        .filter(u => u.start && u.end && (u.form === '10-Q' || u.form === '10-K'))
        .map(u => ({
            start: u.start,
            end: u.end,
            val: u.val,
            days: (new Date(u.end) - new Date(u.start)) / 86400000,
            form: u.form,
            fy: u.fy,
            fp: u.fp,
            filed: u.filed
        }));

    // Pass 1: exact ~3 month quarters (70 to 110 days)
    const quarterly = new Map();
    for (const it of items) {
        if (it.days >= 70 && it.days <= 110) {
            // Keep the latest filed version for a given end date
            const existing = quarterly.get(it.end);
            if (!existing || (it.filed && it.filed > existing.filed)) {
                quarterly.set(it.end, it);
            }
        }
    }

    // Pass 2: deduce Q2/Q3/Q4 from cumulative filings if missing
    // Sort all cumulative items by fy
    const byFy = new Map();
    for (const it of items) {
        if (!it.fy) continue;
        if (!byFy.has(it.fy)) byFy.set(it.fy, []);
        byFy.get(it.fy).push(it);
    }

    for (const [fy, list] of byFy.entries()) {
        const q1 = list.find(x => x.fp === 'Q1' && x.days >= 70 && x.days <= 110);
        const q2Cum = list.find(x => x.fp === 'Q2' && x.days >= 160 && x.days <= 200);
        const q3Cum = list.find(x => x.fp === 'Q3' && x.days >= 250 && x.days <= 290);
        const fyFull = list.find(x => x.fp === 'FY' && x.days >= 340 && x.days <= 380);

        if (q1 && q2Cum && !quarterly.has(q2Cum.end)) {
            quarterly.set(q2Cum.end, {
                start: q1.end,
                end: q2Cum.end,
                val: q2Cum.val - q1.val,
                days: 90,
                fy,
                fp: 'Q2 (calc)'
            });
        }
        if (q2Cum && q3Cum && !quarterly.has(q3Cum.end)) {
            quarterly.set(q3Cum.end, {
                start: q2Cum.end,
                end: q3Cum.end,
                val: q3Cum.val - q2Cum.val,
                days: 90,
                fy,
                fp: 'Q3 (calc)'
            });
        }
        if (q3Cum && fyFull && !quarterly.has(fyFull.end)) {
            quarterly.set(fyFull.end, {
                start: q3Cum.end,
                end: fyFull.end,
                val: fyFull.val - q3Cum.val,
                days: 90,
                fy,
                fp: 'Q4 (calc)'
            });
        }
    }

    return Array.from(quarterly.values()).sort((a, b) => a.end.localeCompare(b.end));
}

// Extract CapEx for each hyperscaler
const msftCap = extractDiscreteCapEx(msftFacts, ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets']);
const googlCap = extractDiscreteCapEx(googlFacts, ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets']);
const metaCap = extractDiscreteCapEx(metaFacts, ['PaymentsToAcquirePropertyPlantAndEquipment']);
const amznCap = extractDiscreteCapEx(amznFacts, ['PaymentsToAcquireProductiveAssets', 'PaymentsToAcquirePropertyPlantAndEquipment']);

// Extract NVDA Revenues
const nvdaRevs = (() => {
    const usGaap = nvdaFacts?.facts?.['us-gaap'] || {};
    const u = usGaap['Revenues']?.units?.USD || [];
    const quarters = u.filter(x => x.start && x.end && ((new Date(x.end) - new Date(x.start)) / 86400000) >= 70 && ((new Date(x.end) - new Date(x.start)) / 86400000) <= 105);
    const map = new Map();
    for (const q of quarters) {
        const ex = map.get(q.end);
        if (!ex || (q.filed && q.filed > ex.filed)) map.set(q.end, q);
    }
    return Array.from(map.values()).sort((a,b) => a.end.localeCompare(b.end));
})();

// Helper to find price around date
function getClosePrice(quotes, targetDate) {
    const q = quotes.find(x => x.date >= targetDate);
    return q ? q.close : null;
}

console.log("==========================================================================================");
console.log(" TEIL 1: HYPERSCALER CAPEX vs. NVIDIA UMSATZ & KURS (2018 - 2026)");
console.log("==========================================================================================");

// Map timeline by quarters (Q1 = ~03-31, Q2 = ~06-30, Q3 = ~09-30, Q4 = ~12-31)
const timelineQuarters = [
    '2018-03-31', '2018-06-30', '2018-09-30', '2018-12-31',
    '2019-03-31', '2019-06-30', '2019-09-30', '2019-12-31',
    '2020-03-31', '2020-06-30', '2020-09-30', '2020-12-31',
    '2021-03-31', '2021-06-30', '2021-09-30', '2021-12-31',
    '2022-03-31', '2022-06-30', '2022-09-30', '2022-12-31',
    '2023-03-31', '2023-06-30', '2023-09-30', '2023-12-31',
    '2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31',
    '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31',
    '2026-03-31', '2026-06-30'
];

function findQuarterVal(list, quarterEnd) {
    const target = new Date(quarterEnd).getTime();
    const match = list.find(x => Math.abs(new Date(x.end).getTime() - target) <= 45 * 86400000);
    return match ? match.val : null;
}

const tableData = [];

for (const qEnd of timelineQuarters) {
    const mCap = findQuarterVal(msftCap, qEnd) || 0;
    const gCap = findQuarterVal(googlCap, qEnd) || 0;
    const fbCap = findQuarterVal(metaCap, qEnd) || 0;
    const aCap = findQuarterVal(amznCap, qEnd) || 0;
    const totalCap = mCap + gCap + fbCap + aCap;

    const nRev = findQuarterVal(nvdaRevs, qEnd) || 0;
    const nvdaClose = getClosePrice(nvdaDaily, qEnd);
    const smhClose = getClosePrice(smhDaily, qEnd);
    const igvClose = getClosePrice(igvDaily, qEnd);
    const nowClose = getClosePrice(nowDaily, qEnd);

    tableData.push({
        quarter: qEnd,
        msftCap: mCap / 1e9,
        googlCap: gCap / 1e9,
        metaCap: fbCap / 1e9,
        amznCap: aCap / 1e9,
        totalCapExB: totalCap / 1e9,
        nvdaRevB: nRev / 1e9,
        nvdaPrice: nvdaClose,
        smhPrice: smhClose,
        igvPrice: igvClose,
        nowPrice: nowClose,
        ratioSemiSoftware: (smhClose && igvClose) ? (smhClose / igvClose) : null
    });
}

// Calculate YoY for CapEx
for (let i = 0; i < tableData.length; i++) {
    const curr = tableData[i];
    const prev = tableData[i - 4];
    if (prev && prev.totalCapExB > 0) {
        curr.capexYoY = ((curr.totalCapExB - prev.totalCapExB) / prev.totalCapExB) * 100;
    } else {
        curr.capexYoY = null;
    }
}

console.log("Quartal    | Hyperscaler CapEx ($B) | CapEx YoY% | NVDA Rev ($B) | NVDA Kurs | SMH / IGV Ratio | Regime / Phase");
console.log("------------------------------------------------------------------------------------------------------------------");
for (const r of tableData) {
    const qStr = r.quarter;
    const capStr = r.totalCapExB > 0 ? r.totalCapExB.toFixed(1).padStart(12) : '        N/A';
    const yoyStr = r.capexYoY !== null ? (r.capexYoY >= 0 ? '+' : '') + r.capexYoY.toFixed(1) + '%' : '     N/A';
    const nRevStr = r.nvdaRevB > 0 ? r.nvdaRevB.toFixed(1).padStart(10) : '       N/A';
    const nPriceStr = r.nvdaPrice ? ('$' + r.nvdaPrice.toFixed(2)).padStart(9) : '      N/A';
    const ratioStr = r.ratioSemiSoftware ? r.ratioSemiSoftware.toFixed(3).padStart(9) : '      N/A';

    let note = '';
    if (qStr === '2018-09-30') note = 'Top 2018 vor Krypto/Mining Hangover (-57%)';
    if (qStr === '2019-06-30') note = 'CapEx Abflachung / NVDA Trough ($3.50)';
    if (qStr === '2021-12-31') note = 'Pandemie-Allzeithoch / Zinswende beginnt';
    if (qStr === '2022-09-30') note = 'NVDA Boden ($12) / "Year of Efficiency"';
    if (qStr === '2023-06-30') note = 'ChatGPT / AI-Hardware Explosion zündet';
    if (qStr === '2024-06-30') note = 'Blackwell Ankündigung / SaaS leidet';
    if (qStr === '2025-06-30') note = 'NOW Anthropic-Panik (-64.5%) / CapEx sprintet';
    if (qStr === '2026-06-30') note = 'CapEx Allzeithoch ($150B+/Q!)';

    console.log(`${qStr} | ${capStr} | ${yoyStr.padStart(10)} | ${nRevStr} | ${nPriceStr} | ${ratioStr} | ${note}`);
}

console.log("\n==========================================================================================");
console.log(" TEIL 2: ANALYSE DER HISTORISCHEN CRASHES VON NVIDIA (-50% BIS -70%)");
console.log("==========================================================================================");

// Find exact peaks and troughs for NVDA
function analyzeDrawdowns(quotes) {
    let maxPrice = 0;
    let maxDate = '';
    let currentDd = 0;
    const drawdowns = [];

    let inDrawdown = false;
    let ddStart = null;
    let ddTroughPrice = Infinity;
    let ddTroughDate = null;
    let peakPrice = 0;

    for (const q of quotes) {
        if (q.close > maxPrice) {
            if (inDrawdown && (peakPrice - ddTroughPrice) / peakPrice >= 0.35) {
                drawdowns.push({
                    peakDate: ddStart,
                    peakPrice,
                    troughDate: ddTroughDate,
                    troughPrice: ddTroughPrice,
                    maxLossPct: ((ddTroughPrice - peakPrice) / peakPrice) * 100,
                    recoveryDate: q.date
                });
                inDrawdown = false;
            }
            maxPrice = q.close;
            maxDate = q.date;
        } else {
            const dd = (q.close - maxPrice) / maxPrice;
            if (dd <= -0.20) {
                if (!inDrawdown) {
                    inDrawdown = true;
                    ddStart = maxDate;
                    peakPrice = maxPrice;
                    ddTroughPrice = q.close;
                    ddTroughDate = q.date;
                } else if (q.close < ddTroughPrice) {
                    ddTroughPrice = q.close;
                    ddTroughDate = q.date;
                }
            }
        }
    }
    // Check pending drawdown
    if (inDrawdown && (peakPrice - ddTroughPrice) / peakPrice >= 0.20) {
        drawdowns.push({
            peakDate: ddStart,
            peakPrice,
            troughDate: ddTroughDate,
            troughPrice: ddTroughPrice,
            maxLossPct: ((ddTroughPrice - peakPrice) / peakPrice) * 100,
            recoveryDate: 'NOT YET / PENDING'
        });
    }
    return drawdowns;
}

const nvdaDds = analyzeDrawdowns(nvdaDaily);
for (const dd of nvdaDds) {
    console.log(`NVDA Drawdown: Peak ${dd.peakDate} ($${dd.peakPrice.toFixed(2)}) -> Trough ${dd.troughDate} ($${dd.troughPrice.toFixed(2)}) = ${dd.maxLossPct.toFixed(1)}% | Recovery: ${dd.recoveryDate}`);
}
