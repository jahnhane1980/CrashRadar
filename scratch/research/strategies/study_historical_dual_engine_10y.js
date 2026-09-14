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

// Dynamische Erkennung ob ein Filing in $1.000s oder in $1 gemeldet wurde
function getFilingScaleMultiplier(holdings) {
    if (!holdings || holdings.length === 0) return 1;
    let validPrices = [];
    for (const h of holdings) {
        const val = Number(h.value) || 0;
        const sh = Number(h.shares) || 0;
        if (val > 0 && sh > 1000) {
            validPrices.push(val / sh);
        }
    }
    if (validPrices.length === 0) return 1;
    const medianPrice = validPrices.sort((a, b) => a - b)[Math.floor(validPrices.length / 2)];
    if (medianPrice < 1.5) {
        return 1000;
    }
    return 1;
}

function formatCurrency(val) {
    if (!val || val === 0) return '$0';
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
}

async function run() {
    console.log("================================================================================");
    console.log("  10,5-JAHRE HÄRTETEST: SCOUTS VS. MAKRO-WÄCHTER (2016–2026)");
    console.log("================================================================================\n");

    const duquesneDir = path.join(CACHE_BASE, '0001536411');
    const quarters = fs.readdirSync(duquesneDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort();

    // 1. Lade und skaliere alle Daten
    const dataByQuarter = {}; // q -> { cik -> { holdings, totalVal, semiVal, mult } }
    for (const q of quarters) {
        dataByQuarter[q] = {};
        for (const [cik, info] of Object.entries(GURU_INFO)) {
            const fPath = path.join(CACHE_BASE, cik, `${q}.json`);
            const rawHoldings = fs.existsSync(fPath) ? JSON.parse(fs.readFileSync(fPath, 'utf8')) : [];
            const mult = getFilingScaleMultiplier(rawHoldings);
            
            const holdings = rawHoldings.map(h => ({
                ...h,
                realValue: (Number(h.value) || 0) * mult
            }));

            const totalVal = holdings.reduce((s, h) => s + h.realValue, 0);
            const semiVal = holdings
                .filter(h => isSemiStock(h.issuer_name) && h.put_call === 'STOCK')
                .reduce((s, h) => s + h.realValue, 0);

            dataByQuarter[q][cik] = { holdings, totalVal, semiVal, mult };
        }
    }

    // -------------------------------------------------------------------------
    // TEST 1: BÄRENMARKT 2022 HÄRTETEST (Q4/21 bis Q4/22)
    // -------------------------------------------------------------------------
    console.log("--------------------------------------------------------------------------------");
    console.log("💥 TEST 1: BÄRENMARKT 2022 – WER ZOG DEN STECKER & WER LIEF IN DEN UNTERGANG?");
    console.log("Vergleich Q4-2021 (Peak) vs. Q4-2022 (Boden)");
    console.log("--------------------------------------------------------------------------------");

    const bear2022 = [];
    for (const [cik, info] of Object.entries(GURU_INFO)) {
        const peakData = dataByQuarter['2021-12-31']?.[cik];
        const troughData = dataByQuarter['2022-12-31']?.[cik];

        const vPeak = peakData?.totalVal || 0;
        const vTrough = troughData?.totalVal || 0;
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

    // -------------------------------------------------------------------------
    // TEST 2: HALBLEITER-ALLOKATION: SCOUTS VS. MAKRO-WÄCHTER (2016–2026)
    // -------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("📊 TEST 2: HALBLEITER-QUOTE (SEMI-EXPOSURE %) AN HISTORISCHEN WENDEPUNKTEN");
    console.log("--------------------------------------------------------------------------------");

    const keyDates = [
        { q: '2018-09-30', event: 'Halbleiter- & QT-Top 2018' },
        { q: '2018-12-31', event: 'QT-Crash-Tiefpunkt 2018' },
        { q: '2020-03-31', event: 'Corona-Crash-Tiefpunkt 2020' },
        { q: '2021-09-30', event: 'Tech-Allzeithoch 2021' },
        { q: '2022-06-30', event: 'Zinsschock-Korrektur 2022' },
        { q: '2022-12-31', event: 'Bärenmarkt-Tief 2022' },
        { q: '2024-03-31', event: 'NVIDIA-Boom Beschleunigung' },
        { q: '2026-06-30', event: 'Status Quo Heute' }
    ];

    const semiTable = keyDates.map(k => {
        let sTot = 0, sSemi = 0, gTot = 0, gSemi = 0;
        for (const [cik, info] of Object.entries(GURU_INFO)) {
            const d = dataByQuarter[k.q]?.[cik];
            if (!d) continue;
            if (info.role === 'SCOUT') {
                sTot += d.totalVal;
                sSemi += d.semiVal;
            } else {
                gTot += d.totalVal;
                gSemi += d.semiVal;
            }
        }
        return {
            Quartal: k.q,
            Marktphase: k.event,
            'Scouts Semi-%': (sSemi / sTot * 100).toFixed(1) + ' %',
            'Scouts Semi-$': formatCurrency(sSemi),
            'Makro Semi-%': (gSemi / gTot * 100).toFixed(1) + ' %',
            'Makro Semi-$': formatCurrency(gSemi)
        };
    });
    console.table(semiTable);

    // -------------------------------------------------------------------------
    // TEST 3: DIE NVIDIA-LEAD-TIME: WANN VERKAUFTE DRUCKENMILLER VS. SCOUTS?
    // -------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("🎯 TEST 3: NVIDIA-TIMING: DRUCKENMILLER VS. SCOUTS (2022–2026)");
    console.log("--------------------------------------------------------------------------------");

    const nvdaCusip = '67066G104';
    const nvdaRows = quarters.filter(q => q >= '2022-09-30').map(q => {
        const row = { Quartal: q };
        for (const [cik, info] of Object.entries(GURU_INFO)) {
            const h = (dataByQuarter[q][cik]?.holdings || []).find(item => item.cusip === nvdaCusip && item.put_call === 'STOCK');
            row[info.short] = h && h.realValue > 0 ? formatCurrency(h.realValue) : '-';
        }
        return row;
    });
    console.table(nvdaRows);

    // -------------------------------------------------------------------------
    // TEST 4: DIE PUT-HEDGES DER MAKRO-WÄCHTER (FRÜHWARNSYSTEM)
    // -------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("🛡️ TEST 4: SIGNIFIKANTE PUTS DER MAKRO-WÄCHTER (>= $100M)");
    console.log("--------------------------------------------------------------------------------");

    const putsList = [];
    for (const q of quarters) {
        for (const [cik, info] of Object.entries(GURU_INFO)) {
            if (info.role !== 'GUARDIAN') continue;
            const holdings = dataByQuarter[q][cik]?.holdings || [];
            const puts = holdings.filter(h => h.put_call === 'PUT' && h.realValue >= 100e6);
            for (const p of puts) {
                putsList.push({
                    Quartal: q,
                    Wächter: info.short,
                    Fonds: info.fund,
                    Basiswert: p.issuer_name.replace('&amp;', '&'),
                    'Put-Volumen': formatCurrency(p.realValue)
                });
            }
        }
    }
    console.table(putsList.slice(-20)); // Letzte 20 signifikante Puts
}

run().catch(err => console.error(err));
