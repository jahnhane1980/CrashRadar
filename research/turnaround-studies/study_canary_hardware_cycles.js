import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

const nvdaFacts = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_sec_facts.json'), 'utf8'));
const nvdaDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_daily.json'), 'utf8'));

// Extract all relevant metrics from NVDA SEC facts
const usGaap = nvdaFacts?.facts?.['us-gaap'] || {};

function getMetricUnits(tag) {
    if (usGaap[tag]?.units?.USD) return usGaap[tag].units.USD;
    if (usGaap[tag]?.units?.shares) return usGaap[tag].units.shares;
    return [];
}

// 1. Revenues (quarterly discrete)
const revUnits = getMetricUnits('Revenues').concat(getMetricUnits('RevenueFromContractWithCustomerExcludingAssessedTax'));
// 2. Gross Profit
const grossUnits = getMetricUnits('GrossProfit');
// 3. Inventory (balance sheet instant)
const invUnits = getMetricUnits('InventoryNet');
// 4. Accounts Receivable
const arUnits = getMetricUnits('AccountsReceivableNetCurrent');
// 5. Operating Cash Flow
const ocfUnits = getMetricUnits('NetCashProvidedByUsedInOperatingActivities');
// 6. Net Income
const netUnits = getMetricUnits('NetIncomeLoss');

// Filter discrete quarters
function extractDiscrete(units) {
    const list = units.filter(x => x.start && x.end && ((new Date(x.end) - new Date(x.start)) / 86400000) >= 70 && ((new Date(x.end) - new Date(x.start)) / 86400000) <= 105);
    const map = new Map();
    for (const q of list) {
        const ex = map.get(q.end);
        if (!ex || (q.filed && q.filed > ex.filed)) map.set(q.end, q);
    }
    return Array.from(map.values()).sort((a,b) => a.end.localeCompare(b.end));
}

// Filter instant balance sheet items (end date)
function extractInstant(units) {
    const list = units.filter(x => !x.start && x.end);
    const map = new Map();
    for (const q of list) {
        const ex = map.get(q.end);
        if (!ex || (q.filed && q.filed > ex.filed)) map.set(q.end, q);
    }
    return Array.from(map.values()).sort((a,b) => a.end.localeCompare(b.end));
}

const revs = extractDiscrete(revUnits);
const gross = extractDiscrete(grossUnits);
const invs = extractInstant(invUnits);
const ars = extractInstant(arUnits);

// Price lookup helper
function getPriceAt(date) {
    const q = nvdaDaily.find(x => x.date >= date);
    return q ? q.close : null;
}

// Combine into unified quarterly record
const allQuarters = revs.map(r => {
    const end = r.end;
    const g = gross.find(x => x.end === end);
    const inv = invs.find(x => Math.abs(new Date(x.end) - new Date(end)) <= 15 * 86400000);
    const ar = ars.find(x => Math.abs(new Date(x.end) - new Date(end)) <= 15 * 86400000);
    const price = getPriceAt(end);

    const revenue = r.val;
    const grossProfit = g ? g.val : null;
    const grossMarginPct = grossProfit ? (grossProfit / revenue) * 100 : null;
    const inventoryVal = inv ? inv.val : null;
    const arVal = ar ? ar.val : null;

    // Days Sales of Inventory (DSI) = (Inventory / Cost of Goods Sold) * 90
    // COGS = Revenue - Gross Profit
    const cogs = (revenue && grossProfit) ? (revenue - grossProfit) : null;
    const dsi = (inventoryVal && cogs) ? ((inventoryVal / cogs) * 90) : null;

    return {
        end,
        filed: r.filed,
        revenue,
        grossProfit,
        grossMarginPct,
        inventoryVal,
        arVal,
        dsi,
        price
    };
});

// Calculate QoQ and YoY metrics
for (let i = 0; i < allQuarters.length; i++) {
    const q = allQuarters[i];
    const prevQ = allQuarters[i - 1];
    const prevYear = allQuarters[i - 4];

    if (prevQ && prevQ.revenue) {
        q.revQoQ = ((q.revenue - prevQ.revenue) / prevQ.revenue) * 100;
        if (q.inventoryVal && prevQ.inventoryVal) {
            q.invQoQ = ((q.inventoryVal - prevQ.inventoryVal) / prevQ.inventoryVal) * 100;
        }
    }
    if (prevYear && prevYear.revenue) {
        q.revYoY = ((q.revenue - prevYear.revenue) / prevYear.revenue) * 100;
        if (q.inventoryVal && prevYear.inventoryVal) {
            q.invYoY = ((q.inventoryVal - prevYear.inventoryVal) / prevYear.inventoryVal) * 100;
        }
    }
}

console.log("==================================================================================================================");
console.log("   KANARIENVOGEL-STUDIE: HISTORISCHE FUNDAMENTAL-SIGNALE AN DEN TOP-WENDEPUNKTEN VON NVIDIA");
console.log("==================================================================================================================");

function printPhase(title, startDate, endDate) {
    console.log(`\n------------------------------------------------------------------------------------------------------------------`);
    console.log(`PHASE: ${title} (${startDate} bis ${endDate})`);
    console.log(`------------------------------------------------------------------------------------------------------------------`);
    console.log(`Quartalsende | Filed Date | Rev ($B) | Rev QoQ% | Gross Mgn% | Inv ($B) | Inv QoQ% | DSI (Tage) | Kurs ($)`);
    console.log(`------------------------------------------------------------------------------------------------------------------`);

    const subset = allQuarters.filter(q => q.end >= startDate && q.end <= endDate);
    for (const q of subset) {
        const revStr = (q.revenue / 1e9).toFixed(2).padStart(8);
        const qoqStr = q.revQoQ !== undefined ? ((q.revQoQ >= 0 ? '+' : '') + q.revQoQ.toFixed(1) + '%').padStart(8) : '     N/A';
        const gmStr = q.grossMarginPct ? (q.grossMarginPct.toFixed(1) + '%').padStart(10) : '       N/A';
        const invStr = q.inventoryVal ? (q.inventoryVal / 1e9).toFixed(2).padStart(8) : '     N/A';
        const invQStr = q.invQoQ !== undefined ? ((q.invQoQ >= 0 ? '+' : '') + q.invQoQ.toFixed(1) + '%').padStart(8) : '     N/A';
        const dsiStr = q.dsi ? q.dsi.toFixed(0).padStart(10) : '       N/A';
        const pStr = q.price ? ('$' + q.price.toFixed(2)).padStart(8) : '     N/A';

        console.log(`${q.end}   | ${q.filed || '   N/A    '} | ${revStr} | ${qoqStr} | ${gmStr} | ${invStr} | ${invQStr} | ${dsiStr} | ${pStr}`);
    }
}

// 1. Top 2018 (Crypto mining peak & hangover)
printPhase("1. DER 2018 CRASH (Krypto-Peak & Mining-Kater: Kurs stürzt von $7.23 auf $3.18 = -56%)", "2017-10-01", "2019-07-31");

// 2. Top 2021/2022 (Pandemic Bull & Zinswende: Kurs stürzt von $33.38 auf $11.23 = -66%)
printPhase("2. DER 2021/2022 CRASH (Pandemie-ATH & Zinswende: Kurs stürzt von $33.38 auf $11.23 = -66%)", "2021-04-01", "2023-01-31");

// 3. Current Situation (2024 - 2026 AI-Cycle)
printPhase("3. DIE AKTUELLE PHASE (2024 - 2026: Wo stehen wir JETZT?)", "2024-01-01", "2026-08-01");
