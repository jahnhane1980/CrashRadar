import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_BASE = path.resolve(__dirname, '../../../data/cache/sec_13f');

const GURU_INFO = {
    '0001541617': { name: 'Brad Gerstner', short: 'Gerstner', fund: 'Altimeter', role: 'SCOUT' },
    '0001135730': { name: 'Philippe Laffont', short: 'Laffont', fund: 'Coatue', role: 'SCOUT' },
    '0001167483': { name: 'Chase Coleman', short: 'Coleman', fund: 'Tiger Global', role: 'SCOUT' },
    '0001536411': { name: 'Stanley Druckenmiller', short: 'Druckenmiller', fund: 'Duquesne', role: 'GUARDIAN' },
    '0001509842': { name: 'Zach Schreiber', short: 'Schreiber', fund: 'PointState', role: 'GUARDIAN' },
    '0001656456': { name: 'David Tepper', short: 'Tepper', fund: 'Appaloosa', role: 'GUARDIAN' }
};

const SEMI_KEYWORDS = [
    'NVIDIA', 'TAIWAN SEMICONDUCTOR', 'LAM RESEARCH', 'APPLIED MATLS', 
    'MICRON', 'ADVANCED MICRO DEVICES', 'INTEL', 'QUALCOMM', 'BROADCOM', 
    'ASML', 'ARM HOLDINGS', 'VANECK', 'SEMICONDUCTOR', 'MARVELL'
];

function isSemiStock(issuerName) {
    const n = (issuerName || '').toUpperCase();
    return SEMI_KEYWORDS.some(kw => n.includes(kw));
}

function getNormalizedValue(h, quarter) {
    const val = Number(h.value) || 0;
    if (quarter < '2023-01-01') return val * 1000;
    return val;
}

function formatCurrency(val) {
    if (!val || val === 0) return '$0';
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
}

const duquesneDir = path.join(CACHE_BASE, '0001536411');
const quarters = fs.readdirSync(duquesneDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort();

const dataByQuarter = {};
for (const q of quarters) {
    dataByQuarter[q] = {};
    for (const cik of Object.keys(GURU_INFO)) {
        const filePath = path.join(CACHE_BASE, cik, `${q}.json`);
        dataByQuarter[q][cik] = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
    }
}

console.log("=== 1. BÄRENMARKT 2022 HÄRTETEST (Q4/21 bis Q4/22) ===");
const bear2022 = [];
for (const [cik, info] of Object.entries(GURU_INFO)) {
    const hPeak = dataByQuarter['2021-12-31']?.[cik] || [];
    const hTrough = dataByQuarter['2022-12-31']?.[cik] || [];

    const vPeak = hPeak.reduce((s, h) => s + getNormalizedValue(h, '2021-12-31'), 0);
    const vTrough = hTrough.reduce((s, h) => s + getNormalizedValue(h, '2022-12-31'), 0);
    const dd = vPeak > 0 ? ((vTrough - vPeak) / vPeak * 100).toFixed(1) + ' %' : '-';

    bear2022.push({
        Manager: info.name,
        Fonds: info.fund,
        Rolle: info.role,
        'Peak Q4-2021': formatCurrency(vPeak),
        'Boden Q4-2022': formatCurrency(vTrough),
        'Drawdown (12 Monate)': dd
    });
}
console.table(bear2022);

console.log("\n=== 2. SEMI-EXPOSURE IM ZEITVERLAUF (KEY CRISES) ===");
const keyDates = ['2018-09-30', '2018-12-31', '2020-03-31', '2021-09-30', '2021-12-31', '2022-06-30', '2022-12-31', '2024-03-31', '2026-06-30'];
const semiList = [];
for (const q of keyDates) {
    let sTot = 0, sSemi = 0, gTot = 0, gSemi = 0;
    for (const [cik, info] of Object.entries(GURU_INFO)) {
        const holdings = dataByQuarter[q][cik] || [];
        const fVal = holdings.reduce((s, h) => s + getNormalizedValue(h, q), 0);
        const semiVal = holdings.filter(h => isSemiStock(h.issuer_name) && h.put_call === 'STOCK')
            .reduce((s, h) => s + getNormalizedValue(h, q), 0);
        if (info.role === 'SCOUT') { sTot += fVal; sSemi += semiVal; }
        else { gTot += fVal; gSemi += semiVal; }
    }
    semiList.push({
        Quartal: q,
        'Scouts Semi-%': (sSemi / sTot * 100).toFixed(1) + ' %',
        'Scouts Semi-$': formatCurrency(sSemi),
        'Makro Semi-%': (gSemi / gTot * 100).toFixed(1) + ' %',
        'Makro Semi-$': formatCurrency(gSemi)
    });
}
console.table(semiList);
