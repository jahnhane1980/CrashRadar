import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

const sofiFacts = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'SOFI_sec_facts.json'), 'utf8'));
const sofiDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'SOFI_daily.json'), 'utf8'));
const usGaap = sofiFacts.facts['us-gaap'];

// 1. Revenues Net of Interest Expense
const revUnits = usGaap['RevenuesNetOfInterestExpense']?.units?.USD || [];
// 2. Net Income
const netUnits = usGaap['NetIncomeLoss']?.units?.USD || [];
// 3. Deposits
const depIntUnits = usGaap['InterestBearingDepositLiabilities']?.units?.USD || [];
const depNonIntUnits = usGaap['NoninterestBearingDepositLiabilities']?.units?.USD || [];

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
const nets = extractDiscrete(netUnits);
const depInt = extractInstant(depIntUnits);
const depNonInt = extractInstant(depNonIntUnits);

function getPrice(date) {
    const q = sofiDaily.find(x => x.date >= date);
    return q ? q.close : null;
}

console.log("==========================================================================================================");
console.log("   SOFI TECHNOLOGIES: EMPIRISCHE FUNDAMENTAL- & ZINS-ANALYSE (2021 - 2026)");
console.log("==========================================================================================================\n");

console.log("Quartalsende | Filed Date | Net Rev ($M) | YoY Rev% | Net Income ($M) | Deposits ($B) | Kurs ($)");
console.log("----------------------------------------------------------------------------------------------------------");

for (const r of revs) {
    const end = r.end;
    const n = nets.find(x => x.end === end);
    const di = depInt.find(x => Math.abs(new Date(x.end) - new Date(end)) <= 15 * 86400000);
    const dni = depNonInt.find(x => Math.abs(new Date(x.end) - new Date(end)) <= 15 * 86400000);
    const totalDeposits = ((di?.val || 0) + (dni?.val || 0)) / 1e9;
    const price = getPrice(end);

    // Calc YoY rev
    const prevYear = revs.find(p => {
        const diff = (new Date(end) - new Date(p.end)) / 86400000;
        return diff >= 340 && diff <= 380;
    });
    const yoy = prevYear ? (((r.val - prevYear.val) / prevYear.val) * 100).toFixed(1) + '%' : 'N/A';

    const revM = (r.val / 1e6).toFixed(1).padStart(12);
    const netM = n ? (n.val / 1e6).toFixed(1).padStart(15) : '            N/A';
    const depStr = totalDeposits > 0 ? ('$' + totalDeposits.toFixed(2) + 'B').padStart(13) : '          N/A';
    const pStr = price ? ('$' + price.toFixed(2)).padStart(8) : '     N/A';

    console.log(`${end}   | ${r.filed || '   N/A    '} | ${revM} | ${yoy.padStart(8)} | ${netM} | ${depStr} | ${pStr}`);
}
