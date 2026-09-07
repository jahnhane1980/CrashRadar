import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

// Caching helper for Yahoo Finance quotes
async function getHistoricalPrices(symbols, startDate, endDate) {
    const cacheDir = fs.existsSync(path.resolve(__dirname, '../../trash/cache'))
        ? path.resolve(__dirname, '../../trash/cache')
        : path.resolve(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    const prices = {};

    for (const sym of symbols) {
        const cacheFile = path.join(cacheDir, `${sym}_${startDate}_${endDate}.json`);
        if (fs.existsSync(cacheFile)) {
            prices[sym] = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            continue;
        }

        console.log(`Hole Kursdaten für ${sym}...`);
        try {
            const chart = await yf.chart(sym, {
                period1: startDate,
                period2: endDate,
                interval: '1d'
            });
            const quotes = chart.quotes
                .filter(q => q.close !== null && q.close !== undefined)
                .map(q => ({
                    date: q.date.toISOString().split('T')[0],
                    close: q.adjclose || q.close,
                    volume: q.volume || 0
                }));
            prices[sym] = quotes;
            fs.writeFileSync(cacheFile, JSON.stringify(quotes));
        } catch (e) {
            console.error(`Fehler bei ${sym}:`, e.message);
        }
    }

    return prices;
}

// Macro liquidity and real yield helper from DB / FRED
async function getMacroData(startDate) {
    let walcl = [];
    let rrp = [];
    let t10y2y = [];
    let wtregen = [];
    let dfii10 = [];

    try {
        if (process.env.DATABASE_URL) {
            const pool = mysql.createPool({
                uri: process.env.DATABASE_URL,
                connectTimeout: 3000
            });
            
            const toDateStr = (d) => {
                if (typeof d === 'string') return d.substring(0, 10);
                if (d instanceof Date) return d.toISOString().split('T')[0];
                return String(d).substring(0, 10);
            };

            const [wRows] = await pool.query(`
                SELECT observation_date as date, value 
                FROM econ_fred 
                WHERE series_id = 'WALCL' AND observation_date >= ?
                ORDER BY observation_date ASC
            `, [startDate]);
            walcl = wRows.map(r => ({ date: toDateStr(r.date), value: parseFloat(r.value) }));

            const [rRows] = await pool.query(`
                SELECT observation_date as date, value 
                FROM econ_fred 
                WHERE series_id = 'RRPONTSYD' AND observation_date >= ?
                ORDER BY observation_date ASC
            `, [startDate]);
            rrp = rRows.map(r => ({ date: toDateStr(r.date), value: parseFloat(r.value) }));

            const [tRows] = await pool.query(`
                SELECT observation_date as date, value 
                FROM econ_fred 
                WHERE series_id = 'T10Y2Y' AND observation_date >= ?
                ORDER BY observation_date ASC
            `, [startDate]);
            t10y2y = tRows.map(r => ({ date: toDateStr(r.date), value: parseFloat(r.value) }));

            const [dRows] = await pool.query(`
                SELECT observation_date as date, value 
                FROM econ_fred 
                WHERE series_id = 'DFII10' AND observation_date >= ?
                ORDER BY observation_date ASC
            `, [startDate]);
            dfii10 = dRows.map(r => ({ date: toDateStr(r.date), value: parseFloat(r.value) }));

            await pool.end();
        }
    } catch (e) {
        console.warn("DB-Verbindung nicht verfügbar:", e.message);
    }

    const fredApiKey = process.env.FRED_API_KEY;
    if (fredApiKey) {
        try {
            const url = `https://api.stlouisfed.org/fred/series/observations?series_id=WTREGEN&api_key=${fredApiKey}&file_type=json&observation_start=${startDate}`;
            const res = await fetch(url);
            const json = await res.json();
            if (json.observations) {
                wtregen = json.observations
                    .filter(o => o.value !== '.')
                    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
            }
        } catch (e) {
            console.error("Fehler beim Abruf von WTREGEN:", e.message);
        }
    }

    return { walcl, rrp, t10y2y, dfii10, wtregen };
}

// Indicator calculation helpers
function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sma.push(null);
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) sum += data[i - j];
            sma.push(sum / period);
        }
    }
    return sma;
}

function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const ema = [];
    let current = null;
    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (val === null || val === undefined) {
            ema.push(null);
            continue;
        }
        if (current === null) {
            current = val;
        } else {
            current = val * k + current * (1 - k);
        }
        ema.push(current);
    }
    return ema;
}

