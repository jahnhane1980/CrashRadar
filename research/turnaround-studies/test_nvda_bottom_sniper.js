import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

const nvdaDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_daily.json'), 'utf8'));
const nvdaFacts = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_sec_facts.json'), 'utf8'));

// Load previous analysis data or compute
const usGaap = nvdaFacts?.facts?.['us-gaap'] || {};
function getMetricUnits(tag) {
    if (usGaap[tag]?.units?.USD) return usGaap[tag].units.USD;
    return [];
}

const revUnits = getMetricUnits('Revenues').concat(getMetricUnits('RevenueFromContractWithCustomerExcludingAssessedTax'));
const grossUnits = getMetricUnits('GrossProfit');
const invUnits = getMetricUnits('InventoryNet');

function extractDiscrete(units) {
    const list = units.filter(x => x.start && x.end && ((new Date(x.end) - new Date(x.start)) / 86400000) >= 70 && ((new Date(x.end) - new Date(x.start)) / 86400000) <= 105);
    const map = new Map();
    for (const q of list) {
        const ex = map.get(q.end);
        if (!ex || (q.filed && q.filed > ex.filed)) map.set(q.end, q);
    }
    return Array.from(map.values()).sort((a,b) => a.end.localeCompare(b.end));
}

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

console.log("==========================================================================================================");
console.log("   TEST: WAS WÜRDE PASSIEREN, WENN WIR DEN SOFTWARE-MONOPOL-SNIPER 1:1 AUF NVIDIA ANWENDEN?");
console.log("==========================================================================================================\n");

// Look at NVDA at 2018 Bottom (2018-12-24 @ $3.18) and 2022 Bottom (2022-10-13 @ $11.23)
function inspectBottomFundamentals(date, label) {
    console.log(`----------------------------------------------------------------------------------------------------------`);
    console.log(`ANALYSE DES BODENS: ${label} (Stichtag: ${date})`);
    console.log(`----------------------------------------------------------------------------------------------------------`);

    // Find nearest filings before and around date
    const relevantRevs = revs.filter(r => r.end <= date || Math.abs(new Date(r.end) - new Date(date)) <= 60 * 86400000).slice(-3);
    for (const r of relevantRevs) {
        const g = gross.find(x => x.end === r.end);
        const inv = invs.find(x => Math.abs(new Date(x.end) - new Date(r.end)) <= 15 * 86400000);
        const grossMargin = g ? ((g.val / r.val) * 100).toFixed(1) + '%' : 'N/A';
        const cogs = g ? (r.val - g.val) : null;
        const dsi = (inv && cogs) ? ((inv.val / cogs) * 90).toFixed(0) : 'N/A';
        console.log(`Quartal: ${r.end} (Filed: ${r.filed}) | Rev: $${(r.val/1e9).toFixed(2)}B | Gross Margin: ${grossMargin} | Inv: $${(inv?.val/1e9).toFixed(2)}B | DSI: ${dsi} Tage`);
    }
}

inspectBottomFundamentals("2018-12-24", "1. NVDA TIEFPUNKT 2018 ($3.18)");
inspectBottomFundamentals("2022-10-14", "2. NVDA TIEFPUNKT 2022 ($11.23)");
