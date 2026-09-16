import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_BASE = path.resolve(__dirname, '../../data/cache/sec_13f');
const DAILY_CACHE_DIR = path.resolve(__dirname, '../../cache/daily_10y');

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
    '023135106': 'AMZN', '30303M102': 'META', '594918104': 'MSFT', '67066G104': 'NVDA',
    '01609W102': 'BABA', '02079K305': 'GOOGL', '02079K107': 'GOOGL', '64110L106': 'NFLX',
    '874039100': 'TSM', '47215P106': 'JD', '70450Y103': 'PYPL', '00724F101': 'ADBE',
    '90353T100': 'UBER', '11135F101': 'AVGO', '88160R101': 'TSLA', '79466L302': 'CRM',
    '81141R100': 'SE', '82509L107': 'SHOP', '25809K105': 'DASH', '852234103': 'SQ',
    'G29183103': 'ETN', '21037T109': 'CEG', '722304102': 'PDD', '36828A101': 'GEV',
    'L8681T102': 'SPOT', '81762P102': 'NOW', '46120E602': 'ISRG', '833445109': 'SNOW',
    '92826C839': 'V', '91324P102': 'UNH', '595112103': 'MU', '461202103': 'INTU',
    '679295105': 'OKTA', '512807108': 'LRCX', '57636Q104': 'MA', '22788C105': 'CRWD',
    'G6683N103': 'NU', '007903107': 'AMD', '98138H101': 'WDAY', '038222105': 'AMAT',
    '037833100': 'AAPL', '166764100': 'CVX', '35671D857': 'FCX', '532457108': 'LLY',
    '19260Q107': 'COIN', '701094104': 'PANW', '235851102': 'DDOG', '38259P508': 'GOOG'
};

const BLOCKED_TICKERS = ['BABA', 'JD', 'PDD']; // Geopolitical Blacklist
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

async function getDailyCloses(ticker) {
    const cacheFile = path.join(DAILY_CACHE_DIR, `${ticker}.json`);
    if (fs.existsSync(cacheFile)) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
    try {
        const res = await yf.historical(ticker, {
            period1: '2024-01-01',
            period2: '2026-09-14',
            interval: '1d'
        });
        const list = res.map(r => ({
            date: r.date.toISOString().split('T')[0],
            close: r.adjClose || r.close
        })).filter(r => r.close !== null && r.close !== undefined);
        fs.writeFileSync(cacheFile, JSON.stringify(list));
        return list;
    } catch (e) {
        return [];
    }
}

function getTechnicalIndicators(dailyList, targetDate) {
    const slice = dailyList.filter(d => d.date <= targetDate);
    if (slice.length < 50) return { price: 0, sma50: 0, sma200: 0, underSma50: false, overextendedSma200: false };

    const currentPrice = slice[slice.length - 1].close;
    const last50 = slice.slice(-50).map(d => d.close);
    const sma50 = last50.reduce((s, c) => s + c, 0) / 50;

    let sma200 = 0;
    if (slice.length >= 200) {
        const last200 = slice.slice(-200).map(d => d.close);
        sma200 = last200.reduce((s, c) => s + c, 0) / 200;
    } else {
        sma200 = slice.map(d => d.close).reduce((s, c) => s + c, 0) / slice.length;
    }

    const underSma50 = currentPrice < sma50;
    const diff200Pct = sma200 > 0 ? ((currentPrice - sma200) / sma200 * 100) : 0;
    const overextendedSma200 = diff200Pct > 30.0;

    return { price: currentPrice, sma50, sma200, diff200Pct, underSma50, overextendedSma200 };
}