async function runMuzzledCathieWoodSimulation(options = {}) {
    const deRiskRate = options.deRiskRate !== undefined ? options.deRiskRate : 1.00; // 1.00 = 100% Voll-Evakuierung (50% Gold / 50% Cash), 0.50 = 50% De-Risking
    const goldRatio = options.goldRatio !== undefined ? options.goldRatio : 0.50;   // 0.50 = 50% Gold / 50% Cash, 1.0 = 100% Gold, 0.0 = 100% Cash
    const deRiskTech = options.deRiskTech !== undefined ? options.deRiskTech : true; // true = Tech + Mutterschiff, false = nur Mutterschiff
    const silent = options.silent || false;

    if (!silent) {
        console.log("================================================================================");
        console.log("   CRASHRADAR: MUZZLED CATHIE WOOD STRATEGIE – MASTER V3");
        console.log(`   60 % Tech / 40 % Krypto | Makro-DeRisk: ${(deRiskRate * 100).toFixed(0)}% (Gold: ${(goldRatio * 100).toFixed(0)}% / Cash: ${((1 - goldRatio) * 100).toFixed(0)}%) | Tech-DeRisk: ${deRiskTech}`);
        console.log("   Internes Verrechnungskonto | Krypto-Sub-Bucket (BTC/COIN/HOOD)");
        console.log("   Zeitraum: 2020-01-01 bis heute | Start: 10.000 € | Sparrate: 150 €/Monat");
        console.log("================================================================================\n");
    }

    const startDate = '2020-01-01';
    const endDate = '2026-09-06';

    const techSymbols = ['ZM', 'TDOC', 'ROKU', 'NVDA', 'TSLA', 'PLTR', 'SHOP'];
    const kryptoSymbols = ['BTC-USD', 'COIN', 'HOOD'];
    const benchmarkSymbols = ['QQQ', 'SPY', 'ARKK'];
    const hedgeSymbols = ['GLD', 'EURUSD=X'];
    const sectorSymbols = ['SMH', 'IGV', 'XLY'];

    const sectorMap = {
        NVDA: 'SMH',
        PLTR: 'IGV',
        ZM: 'IGV',
        TDOC: 'IGV',
        TSLA: 'XLY',
        SHOP: 'XLY',
        ROKU: 'QQQ'
    };

    const allSymbols = [...new Set([...techSymbols, ...kryptoSymbols, ...benchmarkSymbols, ...hedgeSymbols, ...sectorSymbols])];
    const prices = await getHistoricalPrices(allSymbols, '2019-01-01', endDate);
    const macro = await getMacroData('2019-01-01');

    // Fundamental Data Master Cache
    const fundamentalsPath = fs.existsSync(path.resolve(__dirname, 'fundamentals_master.json'))
        ? path.resolve(__dirname, 'fundamentals_master.json')
        : path.resolve(__dirname, '../architecture/strategies/fundamentals_master.json');
    let fundamentalsMaster = {};
    if (fs.existsSync(fundamentalsPath)) {
        fundamentalsMaster = JSON.parse(fs.readFileSync(fundamentalsPath, 'utf8'));
    }

    function getLatestFundamentals(symbol, date) {
        const filings = fundamentalsMaster[symbol] || [];
        const knownFilings = filings
            .filter(f => f.filing_date && f.filing_date <= date && f.revenue !== null)
            .sort((a, b) => a.filing_date.localeCompare(b.filing_date));
        if (knownFilings.length === 0) return null;
        const latest = knownFilings[knownFilings.length - 1];
        const prior = knownFilings.length > 1 ? knownFilings[knownFilings.length - 2] : null;
        return { latest, prior };
    }

    console.log("Kurs-, Makro- und Fundamentaldaten geladen. Berechne Indikatoren...");

    // Daily FX Map
    const fxMap = {};
    for (const q of prices['EURUSD=X'] || []) fxMap[q.date] = q.close;

    // Daily Price Maps
    const priceMaps = {};
    for (const sym of allSymbols) {
        priceMaps[sym] = {};
        for (const q of prices[sym] || []) {
            priceMaps[sym][q.date] = q.close;
        }
    }

    // Trading days list based on SPY
    const tradingDays = (prices['SPY'] || [])
        .map(q => q.date)
        .filter(d => d >= startDate && d <= endDate);

    // Build real yield map (DFII10)
    const dfii10Map = {};
    for (const row of macro.dfii10 || []) {
        dfii10Map[row.date] = row.value;
    }

    // Build Net Fed Liquidity 8-week Delta Map
    const netLiqDeltaMap = {};
    if (macro.walcl && macro.walcl.length > 0) {
        const wtregenMap = {};
        for (const w of macro.wtregen) wtregenMap[w.date] = w.value;
        const rrpMap = {};
        for (const r of macro.rrp) rrpMap[r.date] = r.value;

        const netLiqSeries = [];
        for (const w of macro.walcl) {
            const tga = wtregenMap[w.date] || 0;
            const rrpVal = (rrpMap[w.date] || 0) * 1000;
            const nl = w.value - tga - rrpVal;
            netLiqSeries.push({ date: w.date, nl });
        }

        for (let i = 8; i < netLiqSeries.length; i++) {
            const cur = netLiqSeries[i].nl;
            const past8 = netLiqSeries[i - 8].nl;
            const deltaPct = past8 > 0 ? ((cur - past8) / past8) * 100 : 0;
            netLiqDeltaMap[netLiqSeries[i].date] = deltaPct;
        }
    }

    // Technical Indicators for Tech Stocks & Sector Relativity
    const indicators = {};
    const qqqPrices = prices['QQQ'] || [];
    const qqqCloseMap = new Map(qqqPrices.map(q => [q.date, q.close]));

    for (const sym of [...techSymbols, 'COIN', 'HOOD']) {
        const quotes = prices[sym] || [];
        const closes = quotes.map(q => q.close);
        const volumes = quotes.map(q => q.volume);

        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200);
        const ema20 = calculateEMA(closes, 20);
        const sma50Vol = calculateSMA(volumes, 50);

        // RS Line vs QQQ
        const rsValues = quotes.map(q => {
            const qClose = qqqCloseMap.get(q.date);
            return qClose ? (q.close / qClose) : null;
        });
        const rsSMA50 = calculateSMA(rsValues.map(v => v || 0), 50);

        // Sektor-Relativität vs branchenspezifischem Sektor-ETF
        const secSym = sectorMap[sym] || 'QQQ';
        const secQuotes = prices[secSym] || [];
        const secCloseMap = new Map(secQuotes.map(q => [q.date, q.close]));
        const rsSectorValues = quotes.map(q => {
            const sClose = secCloseMap.get(q.date);
            return sClose ? (q.close / sClose) : null;
        });
        const rsSectorSMA50 = calculateSMA(rsSectorValues.map(v => v || 0), 50);

        const indMap = {};
        let recentHighs = [];

        for (let i = 0; i < quotes.length; i++) {
            const d = quotes[i].date;
            const c = quotes[i].close;
            const vol = quotes[i].volume;

            recentHighs.push({ date: d, close: c });
            if (recentHighs.length > 252) recentHighs.shift();
            const max52w = Math.max(...recentHighs.map(h => h.close));

            // 50-day local consolidation high (prior 50 days)
            let high50d = 0;
            if (i >= 50) {
                high50d = Math.max(...closes.slice(i - 50, i));
            }

            // Sektor 5-Tage-Return
            let sec5dReturn = 0;
            const curSecPrice = secCloseMap.get(d);
            if (i >= 5) {
                const pastSecPrice = secCloseMap.get(quotes[i - 5].date);
                if (curSecPrice && pastSecPrice) {
                    sec5dReturn = (curSecPrice - pastSecPrice) / pastSecPrice;
                }
            }

            indMap[d] = {
                close: c,
                volume: vol,
                sma50: sma50[i],
                sma200: sma200[i],
                ema20: ema20[i],
                sma50Vol: sma50Vol[i],
                high50d,
                rs: rsValues[i],
                rsSMA50: rsSMA50[i],
                rsSector: rsSectorValues[i],
                rsSectorSMA50: rsSectorSMA50[i],
                sec5dReturn,
                high52w: max52w
            };
        }
        indicators[sym] = indMap;
    }

    // BTC 21-week EMA (~105 daily bars)
    const btcQuotes = prices['BTC-USD'] || [];
    const btcCloses = btcQuotes.map(q => q.close);
    const btcEMA105 = calculateEMA(btcCloses, 105);
    const btcMap = {};
    for (let i = 0; i < btcQuotes.length; i++) {
        btcMap[btcQuotes[i].date] = {
            close: btcCloses[i],
            ema21w: btcEMA105[i]
        };
    }

    // =========================================================================
    // PORTFOLIO STATE & STRATEGISCHE 60/40 ALLOKATION (10.000 € Start)
    // =========================================================================
    let totalInvestedEUR = 10000;
    let lastEurUsd = fxMap[tradingDays[0]] || 1.12;
    let startUSD = totalInvestedEUR * lastEurUsd;

    let usdCash = 0; // Taktisches Cash (Skimming, De-Risking)
    let spyShares = 0; // S&P 500 Mutterschiff
    let gldShares = 0; // Gold Guard (GLD)

    // Internes Krypto-Verrechnungskonto
    let kryptoClaimUSD = 0; // Registrierte Krypto-Forderung im Mutterschiff
    let kryptoUndeployedUSD = 0; // Tranchen, die noch im Mutterschiff auf Abruf warten
    let btcSiloActive = false;
    let kryptoPositions = {}; // sym -> shares ('BTC-USD', 'COIN', 'HOOD')
    let kryptoReentryDayCount = 0;
    let kryptoPyramidStage = 0; // 0=none, 1=40%, 2=70%, 3=100%
    let totalKryptoReentryPoolUSD = 0;

    // Tech Sub-Bucket State (Organisch, unlimitiert)
    const techPositions = {}; // sym -> { shares, initialShares, costBasisUSD, flag, stage, consecutiveWeakFilings, lastDipBuyIdx }
    const skimCooldown = {};
    let consecutiveBelowSMA200 = {};
    const lastProcessedFiling = {};
    for (const sym of techSymbols) {
        skimCooldown[sym] = 0;
        consecutiveBelowSMA200[sym] = 0;
        lastProcessedFiling[sym] = null;
    }

    let macroGuardActive = false; // Option 2 (Druckenmiller 50% De-Risking)

    // Day 0: 60 % Tech (Mutterschiff) / 40 % Krypto
    const day0 = tradingDays[0];
    const spyP0 = priceMaps['SPY'][day0];
    const btcD0 = btcMap[day0];

    const coreStartUSD = startUSD * 0.60;
    const kryptoStartUSD = startUSD * 0.40;

    spyShares = coreStartUSD / spyP0;

    if (btcD0 && btcD0.close > btcD0.ema21w) {
        btcSiloActive = true;
        kryptoPositions['BTC-USD'] = kryptoStartUSD / btcD0.close;
        kryptoPyramidStage = 3;
    } else {
        // Krypto-Kapital parkt als Claim im S&P 500 Mutterschiff
        btcSiloActive = false;
        kryptoClaimUSD = kryptoStartUSD;
        spyShares += kryptoStartUSD / spyP0;
    }

    let lastMonth = day0.substring(0, 7);
    let tradeLog = [];

    function getTotalDepotUSD(d) {
        let val = usdCash;
        val += spyShares * (priceMaps['SPY'][d] || 0);
        val += gldShares * (priceMaps['GLD'][d] || 0);
        for (const k of Object.keys(kryptoPositions)) {
            const p = k === 'BTC-USD' ? (btcMap[d]?.close || 0) : (priceMaps[k][d] || 0);
            val += kryptoPositions[k] * p;
        }
        for (const s of Object.keys(techPositions)) {
            val += techPositions[s].shares * (priceMaps[s][d] || 0);
        }
        return val;
    }

    // Verfügbares freies Mutterschiff-Kapital für Tech-Zündfunken (nach Abzug des Krypto-Claims)
    function getAvailableMutterschiffForTech(d) {
        const curSpyP = priceMaps['SPY'][d] || 1;
        const totalMutterschiffUSD = spyShares * curSpyP;
        const totalClaim = kryptoClaimUSD + kryptoUndeployedUSD;
        const freeUSD = Math.max(0, totalMutterschiffUSD - totalClaim);
        return freeUSD;
    }

    // Reallokation von Tech-Erlösen
    function reallocateTechProceeds(proceedsUSD, date, excludedSym, reason) {
        if (proceedsUSD <= 0) return;
        const totalDepotUSD = getTotalDepotUSD(date);

        // Suche andere HOLD & BUY Tech-Titel mit Gewicht < 35 %
        const candidates = Object.keys(techPositions).filter(s => {
            if (s === excludedSym) return false;
            const pos = techPositions[s];
            if (pos.flag !== 'HOLD_AND_BUY') return false;
            const p = priceMaps[s][date] || 0;
            const w = (pos.shares * p) / totalDepotUSD;
            return w < 0.35;
        });

        if (candidates.length > 0) {
            const shareUSD = proceedsUSD / candidates.length;
            for (const cand of candidates) {
                const p = priceMaps[cand][date];
                if (p) {
                    techPositions[cand].shares += shareUSD / p;
                }
            }
            tradeLog.push({
                date,
                action: 'PROCEEDS_REALLOCATED',
                symbol: excludedSym,
                detail: `$${proceedsUSD.toFixed(0)} (${reason}) bevorzugt in aktive HOLD & BUY Gewinner (${candidates.join(', ')}) reinvestiert.`
            });
        } else {
            const curSpyP = priceMaps['SPY'][date] || 1;
            spyShares += proceedsUSD / curSpyP;
            tradeLog.push({
                date,
                action: 'PROCEEDS_TO_SPY',
                symbol: excludedSym,
                detail: `$${proceedsUSD.toFixed(0)} (${reason}) ins S&P 500 Mutterschiff geparkt.`
            });
        }
    }

    // =========================================================================
    // SIMULATION LOOP
    // =========================================================================
    for (let dIdx = 0; dIdx < tradingDays.length; dIdx++) {
        const date = tradingDays[dIdx];
        const curEurUsd = fxMap[date] || lastEurUsd;
        lastEurUsd = curEurUsd;

        // 1. Monatliche Sparrate (150 €: 60 % Tech / 40 % Krypto)
        const currentMonth = date.substring(0, 7);
        if (currentMonth !== lastMonth) {
            totalInvestedEUR += 150;
            const totalAddUSD = 150 * curEurUsd;
            const techAddUSD = totalAddUSD * 0.60;
            const kryptoAddUSD = totalAddUSD * 0.40;

            const curSpyPrice = priceMaps['SPY'][date] || 1;
            const curGldPrice = priceMaps['GLD'][date] || 1;

            if (macroGuardActive) {
                // Makro ROT: Defensiver Sparplan gemäß goldRatio (z. B. 50 % Cash / 50 % Gold)
                usdCash += totalAddUSD * (1.0 - goldRatio);
                gldShares += (totalAddUSD * goldRatio) / curGldPrice;
            } else {
                // Normalzustand:
                // Tech 60 % ins Mutterschiff
                spyShares += techAddUSD / curSpyPrice;

                // Krypto 40 %:
                if (btcSiloActive) {
                    // Gleichmäßig in aktive Krypto-Positionen
                    const activeKeys = Object.keys(kryptoPositions);
                    if (activeKeys.length > 0) {
                        const splitUSD = kryptoAddUSD / activeKeys.length;
                        for (const k of activeKeys) {
                            const p = k === 'BTC-USD' ? (btcMap[date]?.close || 1) : (priceMaps[k][date] || 1);
                            kryptoPositions[k] += splitUSD / p;
                        }
                    }
                } else {
                    // Parkt als Claim im S&P 500 Mutterschiff
                    kryptoClaimUSD += kryptoAddUSD;
                    spyShares += kryptoAddUSD / curSpyPrice;
                }
            }
            lastMonth = currentMonth;
        }

        // Cooldown Timer dekrementieren
        for (const sym of techSymbols) {
            if (skimCooldown[sym] > 0) skimCooldown[sym]--;
        }

        // 2. Makro-Ampel Auswertung (Net Fed Liquidity Delta + Real Yield DFII10)
        let latestDelta = null;
        for (let back = 0; back < 14; back++) {
            const checkD = new Date(new Date(date).getTime() - back * 86400000).toISOString().split('T')[0];
            if (netLiqDeltaMap[checkD] !== undefined) {
                latestDelta = netLiqDeltaMap[checkD];
                break;
            }
        }

        let latestYield = null;
        for (let back = 0; back < 10; back++) {
            const checkD = new Date(new Date(date).getTime() - back * 86400000).toISOString().split('T')[0];
            if (dfii10Map[checkD] !== undefined) {
                latestYield = dfii10Map[checkD];
                break;
            }
        }

        const isLiquidityCrisis = latestDelta !== null && latestDelta < -5.0;
        const isMacroRed = isLiquidityCrisis;
        const isMacroGreen = latestDelta !== null && latestDelta >= 0.0;

        // =====================================================================
        // MAKRO-SCHUTZ: 50 % DE-RISKING (OPTION 2: 25 % GOLD + 25 % CASH)
        // Greift zwingend auf Tech-Bucket UND S&P 500 Mutterschiff!
        // =====================================================================
        if (!macroGuardActive && isMacroRed) {
            macroGuardActive = true;
            const gldPrice = priceMaps['GLD'][date] || 1;
            const curSpyP = priceMaps['SPY'][date] || 1;

            let totalShiftUSD = 0;

            // 1. Aus S&P 500 Mutterschiff: deRiskRate de-risken
            const spyVal = spyShares * curSpyP;
            const spyShift = spyVal * deRiskRate;
            spyShares *= (1.0 - deRiskRate);
            totalShiftUSD += spyShift;

            // 2. Aus ALLEN aktiven Tech-Positionen: deRiskRate de-risken (falls deRiskTech aktiv)
            if (deRiskTech) {
                for (const sym of Object.keys(techPositions)) {
                    const p = priceMaps[sym][date] || 0;
                    const tVal = techPositions[sym].shares * p;
                    const tShift = tVal * deRiskRate;
                    techPositions[sym].shares *= (1.0 - deRiskRate);
                    totalShiftUSD += tShift;
                    if (techPositions[sym].shares <= 0.0001) {
                        delete techPositions[sym];
                    }
                }
            }

            // Aufteilung: goldRatio in Gold, Rest in Cash
            const toGoldUSD = totalShiftUSD * goldRatio;
            const toCashUSD = totalShiftUSD * (1.0 - goldRatio);

            if (gldPrice > 0) gldShares += toGoldUSD / gldPrice;
            usdCash += toCashUSD;

            const triggerDetail = `NetLiq-Delta ${latestDelta ? latestDelta.toFixed(2) : '0'}% < -5%`;

            tradeLog.push({
                date,
                action: `MAKRO_GUARD_ON_${(deRiskRate * 100).toFixed(0)}PCT`,
                detail: `Makro ROT [${triggerDetail}]. ${(deRiskRate * 100).toFixed(0)}% De-Risking (${(goldRatio * 100).toFixed(0)}% Gold = $${toGoldUSD.toFixed(0)}, ${((1 - goldRatio) * 100).toFixed(0)}% Cash = $${toCashUSD.toFixed(0)}) evakuiert!`
            });
        } else if (macroGuardActive && isMacroGreen) {
            macroGuardActive = false;
            const gldPrice = priceMaps['GLD'][date] || 1;
            const curSpyP = priceMaps['SPY'][date] || 1;

            const totalGoldUSD = gldShares * gldPrice;
            gldShares = 0;

            // Reinvestition: Gold & Cash-Puffer fließen zurück ins S&P 500 Mutterschiff
            // (und stehen damit sofort für neue Tech-Zündfunken & Krypto bereit)
            const totalRecoveryUSD = totalGoldUSD + usdCash;
            usdCash = 0;
            spyShares += totalRecoveryUSD / curSpyP;

            tradeLog.push({
                date,
                action: 'MAKRO_GUARD_OFF',
                detail: `Makro GRÜN [NetLiq-Delta ${latestDelta.toFixed(2)}% >= 0%]. Schutzschirm aufgelöst ($${totalRecoveryUSD.toFixed(0)}) & vollständig zurück ins S&P 500 Mutterschiff reinvestiert.`
            });
        }

        // =====================================================================
        // 3. KRYPTO SUB-BUCKET (BTC, COIN, HOOD) – 21-Wochen-EMA Regime
        // =====================================================================
        const btcData = btcMap[date];
        if (btcData && btcData.ema21w) {
            const curSpyP = priceMaps['SPY'][date] || 1;

            // KRYPTO-EXIT: Bitcoin bricht 21W-EMA nach unten
            if (btcSiloActive && btcData.close < btcData.ema21w * 0.98) {
                btcSiloActive = false;
                kryptoPyramidStage = 0;
                kryptoReentryDayCount = 0;

                let totalExitUSD = 0;
                for (const k of Object.keys(kryptoPositions)) {
                    const p = k === 'BTC-USD' ? btcData.close : (priceMaps[k][date] || 0);
                    totalExitUSD += kryptoPositions[k] * p;
                }
                kryptoPositions = {};

                // Reinvestition der liquiden Krypto-Erlöse ins Mutterschiff
                spyShares += totalExitUSD / curSpyP;

                // Der neue Krypto-Claim setzt sich zusammen aus den verkauften Positionen
                // PLUS den Tranchen, die noch gar nicht aus dem Mutterschiff entnommen wurden!
                kryptoClaimUSD = totalExitUSD + kryptoUndeployedUSD;
                kryptoUndeployedUSD = 0;
                totalKryptoReentryPoolUSD = 0;

                tradeLog.push({
                    date,
                    action: 'KRYPTO_SUB_BUCKET_EXIT',
                    detail: `BTC ($${btcData.close.toFixed(0)}) < 21W-EMA. 100% Krypto liquidiert ($${totalExitUSD.toFixed(0)}). Krypto-Claim im S&P 500 Mutterschiff: $${kryptoClaimUSD.toFixed(0)}. Status: OBSERVE.`
                });
            }
            // KRYPTO-RE-ENTRY: Bitcoin klettert über 21W-EMA & Makro nicht ROT
            else if (!btcSiloActive && btcData.close > btcData.ema21w * 1.02 && !isMacroRed) {
                btcSiloActive = true;
                kryptoReentryDayCount = 1;
                kryptoPyramidStage = 1;

                totalKryptoReentryPoolUSD = kryptoClaimUSD;
                kryptoUndeployedUSD = kryptoClaimUSD;
                kryptoClaimUSD = 0; // Gesamter Anspruch wird in Pyramiden-Pool überführt

                // Qualifizierte Krypto-Kandidaten bestimmen:
                // BTC ist Basis-Asset. COIN & HOOD qualifizieren sich bei Ausbruch über SMA 200 (Stage-2-Nachweis)
                const activeCandidates = ['BTC-USD'];
                if (priceMaps['COIN'] && priceMaps['COIN'][date] && indicators['COIN'] && indicators['COIN'][date]?.sma200 && priceMaps['COIN'][date] > indicators['COIN'][date].sma200) {
                    activeCandidates.push('COIN');
                }
                if (priceMaps['HOOD'] && priceMaps['HOOD'][date] && indicators['HOOD'] && indicators['HOOD'][date]?.sma200 && priceMaps['HOOD'][date] > indicators['HOOD'][date].sma200) {
                    activeCandidates.push('HOOD');
                }

                // Tranche 1: 40 % des Pools gleichmäßig aufgeteilt
                const t1USD = totalKryptoReentryPoolUSD * 0.40;
                spyShares -= t1USD / curSpyP; // Aus Mutterschiff entnehmen
                kryptoUndeployedUSD -= t1USD;

                const splitUSD = t1USD / activeCandidates.length;
                for (const k of activeCandidates) {
                    const p = k === 'BTC-USD' ? btcData.close : priceMaps[k][date];
                    kryptoPositions[k] = (kryptoPositions[k] || 0) + (splitUSD / p);
                }

                tradeLog.push({
                    date,
                    action: 'KRYPTO_REENTRY_TRANCHE_1',
                    detail: `BTC ($${btcData.close.toFixed(0)}) > 21W-EMA. Tranche 1 (40% = $${t1USD.toFixed(0)}) aus Mutterschiff gleichmäßig in [${activeCandidates.join(', ')}] allokiert. Status: BUY!`
                });
            }
            // Krypto-Pyramide Stufe 2 & 3 bei Trendbestätigung
            else if (btcSiloActive && kryptoPyramidStage < 3) {
                kryptoReentryDayCount++;
                const curSpyP = priceMaps['SPY'][date] || 1;

                const activeCandidates = ['BTC-USD'];
                if (priceMaps['COIN'] && priceMaps['COIN'][date] && indicators['COIN'] && indicators['COIN'][date]?.sma200 && priceMaps['COIN'][date] > indicators['COIN'][date].sma200) {
                    activeCandidates.push('COIN');
                }
                if (priceMaps['HOOD'] && priceMaps['HOOD'][date] && indicators['HOOD'] && indicators['HOOD'][date]?.sma200 && priceMaps['HOOD'][date] > indicators['HOOD'][date].sma200) {
                    activeCandidates.push('HOOD');
                }

                // Tranche 2 (30 % nach 15 Handelstagen über 21W-EMA)
                if (kryptoPyramidStage === 1 && kryptoReentryDayCount >= 15 && !isMacroRed) {
                    kryptoPyramidStage = 2;
                    const t2USD = totalKryptoReentryPoolUSD * 0.30;
                    spyShares -= t2USD / curSpyP;
                    kryptoUndeployedUSD -= t2USD;

                    const splitUSD = t2USD / activeCandidates.length;
                    for (const k of activeCandidates) {
                        const p = k === 'BTC-USD' ? btcData.close : priceMaps[k][date];
                        kryptoPositions[k] = (kryptoPositions[k] || 0) + (splitUSD / p);
                    }

                    tradeLog.push({
                        date,
                        action: 'KRYPTO_PYRAMIDE_TRANCHE_2',
                        detail: `15 Tage Trendbestätigung. Tranche 2 (30% = $${t2USD.toFixed(0)}) gleichmäßig in [${activeCandidates.join(', ')}] allokiert.`
                    });
                }
                // Tranche 3 (30 % nach 30 Handelstagen über 21W-EMA)
                else if (kryptoPyramidStage === 2 && kryptoReentryDayCount >= 30 && !isMacroRed) {
                    kryptoPyramidStage = 3;
                    const t3USD = totalKryptoReentryPoolUSD * 0.30;
                    spyShares -= t3USD / curSpyP;
                    kryptoUndeployedUSD -= t3USD;

                    const splitUSD = t3USD / activeCandidates.length;
                    for (const k of activeCandidates) {
                        const p = k === 'BTC-USD' ? btcData.close : priceMaps[k][date];
                        kryptoPositions[k] = (kryptoPositions[k] || 0) + (splitUSD / p);
                    }

                    tradeLog.push({
                        date,
                        action: 'KRYPTO_PYRAMIDE_TRANCHE_3',
                        detail: `30 Tage Trendbestätigung. Tranche 3 (30% = $${t3USD.toFixed(0)}) vollendet Krypto-Allokation in [${activeCandidates.join(', ')}].`
                    });
                }
            }
        }

        // =====================================================================
        // 4. TECH-EINZELTITEL: FLAG-SYSTEM, SEKTOR-RELATIVITÄT & 3-STUFEN-EXIT
        // =====================================================================
        const totalDepotUSD = getTotalDepotUSD(date);

        // Anti-Klumpen Pullback-Skimming Prüfung (> 35% Anteil + Bruch 20-Tage-EMA)
        for (const sym of Object.keys(techPositions)) {
            const pos = techPositions[sym];
            const ind = indicators[sym] ? indicators[sym][date] : null;
            if (!ind || !ind.ema20) continue;

            const posValUSD = pos.shares * ind.close;
            const weight = posValUSD / totalDepotUSD;

            if (weight >= 0.35 && skimCooldown[sym] === 0 && ind.close < ind.ema20) {
                const skimShares = pos.shares * 0.10;
                pos.shares -= skimShares;
                const skimUSD = skimShares * ind.close;

                const curSpyP = priceMaps['SPY'][date] || 1;
                spyShares += (skimUSD * 0.75) / curSpyP;
                usdCash += skimUSD * 0.25;
                skimCooldown[sym] = 20;

                tradeLog.push({
                    date,
                    action: 'PULLBACK_SKIM',
                    symbol: sym,
                    detail: `Klumpenrisiko ${(weight * 100).toFixed(1)}% & Bruch 20T-EMA: 10% geskimmt ($${skimUSD.toFixed(0)}). 75% in S&P 500, 25% Cash.`
                });
            }
        }

        // Täglicher Tech-Positions-Check (10-Q & Trend-Notanker)
        for (const sym of Object.keys(techPositions)) {
            const pos = techPositions[sym];
            const ind = indicators[sym] ? indicators[sym][date] : null;
            if (!ind) continue;

            const curPrice = ind.close;

            // A. FUNDAMENTAL-CHECK (SEC 10-Q)
            const fund = getLatestFundamentals(sym, date);
            if (fund && fund.latest && fund.latest.filing_date !== lastProcessedFiling[sym]) {
                lastProcessedFiling[sym] = fund.latest.filing_date;

                const latestYoY = fund.latest.yoy_revenue_growth_pct;
                const priorYoY = fund.prior ? fund.prior.yoy_revenue_growth_pct : null;
                const netInc = fund.latest.net_income;
                const rev = fund.latest.revenue;
                const isProfitableTurnaround = netInc > 0 && (!fund.prior || fund.prior.net_income <= 0);

                const isStrongGrowth = (latestYoY !== null && latestYoY >= 20.0) || isProfitableTurnaround;
                const isGrowthDecel = (latestYoY !== null) && ((netInc <= 0 && latestYoY < 18.0) || (latestYoY < 15.0));
                const isCatastrophicLoss = (netInc !== null && rev !== null && netInc < 0 && Math.abs(netInc) > 2.0 * rev);

                if (isStrongGrowth) {
                    if (pos.flag === 'HOLD_AND_OBSERVE') {
                        pos.flag = 'HOLD_AND_BUY';
                        pos.stage = 0;
                        pos.consecutiveWeakFilings = 0;
                        tradeLog.push({
                            date,
                            action: 'REHABILITATION_HOLD_BUY',
                            symbol: sym,
                            detail: `Quartalszahlen stark (+${latestYoY?.toFixed(1)}% YoY)! Rehabilitation zu HOLD & BUY.`
                        });
                    }
                } else if (isGrowthDecel || isCatastrophicLoss) {
                    pos.consecutiveWeakFilings++;

                    if (pos.consecutiveWeakFilings === 1) {
                        // STUFE 1: Erstes schwaches Quartal -> 1/3 Teil-Exit
                        pos.flag = 'HOLD_AND_OBSERVE';
                        pos.stage = 1;
                        const soldShares = pos.shares * (1 / 3);
                        pos.shares -= soldShares;
                        const proceedsUSD = soldShares * curPrice;
                        const reason = isCatastrophicLoss
                            ? `Bilanzkollaps (Verlust: $${(netInc / 1e6).toFixed(0)}M)`
                            : `Wachstumsverlangsamung < 18% (YoY: ${latestYoY?.toFixed(1)}%)`;

                        tradeLog.push({
                            date,
                            action: 'STUFE_1_EARNINGS_DECEL_EXIT',
                            symbol: sym,
                            detail: `1/3 Teil-Exit @ $${curPrice.toFixed(2)} [${reason}]. Status: HOLD & OBSERVE.`
                        });
                        reallocateTechProceeds(proceedsUSD, date, sym, 'Stufe 1 Teil-Exit');
                    } else if (pos.consecutiveWeakFilings >= 2) {
                        // STUFE 3: Zweites schwaches Quartal -> 100 % Rest-Exit
                        const soldShares = pos.shares;
                        const proceedsUSD = soldShares * curPrice;
                        delete techPositions[sym];
                        consecutiveBelowSMA200[sym] = 0;

                        tradeLog.push({
                            date,
                            action: 'STUFE_3_ZOMBIE_LIQUIDATION',
                            symbol: sym,
                            detail: `100% Rest-Exit @ $${curPrice.toFixed(2)} [2. schwaches Quartal: Q: ${latestYoY?.toFixed(1)}%].`
                        });
                        const curSpyP = priceMaps['SPY'][date] || 1;
                        spyShares += proceedsUSD / curSpyP;
                        continue;
                    }
                }
            }

            // B. TÄGLICHE TREND- & NOTANKER-PRÜFUNG
            if (ind.sma200 && curPrice < ind.sma200) {
                consecutiveBelowSMA200[sym]++;
            } else {
                consecutiveBelowSMA200[sym] = 0;
            }

            if (pos.flag === 'HOLD_AND_BUY') {
                // KONTRÄRES DIP-BUYING (Nur wenn Makro GRÜN ist!)
                const posValUSD = pos.shares * curPrice;
                const currentWeight = posValUSD / totalDepotUSD;
                const daysSinceDipBuy = pos.lastDipBuyIdx !== undefined ? (dIdx - pos.lastDipBuyIdx) : 999;
                const sec5dReturn = ind.sec5dReturn || 0;
                const isSectorDip = sec5dReturn <= -0.035 && curPrice < ind.ema20;
                const isStockPullback = ind.high50d && (curPrice - ind.high50d) / ind.high50d <= -0.10 && curPrice < ind.ema20;
                const isDip = isSectorDip || isStockPullback;

                const curSpyP = priceMaps['SPY'][date] || 1;
                const freeMutterschiffUSD = getAvailableMutterschiffForTech(date);

                if (!macroGuardActive && isDip && currentWeight < 0.35 && daysSinceDipBuy >= 20 && freeMutterschiffUSD >= 2000) {
                    const dipAllocUSD = Math.min(freeMutterschiffUSD * 0.15, 5000);
                    spyShares -= dipAllocUSD / curSpyP;
                    const addShares = dipAllocUSD / curPrice;
                    pos.shares += addShares;
                    pos.lastDipBuyIdx = dIdx;

                    tradeLog.push({
                        date,
                        action: 'CONTRARIAN_DIP_BUY',
                        symbol: sym,
                        detail: `Branchen-Dip (${(sec5dReturn * 100).toFixed(1)}% Sektor @ $${curPrice.toFixed(2)}): $${dipAllocUSD.toFixed(0)} konträr aus freiem Mutterschiff nachgekauft.`
                    });
                }
            } else if (pos.flag === 'HOLD_AND_OBSERVE') {
                // STUFE 2: TREND-NOTANKER BEI SINKFLUG
                const rsSectorWeak = ind.rsSectorSMA50 ? (ind.rsSector < ind.rsSectorSMA50) : true;
                if (consecutiveBelowSMA200[sym] >= 3 && rsSectorWeak && pos.stage === 1) {
                    const soldShares = pos.shares * 0.5;
                    pos.shares -= soldShares;
                    pos.stage = 2;
                    const proceedsUSD = soldShares * curPrice;

                    tradeLog.push({
                        date,
                        action: 'STUFE_2_TREND_SMA200_EXIT',
                        symbol: sym,
                        detail: `Weiteres 1/3 verkauft @ $${curPrice.toFixed(2)} (HOLD & OBSERVE: 3 Tage < SMA 200 & Sektor-Schwäche).`
                    });
                    reallocateTechProceeds(proceedsUSD, date, sym, 'Stufe 2 Trend-Exit');
                }
            }
        }

        // =====================================================================
        // 5. TECH SUB-BUCKET: EINSTIEGS-TÜRSTEHER (Organisch, unlimitiert)
        // =====================================================================
        if (!macroGuardActive && !isMacroRed) {
            for (const sym of techSymbols) {
                if (techPositions[sym]) continue;

                const ind = indicators[sym] ? indicators[sym][date] : null;
                if (!ind || !ind.high50d || !ind.sma50 || !ind.sma200 || !ind.sma50Vol) continue;

                const isVolumeSpike = ind.volume >= 1.5 * ind.sma50Vol;
                const isStage2Breakout = ind.close > ind.high50d && ind.close > ind.sma200 && ind.close > ind.sma50 && ind.rs > ind.rsSMA50 && isVolumeSpike;

                if (!isStage2Breakout) continue;

                let isFundamentalPermitted = true;
                const fund = getLatestFundamentals(sym, date);
                if (fund && fund.latest) {
                    const yoy = fund.latest.yoy_revenue_growth_pct;
                    const isProfitableTurnaround = fund.latest.net_income > 0 && (!fund.prior || fund.prior.net_income <= 0);
                    const isCatastrophic = (fund.latest.net_income < 0 && Math.abs(fund.latest.net_income) > 2.0 * fund.latest.revenue);
                    if ((yoy !== null && yoy < 15.0 && !isProfitableTurnaround) || isCatastrophic) {
                        isFundamentalPermitted = false;
                    }
                }

                if (isFundamentalPermitted) {
                    const curSpyP = priceMaps['SPY'][date] || 1;
                    const freeMutterschiffUSD = getAvailableMutterschiffForTech(date);
                    const allocUSD = freeMutterschiffUSD * 0.35; // 35 % des freien Mutterschiffs

                    if (allocUSD >= 500) {
                        spyShares -= allocUSD / curSpyP;
                        const shares = allocUSD / ind.close;
                        techPositions[sym] = {
                            shares,
                            initialShares: shares,
                            costBasisUSD: ind.close,
                            flag: 'HOLD_AND_BUY',
                            stage: 0,
                            consecutiveWeakFilings: 0,
                            lastDipBuyIdx: -999
                        };
                        consecutiveBelowSMA200[sym] = 0;
                        lastProcessedFiling[sym] = getLatestFundamentals(sym, date)?.latest?.filing_date || null;
                        tradeLog.push({
                            date,
                            action: 'TECH_STAGE_2_ENTRY',
                            symbol: sym,
                            detail: `Stage-2-Ausbruch über 50T-Hoch ($${ind.high50d.toFixed(2)}) @ $${ind.close.toFixed(2)}. $${allocUSD.toFixed(0)} aus freiem Mutterschiff investiert. Status: HOLD & BUY.`
                        });
                    }
                }
            }
        }
    }

    // =========================================================================
    // FINAL REPORTING & BENCHMARK COMPARISONS
    // =========================================================================
    const lastDate = tradingDays[tradingDays.length - 1];
    const finalEurUsd = fxMap[lastDate] || 1.10;

    let finalSpyValUSD = spyShares * (priceMaps['SPY'][lastDate] || 0);
    let finalGldValUSD = gldShares * (priceMaps['GLD'][lastDate] || 0);

    let totalKryptoValUSD = 0;
    const kryptoBreakdown = [];
    for (const k of Object.keys(kryptoPositions)) {
        const p = k === 'BTC-USD' ? (btcMap[lastDate]?.close || 0) : (priceMaps[k][lastDate] || 0);
        const v = kryptoPositions[k] * p;
        totalKryptoValUSD += v;
        kryptoBreakdown.push({ symbol: k, shares: kryptoPositions[k].toFixed(4), price: p.toFixed(2), valUSD: v });
    }

    let totalTechValUSD = 0;
    const techBreakdown = [];
    for (const sym of Object.keys(techPositions)) {
        const p = priceMaps[sym][lastDate] || 0;
        const v = techPositions[sym].shares * p;
        totalTechValUSD += v;
        techBreakdown.push({
            symbol: sym,
            shares: techPositions[sym].shares.toFixed(2),
            price: p.toFixed(2),
            valUSD: v,
            flag: techPositions[sym].flag,
            stage: techPositions[sym].stage
        });
    }

    const totalPortfolioUSD = usdCash + finalSpyValUSD + finalGldValUSD + totalKryptoValUSD + totalTechValUSD;
    const totalPortfolioEUR = totalPortfolioUSD / finalEurUsd;
    const netProfitEUR = totalPortfolioEUR - totalInvestedEUR;
    const returnPct = ((netProfitEUR / totalInvestedEUR) * 100).toFixed(2);

    const arkkStart = priceMaps['ARKK'][tradingDays[0]];
    const arkkEnd = priceMaps['ARKK'][lastDate];
    const arkkReturn = arkkStart && arkkEnd ? ((arkkEnd - arkkStart) / arkkStart * 100).toFixed(2) : 'N/A';

    const qqqStart = priceMaps['QQQ'][tradingDays[0]];
    const qqqEnd = priceMaps['QQQ'][lastDate];
    const qqqReturn = qqqStart && qqqEnd ? ((qqqEnd - qqqStart) / qqqStart * 100).toFixed(2) : 'N/A';

    const spyStart = priceMaps['SPY'][tradingDays[0]];
    const spyEnd = priceMaps['SPY'][lastDate];
    const spyReturn = spyStart && spyEnd ? ((spyEnd - spyStart) / spyStart * 100).toFixed(2) : 'N/A';

    const btcStart = btcMap[tradingDays[0]] ? btcMap[tradingDays[0]].close : 0;
    const btcEnd = btcMap[lastDate] ? btcMap[lastDate].close : 0;
    const btcReturn = btcStart && btcEnd ? ((btcEnd - btcStart) / btcStart * 100).toFixed(2) : 'N/A';

    console.log("\n================================================================================");
    console.log(`   FINALE ERGEBNIS-BILANZ (MASTER V3: 60/40) | STAND: ${lastDate}`);
    console.log("================================================================================");
    console.log(`Gesamteinzahlung:        € ${totalInvestedEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (10.000 € Start + Sparraten)`);
    console.log(`Endwert Muzzled Cathie:  € ${totalPortfolioEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($ ${totalPortfolioUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
    console.log(`Nettogewinn:             € ${netProfitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${returnPct} %)`);
    console.log("--------------------------------------------------------------------------------");
    console.log("ALLOKATION ZUM STICHTAG (SILO-ÜBERSICHT):");
    console.log(`* S&P 500 Mutterschiff:      ${spyShares.toFixed(2)} SPY | € ${(finalSpyValUSD / finalEurUsd).toFixed(2)} (${((finalSpyValUSD / totalPortfolioUSD) * 100).toFixed(1)} %)`);
    const totalClaimUSD = kryptoClaimUSD + kryptoUndeployedUSD;
    if (totalClaimUSD > 0) {
        console.log(`* Krypto-Claim im Mutterschiff: $ ${totalClaimUSD.toFixed(0)} (€ ${(totalClaimUSD / finalEurUsd).toFixed(2)}) [Geparkt als Leihgabe für Tech-Compounding]`);
    }
    for (const kb of kryptoBreakdown) {
        const kEur = kb.valUSD / finalEurUsd;
        const w = (kb.valUSD / totalPortfolioUSD) * 100;
        console.log(`* Krypto-Silo (${kb.symbol.padEnd(7)}):     ${kb.shares.padStart(8)} Stk. à $${kb.price.padStart(7)} | € ${kEur.toFixed(2).padStart(9)} (${w.toFixed(1)} %) [Aktiv]`);
    }
    if (gldShares > 0) {
        console.log(`* Gold-Guard (GLD):          ${gldShares.toFixed(2)} GLD | € ${(finalGldValUSD / finalEurUsd).toFixed(2)} (${((finalGldValUSD / totalPortfolioUSD) * 100).toFixed(1)} %) [Hedge Aktiv]`);
    } else {
        console.log(`* Gold-Guard (GLD):          0.00 GLD (Kein systemischer Liquiditätsalarm, 100 % produktiv)`);
    }
    if (usdCash > 0) {
        console.log(`* Verrechnungskonto (Cash):  € ${(usdCash / finalEurUsd).toFixed(2)} ($ ${usdCash.toFixed(2)}) (${((usdCash / totalPortfolioUSD) * 100).toFixed(1)} %)`);
    }
    for (const t of techBreakdown) {
        const tEur = t.valUSD / finalEurUsd;
        const w = (t.valUSD / totalPortfolioUSD) * 100;
        console.log(`* Tech-Bucket (${t.symbol.padEnd(5)}):        ${t.shares.padStart(7)} Stk. à $${t.price.padStart(7)} | € ${tEur.toFixed(2).padStart(9)} (${w.toFixed(1)} %) [${t.flag} / Stufe ${t.stage}]`);
    }

    console.log("--------------------------------------------------------------------------------");
    console.log("BENCHMARK-VERGLEICH (2020 BIS HEUTE):");
    console.log(`* ARKK ETF (Original Cathie Wood):  +${arkkReturn} %`);
    console.log(`* S&P 500 Buy & Hold (SPY):         +${spyReturn} %`);
    console.log(`* Nasdaq 100 Buy & Hold (QQQ):      +${qqqReturn} %`);
    console.log(`* Bitcoin Buy & Hold (BTC):         +${btcReturn} %`);
    console.log(`* MUZZLED CATHIE WOOD STRATEGIE:    +${returnPct} %`);
    console.log("--------------------------------------------------------------------------------");
    console.log(`ALPHA vs. ARKK (Cathie Wood):       +${(returnPct - parseFloat(arkkReturn)).toFixed(2)} %-Punkte Outperformance!`);
    console.log(`ALPHA vs. QQQ (Nasdaq 100):         +${(returnPct - parseFloat(qqqReturn)).toFixed(2)} %-Punkte Outperformance!`);
    console.log("================================================================================\n");

    console.log("--------------------------------------------------------------------------------");
    console.log("ÜBERGEORDNETE MAKRO- & KRYPTO-EREIGNISSE (DE-RISKING & KRYPTO-REGIME):");
    const macroTrades = tradeLog.filter(t => !t.symbol);
    if (macroTrades.length === 0) {
        console.log("    Keine übergeordneten Makro-Ereignisse.");
    } else {
        for (const t of macroTrades) {
            console.log(`    [${t.date}] ${t.action.padEnd(28)} | ${t.detail}`);
        }
    }

    console.log("--------------------------------------------------------------------------------");
    console.log("TRANSAKTIONEN JE TECH-TITEL:");
    for (const sym of techSymbols) {
        const symTrades = tradeLog.filter(t => t.symbol === sym);
        console.log(`\n>>> ${sym} (${symTrades.length} Transaktionen):`);
        if (symTrades.length === 0) {
            console.log("    Keine Trades.");
        } else {
            for (const t of symTrades) {
                console.log(`    [${t.date}] ${t.action.padEnd(28)} | ${t.detail}`);
            }
        }
    }

    return {
        totalPortfolioEUR,
        totalPortfolioUSD,
        netProfitEUR,
        returnPct: parseFloat(returnPct),
        arkkReturn: parseFloat(arkkReturn),
        qqqReturn: parseFloat(qqqReturn),
        spyReturn: parseFloat(spyReturn),
        btcReturn: parseFloat(btcReturn),
        spyShares,
        gldShares,
        usdCash,
        kryptoClaimUSD,
        kryptoUndeployedUSD,
        techPositions,
        kryptoPositions,
        tradeLog
    };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('MuzzledCathieWoodSimulation.js')) {
    runMuzzledCathieWoodSimulation().catch(err => {
        console.error("Fehler bei Simulation:", err);
        process.exit(1);
    });
}

export { runMuzzledCathieWoodSimulation };
