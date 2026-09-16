import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_BASE = path.resolve(__dirname, '../../data/cache/sec_13f');
const PRICE_CACHE_DIR = path.resolve(__dirname, '../../cache/prices_10y');
if (!fs.existsSync(PRICE_CACHE_DIR)) {
    fs.mkdirSync(PRICE_CACHE_DIR, { recursive: true });
}

const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

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
    '852234103': 'SQ',
    'G29183103': 'ETN',
    '21037T109': 'CEG',
    '722304102': 'PDD',
    '36828A101': 'GEV',
    'L8681T102': 'SPOT',
    '81762P102': 'NOW',
    '46120E602': 'ISRG',
    '833445109': 'SNOW',
    '92826C839': 'V',
    '91324P102': 'UNH',
    '595112103': 'MU',
    '461202103': 'INTU',
    '679295105': 'OKTA',
    '512807108': 'LRCX',
    '57636Q104': 'MA',
    '22788C105': 'CRWD',
    'G6683N103': 'NU',
    '007903107': 'AMD',
    '98138H101': 'WDAY',
    '038222105': 'AMAT',
    '037833100': 'AAPL',
    '166764100': 'CVX',
    '35671D857': 'FCX',
    '532457108': 'LLY'
};

const SEMI_TICKERS = ['NVDA', 'TSM', 'LRCX', 'AVGO', 'MU', 'AMD', 'AMAT'];

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

// Hole monatliche Kurse für alle benötigten Ticker
async function getMonthlyPrices(ticker) {
    const cacheFile = path.join(PRICE_CACHE_DIR, `${ticker}.json`);
    if (fs.existsSync(cacheFile)) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
    try {
        console.log(`Lade Kurshistorie für ${ticker}...`);
        const res = await yf.chart(ticker, {
            period1: '2016-01-01',
            period2: '2026-09-10',
            interval: '1mo'
        });
        const map = {};
        for (const q of res.quotes) {
            if (q.close !== null && q.close !== undefined) {
                const ym = q.date.toISOString().slice(0, 7); // YYYY-MM
                map[ym] = q.adjclose || q.close;
            }
        }
        fs.writeFileSync(cacheFile, JSON.stringify(map));
        return map;
    } catch (e) {
        console.warn(`Fehler beim Laden von ${ticker}:`, e.message);
        return {};
    }
}