async function run() {
    console.log("================================================================================");
    console.log("  BERECHNUNG: DAS THEORETISCHE PORTFOLIO HEUTE (SEPTEMBER 2026)");
    console.log("  System: Version 3.1.0 – Dual-Engine Governance, KI-Infrastruktur & Rebalancing");
    console.log("================================================================================\n");

    const qCurr = '2026-06-30'; // Letztes Quartalsfiling
    const qPrev = '2026-03-31';

    // 1. Lade Holdings für qCurr und qPrev
    const dataCurr = {};
    const dataPrev = {};

    for (const [cik, info] of Object.entries(GURU_INFO)) {
        dataCurr[cik] = {};
        dataPrev[cik] = {};

        const pCurr = path.join(CACHE_BASE, cik, `${qCurr}.json`);
        if (fs.existsSync(pCurr)) {
            const raw = JSON.parse(fs.readFileSync(pCurr, 'utf8'));
            const mult = getFilingScaleMultiplier(raw);
            const mapped = raw.map(h => ({ ...h, realVal: (Number(h.value) || 0) * mult, realSh: Number(h.shares) || 0 }));
            const total = mapped.reduce((s, h) => s + h.realVal, 0);
            for (const h of mapped) {
                if (h.put_call !== 'STOCK') continue;
                let t = CUSIP_TO_TICKER[h.cusip];
                if (!t && h.issuer_name && h.issuer_name.toUpperCase().includes('VERNOVA')) t = 'GEV';
                if (!t) continue;
                if (t === 'GOOG') t = 'GOOGL';
                if (!dataCurr[cik][t]) dataCurr[cik][t] = { shares: 0, val: 0, weight: 0 };
                dataCurr[cik][t].shares += h.realSh;
                dataCurr[cik][t].val += h.realVal;
                dataCurr[cik][t].weight += total > 0 ? (h.realVal / total) * 100 : 0;
            }
        }

        const pPrev = path.join(CACHE_BASE, cik, `${qPrev}.json`);
        if (fs.existsSync(pPrev)) {
            const raw = JSON.parse(fs.readFileSync(pPrev, 'utf8'));
            const mult = getFilingScaleMultiplier(raw);
            const mapped = raw.map(h => ({ ...h, realVal: (Number(h.value) || 0) * mult, realSh: Number(h.shares) || 0 }));
            const total = mapped.reduce((s, h) => s + h.realVal, 0);
            for (const h of mapped) {
                if (h.put_call !== 'STOCK') continue;
                let t = CUSIP_TO_TICKER[h.cusip];
                if (!t && h.issuer_name && h.issuer_name.toUpperCase().includes('VERNOVA')) t = 'GEV';
                if (!t) continue;
                if (t === 'GOOG') t = 'GOOGL';
                if (!dataPrev[cik][t]) dataPrev[cik][t] = { shares: 0, val: 0, weight: 0 };
                dataPrev[cik][t].shares += h.realSh;
                dataPrev[cik][t].val += h.realVal;
                dataPrev[cik][t].weight += total > 0 ? (h.realVal / total) * 100 : 0;
            }
        }
    }

    // 2. Analysiere jede Aktie
    const allTickers = new Set();
    for (const cik of Object.keys(GURU_INFO)) {
        for (const t of Object.keys(dataCurr[cik])) allTickers.add(t);
        for (const t of Object.keys(dataPrev[cik])) allTickers.add(t);
    }

    const stockSummary = {};
    for (const t of allTickers) {
        if (BLOCKED_TICKERS.includes(t)) continue; // Whitelist

        stockSummary[t] = {
            ticker: t,
            holders: [],
            scoutHolders: [],
            guardianHolders: [],
            activeBuyers: [],
            scoutBuyers: [],
            guardianBuyers: [],
            trimmers: [],
            guardianTrimmers: [],
            totalValUSD: 0
        };

        for (const [cik, info] of Object.entries(GURU_INFO)) {
            const cH = dataCurr[cik][t];
            const pH = dataPrev[cik][t];
            const currSh = cH ? cH.shares : 0;
            const prevSh = pH ? pH.shares : 0;
            const currVal = cH ? cH.val : 0;
            const currW = cH ? cH.weight : 0;

            if (currSh > 0 && currW >= 1.0) { // 1.0% Konviktion
                stockSummary[t].holders.push(info.short);
                stockSummary[t].totalValUSD += currVal;
                if (info.role === 'SCOUT') stockSummary[t].scoutHolders.push(info.short);
                if (info.role === 'GUARDIAN') stockSummary[t].guardianHolders.push(info.short);

                if (prevSh === 0 || currSh > prevSh * 1.05) {
                    stockSummary[t].activeBuyers.push(info.short);
                    if (info.role === 'SCOUT') stockSummary[t].scoutBuyers.push(info.short);
                    if (info.role === 'GUARDIAN') stockSummary[t].guardianBuyers.push(info.short);
                }
            }

            if (prevSh > 0 && (currSh === 0 || currSh < prevSh * 0.95)) {
                stockSummary[t].trimmers.push(info.short);
                if (info.role === 'GUARDIAN') stockSummary[t].guardianTrimmers.push(info.short);
            }
        }
    }

    const validStocks = Object.values(stockSummary).filter(s => s.holders.length >= 2);

    console.log("------------------------------------------------------------------------------------------------------------------------");
    console.log(" Ticker | Halter (Total) | Wächter-Halter          | Scouts-Halter           | Aktive Käufer       | Wächter trimmt?");
    console.log("------------------------------------------------------------------------------------------------------------------------");
    for (const s of validStocks.sort((a, b) => b.holders.length - a.holders.length || b.totalValUSD - a.totalValUSD)) {
        const wTrim = s.guardianTrimmers.length > 0 ? `JA (${s.guardianTrimmers.join(',')})` : 'Nein';
        console.log(` ${s.ticker.padEnd(6)} | ${String(s.holders.length).padEnd(14)} | ${s.guardianHolders.join(', ').padEnd(23)} | ${s.scoutHolders.join(', ').padEnd(23)} | ${s.activeBuyers.join(', ').padEnd(19)} | ${wTrim}`);
    }

    // 3. Führe die Zuteilung der 7 Slots gemäß Version 3.1.0 aus:
    // - Halbleiter-Cap: Max 2 Slots (Schreiber SMH-Put)
    // - Veto AAPL: Tepper Put
    // - Rangfolge nach Haltern, Käufern, Marktwert
    // - Wächter-Rebalancing
    console.log("\n================================================================================");
    console.log("  SLOT-ALLOKATION & ZUTEILUNG (STAND: SEPTEMBER 2026)");
    console.log("================================================================================\n");

    const semiSlots = [];
    const nonSemiSlots = [];
    const onDeckReserve = [];

    const sortedCandidates = validStocks.sort((a, b) => 
        b.holders.length - a.holders.length || 
        b.activeBuyers.length - a.activeBuyers.length || 
        b.totalValUSD - a.totalValUSD
    );

    for (const s of sortedCandidates) {
        if (s.ticker === 'AAPL') continue; // Tepper Put-Veto

        const isSemi = SEMI_TICKERS.includes(s.ticker);
        if (isSemi) {
            if (semiSlots.length < 2) {
                semiSlots.push(s);
            } else {
                onDeckReserve.push({ ticker: s.ticker, reason: 'Halbleiter-Sektor-Cap (SMH-Put > $250M) erreicht. Max 2 Slots vergeben.' });
            }
        } else {
            nonSemiSlots.push(s);
        }
    }

    const currentSlots = [];
    // Nimm 2 Semis
    for (const s of semiSlots) currentSlots.push(s);
    // Fülle mit Non-Semis auf 7 auf
    for (const s of nonSemiSlots) {
        if (currentSlots.length < 7) {
            currentSlots.push(s);
        } else {
            onDeckReserve.push({ ticker: s.ticker, reason: 'Portfolio-Kapazität (7 Slots voll).' });
        }
    }

    // Lade tagesaktuelle Kurse & Indikatoren für die 7 Slots
    console.log("Aktuelle Slots mit Stand September 2026:\n");
    for (let i = 0; i < currentSlots.length; i++) {
        const s = currentSlots[i];
        const daily = await getDailyCloses(s.ticker);
        const tech = getTechnicalIndicators(daily, '2026-09-14');
        const isSemi = SEMI_TICKERS.includes(s.ticker);

        console.log(`Slot ${i + 1}: ${s.ticker.padEnd(5)} | ${(isSemi ? 'Halbleiter' : (s.ticker === 'GEV' ? 'KI-Infrastruktur / Energy' : 'Tech / Plattform')).padEnd(26)} | ${s.holders.length} Halter (${s.holders.join(', ')}) | Kurs: $${tech.price.toFixed(1)} (SMA50: $${tech.sma50.toFixed(1)}, SMA200: $${tech.sma200.toFixed(1)})`);
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("  ON-DECK RESERVE (Warteliste für Nachrücker):");
    console.log("--------------------------------------------------------------------------------");
    for (const b of onDeckReserve.slice(0, 5)) {
        console.log(`• ${b.ticker.padEnd(6)}: ${b.reason}`);
    }
}

run().catch(console.error);
