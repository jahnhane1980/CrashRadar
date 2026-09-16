import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_BASE = path.resolve(__dirname, '../../data/cache/sec_13f');
const PRICE_CACHE_DIR = path.resolve(__dirname, '../../cache/prices_10y');

const GURU_INFO = {
    '0001541617': { name: 'Brad Gerstner', short: 'Gerstner', fund: 'Altimeter', role: 'SCOUT' },
    '0001135730': { name: 'Philippe Laffont', short: 'Laffont', fund: 'Coatue', role: 'SCOUT' },
    '0001167483': { name: 'Chase Coleman', short: 'Coleman', fund: 'Tiger Global', role: 'SCOUT' },
    '0001536411': { name: 'Stanley Druckenmiller', short: 'Druckenmiller', fund: 'Duquesne', role: 'GUARDIAN' },
    '0001509842': { name: 'Zach Schreiber', short: 'Schreiber', fund: 'PointState', role: 'GUARDIAN' },
    '0001656456': { name: 'David Tepper', short: 'Tepper', fund: 'Appaloosa', role: 'GUARDIAN' }
};

const CUSIP_TO_TICKER = {
    '023135106': 'AMZN',
    '30303M102': 'META',
    '594918104': 'MSFT',
    '67066G104': 'NVDA',
    '01609W102': 'BABA',
    '02079K305': 'GOOGL',
    '02079K107': 'GOOGL',
    '64110L106': 'NFLX',
    '874039100': 'TSM',
    '47215P106': 'JD',
    '70450Y103': 'PYPL',
    '00724F101': 'ADBE',
    '90353T100': 'UBER',
    '11135F101': 'AVGO',
    '88160R101': 'TSLA',
    '79466L302': 'CRM',
    '81141R100': 'SE',
    '82509L107': 'SHOP',
    '25809K105': 'DASH',
    '81762P102': 'NOW',
    '833445109': 'SNOW',
    '512807108': 'LRCX',
    '22788C105': 'CRWD',
    '007903107': 'AMD',
    '038222105': 'AMAT',
    '037833100': 'AAPL',
    '166764100': 'CVX',
    '35671D857': 'FCX',
    '532457108': 'LLY'
};

const CHINA_BLACKLIST = ['BABA', 'JD', 'PDD', 'BIDU', 'NIO'];

function getFilingScaleMultiplier(holdings) {
    if (!holdings || holdings.length === 0) return 1;
    let validPrices = [];
    for (const h of holdings) {
        const val = Number(h.value) || 0;
        const sh = Number(h.shares) || 0;
        if (val > 0 && sh > 1000) validPrices.push(val / sh);
    }
    if (validPrices.length === 0) return 1;
    const medianPrice = validPrices.sort((a, b) => a - b)[Math.floor(validPrices.length / 2)];
    return medianPrice < 1.5 ? 1000 : 1;
}

function getPrice(ticker, ym) {
    const pFile = path.join(PRICE_CACHE_DIR, `${ticker}.json`);
    if (!fs.existsSync(pFile)) return 0;
    const map = JSON.parse(fs.readFileSync(pFile, 'utf8'));
    return map[ym] || 0;
}

async function run() {
    const qBoden = '2022-12-31';
    const holdings = {};
    for (const [cik, info] of Object.entries(GURU_INFO)) {
        const p = path.join(CACHE_BASE, cik, `${qBoden}.json`);
        if (!fs.existsSync(p)) continue;
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        const mult = getFilingScaleMultiplier(raw);
        for (const h of raw) {
            if (h.put_call !== 'STOCK') continue;
            const t = CUSIP_TO_TICKER[h.cusip];
            if (!t) continue;
            if (!holdings[t]) holdings[t] = { scouts: 0, guardians: 0, scoutVal: 0, guardVal: 0 };
            const val = (Number(h.value) || 0) * mult;
            if (info.role === 'SCOUT') {
                holdings[t].scouts++;
                holdings[t].scoutVal += val;
            } else {
                holdings[t].guardians++;
                holdings[t].guardVal += val;
            }
        }
    }

    // Korb B (Wächter-Legitimation + CHINA WHITELIST FILTER)
    const bCandidates = Object.entries(holdings)
        .filter(([t, d]) => d.guardians >= 1 && d.scouts >= 1 && !CHINA_BLACKLIST.includes(t))
        .sort((a, b) => (b[1].scouts + b[1].guardians) - (a[1].scouts + a[1].guardians) || (b[1].scoutVal + b[1].guardVal) - (a[1].scoutVal + a[1].guardVal));

    console.log("Top 10 Wächter + Scout Kandidaten am Boden mit Whitelist (ohne China):");
    bCandidates.slice(0, 10).forEach(([t, d]) => {
        const p0 = getPrice(t, '2022-12');
        const p1 = getPrice(t, '2026-06');
        const ret = p0 > 0 && p1 > 0 ? ((p1 - p0) / p0 * 100) : 0;
        console.log(`* ${t.padEnd(6)}: Halter: ${d.scouts + d.guardians} (${d.guardians} Wächter, ${d.scouts} Scouts) | Rendite 2022-2026: +${ret.toFixed(1)} %`);
    });

    const basketClean = bCandidates.slice(0, 7).map(e => e[0]);
    console.log(`\nRe-Entry Korb B (Clean Whitelist): ${basketClean.join(', ')}`);

    const avgClean = basketClean.reduce((s, t) => {
        const p0 = getPrice(t, '2022-12');
        const p1 = getPrice(t, '2026-06');
        return s + (p0 > 0 && p1 > 0 ? ((p1 - p0) / p0 * 100) : 0);
    }, 0) / basketClean.length;

    console.log(`Rendite des sauberen Re-Entry-Korbs (2022-2026): +${avgClean.toFixed(2)} %!`);
}

run().catch(err => console.error(err));