async function run() {
    console.log("================================================================================");
    console.log("  10,5-JAHRE PERFORMANCE-VERGLEICH: ALTE VARIANTE VS. NEUE WÄCHTER-DOKTRIN");
    console.log("  Zeitraum: Q1-2016 bis Q2-2026 (42 Quartale) | Startkapital: 10.000 $");
    console.log("================================================================================\n");

    const duquesneDir = path.join(CACHE_BASE, '0001536411');
    const quarters = fs.readdirSync(duquesneDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort();

    // 1. Lade alle Holdings
    const holdingsByQ = {};
    for (const q of quarters) {
        holdingsByQ[q] = [];
        for (const [cik, info] of Object.entries(GURU_INFO)) {
            const p = path.join(CACHE_BASE, cik, `${q}.json`);
            if (!fs.existsSync(p)) continue;
            const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
            const mult = getFilingScaleMultiplier(raw);
            const mapped = raw.map(h => ({
                ...h,
                realValue: (Number(h.value) || 0) * mult
            }));
            const totalVal = mapped.reduce((s, h) => s + h.realValue, 0);

            for (const h of mapped) {
                if (h.put_call !== 'STOCK') continue;
                const ticker = CUSIP_TO_TICKER[h.cusip];
                if (!ticker) continue;
                const weight = totalVal > 0 ? (h.realValue / totalVal) * 100 : 0;
                holdingsByQ[q].push({
                    ticker,
                    guru: info.short,
                    role: info.role,
                    val: h.realValue,
                    weight
                });
            }
        }
    }

    // 2. Bestimme benötigte Ticker & lade Kurse
    const uniqueTickers = new Set(Object.values(CUSIP_TO_TICKER));
    uniqueTickers.add('QQQ');
    uniqueTickers.add('SPY');

    const priceMap = {};
    for (const t of uniqueTickers) {
        priceMap[t] = await getMonthlyPrices(t);
    }

    // Hilfsfunktion: Finde Quartalskurs (z.B. für 2021-03-31 -> 2021-03 oder 2021-04)
    function getQuarterPrice(ticker, qStr) {
        const ym = qStr.slice(0, 7);
        const map = priceMap[ticker] || {};
        if (map[ym]) return map[ym];
        // Fallback: folgendes Monat
        const parts = ym.split('-');
        const nextMonth = String(Number(parts[1]) === 12 ? 1 : Number(parts[1]) + 1).padStart(2, '0');
        const nextYear = Number(parts[1]) === 12 ? String(Number(parts[0]) + 1) : parts[0];
        const nextYm = `${nextYear}-${nextMonth}`;
        return map[nextYm] || 0;
    }

    // 3. Simuliere beide Portfolios
    // Startkapital: 10.000 $ am 2016-03-31
    let valA = 10000;
    let valB = 10000;
    let valQQQ = 10000;
    let valSPY = 10000;

    const qqqP0 = getQuarterPrice('QQQ', quarters[0]);
    const spyP0 = getQuarterPrice('SPY', quarters[0]);

    const history = [];

    for (let i = 0; i < quarters.length - 1; i++) {
        const qCurr = quarters[i];
        const qNext = quarters[i + 1];

        const list = holdingsByQ[qCurr] || [];
        const byStock = {};
        for (const item of list) {
            if (!byStock[item.ticker]) {
                byStock[item.ticker] = {
                    ticker: item.ticker,
                    holders: new Set(),
                    scoutHolders: new Set(),
                    guardianHolders: new Set(),
                    guardianConvictionHolders: new Set(),
                    totalVal: 0
                };
            }
            byStock[item.ticker].holders.add(item.guru);
            byStock[item.ticker].totalVal += item.val;
            if (item.role === 'SCOUT') byStock[item.ticker].scoutHolders.add(item.guru);
            if (item.role === 'GUARDIAN') {
                byStock[item.ticker].guardianHolders.add(item.guru);
                if (item.weight >= 1.0) byStock[item.ticker].guardianConvictionHolders.add(item.guru);
            }
        }

        const stocks = Object.values(byStock);

        // VARIANTE A (Alt: >= 2 Halter egal wer)
        const basketA = stocks
            .filter(s => s.holders.size >= 2)
            .sort((a, b) => b.holders.size - a.holders.size || b.totalVal - a.totalVal)
            .slice(0, 7)
            .map(s => s.ticker);

        // VARIANTE B (Neu: Wächter-Anker >= 1 Wächter >= 1% + >= 1 Scout, Max 2 Halbleiter)
        const bCandidates = stocks
            .filter(s => s.guardianConvictionHolders.size >= 1 && s.scoutHolders.size >= 1)
            .sort((a, b) => b.holders.size - a.holders.size || b.totalVal - a.totalVal);

        const basketB = [];
        let semiCount = 0;
        for (const c of bCandidates) {
            const isSemi = SEMI_TICKERS.includes(c.ticker);
            if (isSemi && semiCount >= 2) continue;
            basketB.push(c.ticker);
            if (isSemi) semiCount++;
            if (basketB.length >= 7) break;
        }

        // Berechne Rendite von qCurr zu qNext
        function calcBasketReturn(basket) {
            if (basket.length === 0) return 0;
            let sumRet = 0;
            let validCount = 0;
            for (const t of basket) {
                const p0 = getQuarterPrice(t, qCurr);
                const p1 = getQuarterPrice(t, qNext);
                if (p0 > 0 && p1 > 0) {
                    sumRet += (p1 - p0) / p0;
                    validCount++;
                }
            }
            return validCount > 0 ? sumRet / validCount : 0;
        }

        const retA = calcBasketReturn(basketA);
        const retB = calcBasketReturn(basketB);

        valA *= (1 + retA);
        valB *= (1 + retB);

        const qqqP1 = getQuarterPrice('QQQ', qNext);
        const spyP1 = getQuarterPrice('SPY', qNext);
        valQQQ = 10000 * (qqqP1 / qqqP0);
        valSPY = 10000 * (spyP1 / spyP0);

        history.push({
            Quartal: qNext,
            'Alt ($)': Math.round(valA),
            'Neu ($)': Math.round(valB),
            'QQQ ($)': Math.round(valQQQ),
            'SPY ($)': Math.round(valSPY),
            'Basket Alt': basketA.join(', '),
            'Basket Neu': basketB.join(', ')
        });
    }

    console.log("--------------------------------------------------------------------------------");
    console.log("  JÄHRLICHE ENTWICKLUNG & KRISEN-VERGLEICH (10.000 $ START)");
    console.log("--------------------------------------------------------------------------------");

    const keyMilestones = history.filter(r => 
        r.Quartal.endsWith('-12-31') || 
        r.Quartal === '2021-12-31' || 
        r.Quartal === '2022-12-31' || 
        r.Quartal === '2026-06-30'
    );
    console.table(keyMilestones.map(r => ({
        Quartal: r.Quartal,
        'Alte Variante': `$${r['Alt ($)'].toLocaleString('en-US')}`,
        'Neue Wächter-Doktrin': `$${r['Neu ($)'].toLocaleString('en-US')}`,
        'QQQ Benchmark': `$${r['QQQ ($)'].toLocaleString('en-US')}`,
        'SPY Benchmark': `$${r['SPY ($)'].toLocaleString('en-US')}`
    })));

    const final = history[history.length - 1];
    const totalReturnA = ((final['Alt ($)'] - 10000) / 10000 * 100).toFixed(2);
    const totalReturnB = ((final['Neu ($)'] - 10000) / 10000 * 100).toFixed(2);
    const totalReturnQQQ = ((final['QQQ ($)'] - 10000) / 10000 * 100).toFixed(2);
    const totalReturnSPY = ((final['SPY ($)'] - 10000) / 10000 * 100).toFixed(2);

    console.log("\n================================================================================");
    console.log("  GESAMTERGEBNIS NACH 10,5 JAHREN (2016 - 2026):");
    console.log("================================================================================");
    console.log(`* ALTE VARIANTE (Reiner Konsens):     $ ${final['Alt ($)'].toLocaleString('en-US')} (+${totalReturnA} %)`);
    console.log(`* NEUE VARIANTE (Wächter-Doktrin):    $ ${final['Neu ($)'].toLocaleString('en-US')} (+${totalReturnB} %)`);
    console.log(`* BENCHMARK QQQ (Nasdaq 100):          $ ${final['QQQ ($)'].toLocaleString('en-US')} (+${totalReturnQQQ} %)`);
    console.log(`* BENCHMARK SPY (S&P 500):             $ ${final['SPY ($)'].toLocaleString('en-US')} (+${totalReturnSPY} %)`);
    console.log("================================================================================\n");
}

run().catch(err => console.error(err));
