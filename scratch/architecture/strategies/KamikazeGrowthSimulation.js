import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { PanicCapitulationIndicator } from '../../../src/analysis/indicators/PanicCapitulationIndicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

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
    const ema = [];
    const k = 2 / (period + 1);
    let prevEMA = null;
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            ema.push(null);
        } else if (i === period - 1) {
            let sum = 0;
            for (let j = 0; j < period; j++) sum += data[i - j];
            prevEMA = sum / period;
            ema.push(prevEMA);
        } else {
            const cur = data[i] * k + prevEMA * (1 - k);
            ema.push(cur);
            prevEMA = cur;
        }
    }
    return ema;
}

export async function runKamikazeSimulation(options = {}) {
    console.log("================================================================================");
    console.log("   KAMIKAZE GROWTH (KMG) SIMULATION (50/50 TECH & KRYPTO-EQUITIES)");
    console.log("================================================================================\n");

    const startDate = options.startDate || '2021-01-01'; // Default: ab 2021 (wo die meisten Ticker wie SOFI, S, PLTR gelistet sind)
    const endDate = options.endDate || '2026-09-06';
    const initialCapitalUSD = options.initialCapitalUSD || 90000;

    const techSymbols = ['PLTR', 'NVTS', 'IBRX', 'AIRO', 'SOFI', 'S'];
    const kryptoSymbols = ['MSTR', 'MARA', 'BMNR', 'BLSH'];
    const benchmarkSymbols = ['SPY', 'QQQ', 'BTC-USD'];
    const hedgeSymbols = ['GLD'];
    const sectorSymbols = ['SMH', 'IGV'];

    const sectorMap = {
        PLTR: 'IGV',
        S: 'IGV',
        NVTS: 'SMH',
        IBRX: 'QQQ',
        AIRO: 'QQQ',
        SOFI: 'QQQ'
    };

    const cacheDir = path.resolve(__dirname, 'cache');
    const allSymbols = [...new Set([...techSymbols, ...kryptoSymbols, ...benchmarkSymbols, ...hedgeSymbols, ...sectorSymbols])];

    const prices = {};
    for (const sym of allSymbols) {
        const cacheFile = path.join(cacheDir, `${sym}_2014-10-01_2026-09-06.json`);
        if (fs.existsSync(cacheFile)) {
            prices[sym] = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        } else {
            console.warn(`Keine Cache-Datei für ${sym}`);
            prices[sym] = [];
        }
    }

    const priceMaps = {};
    for (const sym of allSymbols) {
        priceMaps[sym] = {};
        for (const q of prices[sym] || []) {
            priceMaps[sym][q.date] = q.close;
        }
    }

    const fundamentalsPath = path.resolve(__dirname, 'fundamentals_master.json');
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

    // Macro Timeline Data
    const netLiqDeltaMap = {};
    const panicCapitulationMap = {};

    try {
        if (process.env.DATABASE_URL) {
            const fe = new FinanceExpert();
            const timeline = await fe.getDailyGroupedData('2014-10-01', { bypassMemoryGuard: true });
            await fe.close();

            if (timeline && timeline.length > 0) {
                const panicInd = new PanicCapitulationIndicator();
                for (let i = 90; i < timeline.length; i++) {
                    const panicRes = panicInd.evaluate(timeline.slice(0, i + 1));
                    if (panicRes && panicRes.status === 'CRITICAL') {
                        panicCapitulationMap[timeline[i].date] = true;
                    }
                }

                const weeklyNetLiq = [];
                for (let i = 0; i < timeline.length; i++) {
                    const day = timeline[i];
                    const nl = day.macroGroups?.NetLiquidity;
                    if (nl && nl.WALCL !== undefined && nl.TGA !== undefined && nl.RRPONTSYD !== undefined) {
                        const dObj = new Date(day.date);
                        if (dObj.getDay() === 4 || weeklyNetLiq.length === 0) {
                            const val = nl.WALCL - nl.TGA - nl.RRPONTSYD;
                            weeklyNetLiq.push({ date: day.date, netLiq: val });
                        }
                    }
                }
                for (let i = 8; i < weeklyNetLiq.length; i++) {
                    const cur = weeklyNetLiq[i].netLiq;
                    const past8 = weeklyNetLiq[i - 8].netLiq;
                    const deltaPct = past8 !== 0 ? ((cur - past8) / Math.abs(past8)) * 100 : 0;
                    netLiqDeltaMap[weeklyNetLiq[i].date] = deltaPct;
                }
            }
        }
    } catch (e) {
        console.warn("Macro Timeline nicht geladen:", e.message);
    }

    // Trading Days based on SPY
    const tradingDays = (prices['SPY'] || [])
        .map(q => q.date)
        .filter(d => d >= startDate && d <= endDate);

    // Indicators calculation
    const indicators = {};
    const qqqPrices = prices['QQQ'] || [];
    const qqqCloseMap = new Map(qqqPrices.map(q => [q.date, q.close]));

    for (const sym of techSymbols) {
        const quotes = prices[sym] || [];
        const closes = quotes.map(q => q.close);
        const volumes = quotes.map(q => q.volume);

        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200);
        const ema20 = calculateEMA(closes, 20);
        const sma50Vol = calculateSMA(volumes, 50);

        const rsValues = quotes.map(q => {
            const qClose = qqqCloseMap.get(q.date);
            return qClose ? (q.close / qClose) : null;
        });
        const rsSMA50 = calculateSMA(rsValues.map(v => v || 0), 50);

        const secSym = sectorMap[sym] || 'QQQ';
        const secQuotes = prices[secSym] || [];
        const secCloseMap = new Map(secQuotes.map(q => [q.date, q.close]));
        const rsSectorValues = quotes.map(q => {
            const sClose = secCloseMap.get(q.date);
            return sClose ? (q.close / sClose) : null;
        });
        const rsSectorSMA50 = calculateSMA(rsSectorValues.map(v => v || 0), 50);

        const indMap = {};
        for (let i = 0; i < quotes.length; i++) {
            const d = quotes[i].date;
            let high50d = 0;
            if (i >= 50) high50d = Math.max(...closes.slice(i - 50, i));

            let sec5dReturn = 0;
            const curSecPrice = secCloseMap.get(d);
            if (i >= 5) {
                const pastSecPrice = secCloseMap.get(quotes[i - 5].date);
                if (curSecPrice && pastSecPrice) {
                    sec5dReturn = (curSecPrice - pastSecPrice) / pastSecPrice;
                }
            }

            indMap[d] = {
                close: quotes[i].close,
                volume: quotes[i].volume,
                sma50: sma50[i],
                sma200: sma200[i],
                ema20: ema20[i],
                sma50Vol: sma50Vol[i],
                high50d,
                rs: rsValues[i],
                rsSMA50: rsSMA50[i],
                rsSector: rsSectorValues[i],
                rsSectorSMA50: rsSectorSMA50[i],
                sec5dReturn
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

    // Portfolio State (90k $ Start: 50 % Tech / 50 % Krypto)
    let usdCash = 0;
    let spyShares = 0;
    let gldShares = 0;

    let kryptoClaimUSD = initialCapitalUSD * 0.50; // 45.000 $ Krypto-Budget
    let kryptoUndeployedUSD = 0;
    let btcSiloActive = false;
    let kryptoPyramidStage = 0;
    let kryptoPyramidDays = 0;

    // Krypto-Equities Portfolio
    const kryptoPositions = {};
    for (const k of kryptoSymbols) kryptoPositions[k] = 0;

    // Tech Portfolio
    const techPositions = {};
    const lastProcessedFiling = {};
    const consecutiveBelowSMA200 = {};
    const skimCooldown = {};
    for (const sym of techSymbols) {
        consecutiveBelowSMA200[sym] = 0;
        skimCooldown[sym] = 0;
    }

    // Kaltstart: Die 45.000 $ Tech-Kapital + 45.000 $ Krypto-Leihgabe starten zu 100 % im S&P 500 Mutterschiff
    const startSpyP = priceMaps['SPY'][tradingDays[0]] || 1;
    spyShares = (initialCapitalUSD) / startSpyP; // $90.000 komplett im SPY geparkt

    let macroGuardActive = false;
    let peakPortfolioUSD = initialCapitalUSD;
    let maxDrawdownPct = 0;
    const tradeLog = [];

    function getTotalDepotUSD(d) {
        let val = usdCash;
        val += spyShares * (priceMaps['SPY'][d] || 0);
        val += gldShares * (priceMaps['GLD'][d] || 0);

        for (const k of kryptoSymbols) {
            val += kryptoPositions[k] * (priceMaps[k][d] || 0);
        }
        for (const s of Object.keys(techPositions)) {
            val += techPositions[s].shares * (priceMaps[s][d] || 0);
        }
        return val;
    }

    function getAvailableMutterschiffForTech(d) {
        const curSpyP = priceMaps['SPY'][d] || 1;
        const totalMutterschiffUSD = spyShares * curSpyP;
        const totalClaim = kryptoClaimUSD + kryptoUndeployedUSD;
        return Math.max(0, totalMutterschiffUSD - totalClaim);
    }

    function reallocateTechProceeds(proceedsUSD, date, excludedSym, reason) {
        if (proceedsUSD <= 0) return;
        const totalDepotUSD = getTotalDepotUSD(date);

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
                if (p) techPositions[cand].shares += shareUSD / p;
            }
            tradeLog.push({
                date,
                action: 'PROCEEDS_REALLOCATED',
                symbol: excludedSym,
                detail: `$${proceedsUSD.toFixed(0)} (${reason}) in aktive HOLD & BUY Gewinner (${candidates.join(', ')}) reinvestiert.`
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

    // SIMULATION LOOP
    for (let dIdx = 0; dIdx < tradingDays.length; dIdx++) {
        const date = tradingDays[dIdx];

        // 1. Makro-Ampel Auswertung
        let latestDelta = null;
        for (let back = 0; back < 14; back++) {
            const checkD = new Date(new Date(date).getTime() - back * 86400000).toISOString().split('T')[0];
            if (netLiqDeltaMap[checkD] !== undefined) {
                latestDelta = netLiqDeltaMap[checkD];
                break;
            }
        }

        const isMacroRed = latestDelta !== null && latestDelta < -5.0;
        let isMacroGreen = latestDelta !== null && latestDelta >= 0.0;

        // Panic Sniper
        if (macroGuardActive && panicCapitulationMap[date]) {
            isMacroGreen = true;
        }

        // =====================================================================
        // MAKRO-SCHUTZ: 100 % NOTFALL-EVAKUIERUNG (50 % GOLD / 50 % CASH)
        // =====================================================================
        if (!macroGuardActive && isMacroRed) {
            macroGuardActive = true;
            const gldPrice = priceMaps['GLD'][date] || 1;
            const curSpyP = priceMaps['SPY'][date] || 1;

            let totalEvacUSD = 0;
            // Evakuiere SPY Mutterschiff
            const spyVal = spyShares * curSpyP;
            totalEvacUSD += spyVal;
            spyShares = 0;

            // Evakuiere Tech-Bucket
            for (const sym of Object.keys(techPositions)) {
                const p = priceMaps[sym][date] || 0;
                const v = techPositions[sym].shares * p;
                totalEvacUSD += v;
                delete techPositions[sym];
            }

            // Evakuiere Krypto-Equities
            if (btcSiloActive) {
                for (const k of kryptoSymbols) {
                    const p = priceMaps[k][date] || 0;
                    const v = kryptoPositions[k] * p;
                    totalEvacUSD += v;
                    kryptoPositions[k] = 0;
                }
                btcSiloActive = false;
                kryptoPyramidStage = 0;
                kryptoClaimUSD = 0;
                kryptoUndeployedUSD = 0;
            }

            const goldAlloc = totalEvacUSD * 0.50;
            const cashAlloc = totalEvacUSD * 0.50;
            gldShares += goldAlloc / gldPrice;
            usdCash += cashAlloc;

            tradeLog.push({
                date,
                action: 'MAKRO_GUARD_ON_100PCT',
                detail: `Makro ROT [NetLiq Delta: ${latestDelta ? latestDelta.toFixed(2) : '-6'}%]. 100% Notfall-Evakuierung ($${totalEvacUSD.toFixed(0)}) in 50% Gold & 50% Cash!`
            });
        } else if (macroGuardActive && isMacroGreen) {
            macroGuardActive = false;
            const gldPrice = priceMaps['GLD'][date] || 1;
            const curSpyP = priceMaps['SPY'][date] || 1;

            const goldVal = gldShares * gldPrice;
            const cashVal = usdCash;
            const totalReturnUSD = goldVal + cashVal;

            gldShares = 0;
            usdCash = 0;
            spyShares += totalReturnUSD / curSpyP;

            // Krypto-Claim wieder auf 50% des Portfolios setzen
            kryptoClaimUSD = totalReturnUSD * 0.50;

            tradeLog.push({
                date,
                action: 'MAKRO_GUARD_OFF',
                detail: `Makro GRÜN / Panic Sniper. Schutzschirm aufgelöst ($${totalReturnUSD.toFixed(0)}) & vollständig zurück ins SPY Mutterschiff investiert.`
            });
        }

        const totalDepotUSD = getTotalDepotUSD(date);

        // =====================================================================
        // KRYPTO-REGIME: BTC 21-WOCHEN-EMA MASTER-SCHALTER
        // =====================================================================
        const btcData = btcMap[date];
        if (btcData && btcData.ema21w) {
            const btcPrice = btcData.close;
            const btcEma = btcData.ema21w;

            if (btcPrice < btcEma && btcSiloActive) {
                // KRYPTO BÄRENMARKT EXIT
                let exitProceedsUSD = 0;
                for (const k of kryptoSymbols) {
                    const p = priceMaps[k][date] || 0;
                    exitProceedsUSD += kryptoPositions[k] * p;
                    kryptoPositions[k] = 0;
                }
                btcSiloActive = false;
                kryptoPyramidStage = 0;
                kryptoPyramidDays = 0;

                const curSpyP = priceMaps['SPY'][date] || 1;
                spyShares += exitProceedsUSD / curSpyP;
                kryptoClaimUSD = exitProceedsUSD;
                kryptoUndeployedUSD = 0;

                tradeLog.push({
                    date,
                    action: 'KRYPTO_SUB_BUCKET_EXIT',
                    detail: `BTC ($${btcPrice.toFixed(0)}) < 21W-EMA ($${btcEma.toFixed(0)}). 100% Krypto-Equities liquidiert ($${exitProceedsUSD.toFixed(0)}). Krypto-Claim im SPY: $${kryptoClaimUSD.toFixed(0)}.`
                });
            } else if (btcPrice >= btcEma && !btcSiloActive && !macroGuardActive && !isMacroRed) {
                // KRYPTO BULLENMARKT RE-ENTRY
                const totalKryptoUSD = kryptoClaimUSD + kryptoUndeployedUSD;
                if (totalKryptoUSD > 1000) {
                    btcSiloActive = true;
                    kryptoPyramidStage = 1;
                    kryptoPyramidDays = 0;

                    const curSpyP = priceMaps['SPY'][date] || 1;
                    const tranche1USD = totalKryptoUSD * 0.40;
                    spyShares -= tranche1USD / curSpyP;
                    kryptoClaimUSD = 0;
                    kryptoUndeployedUSD = totalKryptoUSD - tranche1USD;

                    // Aufteilen auf aktive Krypto-Equities mit Kursen
                    const activeKrypto = kryptoSymbols.filter(k => (priceMaps[k][date] || 0) > 0);
                    if (activeKrypto.length > 0) {
                        const perSym = tranche1USD / activeKrypto.length;
                        for (const k of activeKrypto) {
                            const p = priceMaps[k][date];
                            kryptoPositions[k] += perSym / p;
                        }
                    }

                    tradeLog.push({
                        date,
                        action: 'KRYPTO_REENTRY_TRANCHE_1',
                        detail: `BTC ($${btcPrice.toFixed(0)}) > 21W-EMA. Tranche 1 (40% = $${tranche1USD.toFixed(0)}) gleichmäßig in [${activeKrypto.join(', ')}] investiert.`
                    });
                }
            } else if (btcSiloActive && kryptoPyramidStage === 1 && !macroGuardActive) {
                kryptoPyramidDays++;
                if (kryptoPyramidDays >= 15) {
                    kryptoPyramidStage = 2;
                    const curSpyP = priceMaps['SPY'][date] || 1;
                    const totalPool = (kryptoUndeployedUSD / 0.60);
                    const tranche2USD = Math.min(totalPool * 0.30, kryptoUndeployedUSD);
                    spyShares -= tranche2USD / curSpyP;
                    kryptoUndeployedUSD -= tranche2USD;

                    const activeKrypto = kryptoSymbols.filter(k => (priceMaps[k][date] || 0) > 0);
                    if (activeKrypto.length > 0) {
                        const perSym = tranche2USD / activeKrypto.length;
                        for (const k of activeKrypto) {
                            const p = priceMaps[k][date];
                            kryptoPositions[k] += perSym / p;
                        }
                    }

                    tradeLog.push({
                        date,
                        action: 'KRYPTO_PYRAMIDE_TRANCHE_2',
                        detail: `15 Tage Trendbestätigung. Tranche 2 (30% = $${tranche2USD.toFixed(0)}) gleichmäßig in [${activeKrypto.join(', ')}] allokiert.`
                    });
                }
            } else if (btcSiloActive && kryptoPyramidStage === 2 && !macroGuardActive) {
                kryptoPyramidDays++;
                if (kryptoPyramidDays >= 30) {
                    kryptoPyramidStage = 3;
                    const curSpyP = priceMaps['SPY'][date] || 1;
                    const tranche3USD = kryptoUndeployedUSD;
                    spyShares -= tranche3USD / curSpyP;
                    kryptoUndeployedUSD = 0;

                    const activeKrypto = kryptoSymbols.filter(k => (priceMaps[k][date] || 0) > 0);
                    if (activeKrypto.length > 0) {
                        const perSym = tranche3USD / activeKrypto.length;
                        for (const k of activeKrypto) {
                            const p = priceMaps[k][date];
                            kryptoPositions[k] += perSym / p;
                        }
                    }

                    tradeLog.push({
                        date,
                        action: 'KRYPTO_PYRAMIDE_TRANCHE_3',
                        detail: `30 Tage Trendbestätigung. Tranche 3 (30% = $${tranche3USD.toFixed(0)}) vollendet Krypto-Equities-Allokation.`
                    });
                }
            }
        }

        // =====================================================================
        // TECH SUB-BUCKET CHECK: 10-Q FUNDAMENTALS & 3-STUFEN-EXIT
        // =====================================================================
        for (const sym of Object.keys(techPositions)) {
            const pos = techPositions[sym];
            const ind = indicators[sym] ? indicators[sym][date] : null;
            if (!ind) continue;
            const curPrice = ind.close;

            // A. Fundamental Check
            const fund = getLatestFundamentals(sym, date);
            if (fund && fund.latest && fund.latest.filing_date !== lastProcessedFiling[sym]) {
                lastProcessedFiling[sym] = fund.latest.filing_date;

                const latestYoY = fund.latest.yoy_revenue_growth_pct;
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
                        pos.flag = 'HOLD_AND_OBSERVE';
                        pos.stage = 1;
                        const soldShares = pos.shares * (1 / 3);
                        pos.shares -= soldShares;
                        const proceedsUSD = soldShares * curPrice;
                        tradeLog.push({
                            date,
                            action: 'STUFE_1_EARNINGS_DECEL_EXIT',
                            symbol: sym,
                            detail: `1/3 Teil-Exit @ $${curPrice.toFixed(2)} [YoY: ${latestYoY?.toFixed(1)}%]. Status: HOLD & OBSERVE.`
                        });
                        reallocateTechProceeds(proceedsUSD, date, sym, 'Stufe 1 Teil-Exit');
                    } else if (pos.consecutiveWeakFilings >= 2) {
                        const soldShares = pos.shares;
                        const proceedsUSD = soldShares * curPrice;
                        delete techPositions[sym];
                        consecutiveBelowSMA200[sym] = 0;
                        tradeLog.push({
                            date,
                            action: 'STUFE_3_ZOMBIE_LIQUIDATION',
                            symbol: sym,
                            detail: `100% Rest-Exit @ $${curPrice.toFixed(2)} [2. schwaches Quartal: ${latestYoY?.toFixed(1)}%].`
                        });
                        const curSpyP = priceMaps['SPY'][date] || 1;
                        spyShares += proceedsUSD / curSpyP;
                        continue;
                    }
                }
            }

            // B. Trend Check & Dip-Buying
            if (ind.sma200 && curPrice < ind.sma200) {
                consecutiveBelowSMA200[sym]++;
            } else {
                consecutiveBelowSMA200[sym] = 0;
            }

            if (pos.flag === 'HOLD_AND_BUY') {
                const daysSinceDipBuy = pos.lastDipBuyIdx !== undefined ? (dIdx - pos.lastDipBuyIdx) : 999;
                const sec5dReturn = ind.sec5dReturn || 0;
                const isSectorDip = sec5dReturn <= -0.035 && curPrice < ind.ema20;
                const isStockPullback = ind.high50d && (curPrice - ind.high50d) / ind.high50d <= -0.10 && curPrice < ind.ema20;
                const isDip = isSectorDip || isStockPullback;

                const curSpyP = priceMaps['SPY'][date] || 1;
                const freeMutterschiffUSD = getAvailableMutterschiffForTech(date);

                const curFund = getLatestFundamentals(sym, date);
                const hasValidFundForDipBuy = curFund && curFund.latest &&
                    (curFund.latest.yoy_revenue_growth_pct === null || curFund.latest.yoy_revenue_growth_pct >= 15.0 || curFund.latest.net_income > 0) &&
                    !(curFund.latest.net_income < 0 && Math.abs(curFund.latest.net_income) > 2.0 * curFund.latest.revenue);

                if (!macroGuardActive && isDip && daysSinceDipBuy >= 20 && freeMutterschiffUSD >= 2000 && hasValidFundForDipBuy) {
                    const dipAllocUSD = Math.min(freeMutterschiffUSD * 0.15, 6000);
                    spyShares -= dipAllocUSD / curSpyP;
                    const addShares = dipAllocUSD / curPrice;
                    pos.shares += addShares;
                    pos.lastDipBuyIdx = dIdx;

                    tradeLog.push({
                        date,
                        action: 'CONTRARIAN_DIP_BUY',
                        symbol: sym,
                        detail: `Branchen-Dip (${(sec5dReturn * 100).toFixed(1)}% Sektor @ $${curPrice.toFixed(2)}): $${dipAllocUSD.toFixed(0)} nachgekauft.`
                    });
                }
            } else if (pos.flag === 'HOLD_AND_OBSERVE') {
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
                        detail: `Weiteres 1/3 verkauft @ $${curPrice.toFixed(2)} (3 Tage < SMA 200 & Sektor-Schwäche).`
                    });
                    reallocateTechProceeds(proceedsUSD, date, sym, 'Stufe 2 Trend-Exit');
                }
            }
        }

        // =====================================================================
        // TECH SUB-BUCKET: EINSTIEGS-TÜRSTEHER (Stage-2 Breakout)
        // =====================================================================
        if (!macroGuardActive && !isMacroRed) {
            for (const sym of techSymbols) {
                if (techPositions[sym]) continue;

                const ind = indicators[sym] ? indicators[sym][date] : null;
                if (!ind || !ind.high50d || !ind.sma50 || !ind.sma200 || !ind.sma50Vol) continue;

                const isVolumeSpike = ind.volume >= 1.5 * ind.sma50Vol;
                const isStage2Breakout = ind.close > ind.high50d && ind.close > ind.sma200 && ind.close > ind.sma50 && ind.rs > ind.rsSMA50 && isVolumeSpike;

                if (!isStage2Breakout) continue;

                // Eiserne Regel: Kein Kauf ohne Fundamentaldaten!
                let isFundamentalPermitted = false;
                const fund = getLatestFundamentals(sym, date);
                if (fund && fund.latest) {
                    const yoy = fund.latest.yoy_revenue_growth_pct;
                    const isProfitableTurnaround = fund.latest.net_income > 0 && (!fund.prior || fund.prior.net_income <= 0);
                    const isCatastrophic = (fund.latest.net_income < 0 && Math.abs(fund.latest.net_income) > 2.0 * fund.latest.revenue);
                    const isHealthyGrowth = (yoy !== null && yoy >= 15.0);
                    if ((isHealthyGrowth || isProfitableTurnaround) && !isCatastrophic) {
                        isFundamentalPermitted = true;
                    }
                }

                if (isFundamentalPermitted) {
                    const curSpyP = priceMaps['SPY'][date] || 1;
                    const freeMutterschiffUSD = getAvailableMutterschiffForTech(date);
                    const allocUSD = freeMutterschiffUSD * 0.35; // 35 % des freien Mutterschiffs

                    if (allocUSD >= 1000) {
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

        // Drawdown Tracking
        const curDayDepotUSD = getTotalDepotUSD(date);
        if (curDayDepotUSD > peakPortfolioUSD) peakPortfolioUSD = curDayDepotUSD;
        const curDayDD = ((peakPortfolioUSD - curDayDepotUSD) / peakPortfolioUSD) * 100;
        if (curDayDD > maxDrawdownPct) maxDrawdownPct = curDayDD;
    }

    // Finale Bilanz
    const lastDate = tradingDays[tradingDays.length - 1];
    const finalDepotUSD = getTotalDepotUSD(lastDate);
    const netProfitUSD = finalDepotUSD - initialCapitalUSD;
    const returnPct = ((netProfitUSD / initialCapitalUSD) * 100).toFixed(2);

    // Benchmarks
    const spyStartP = priceMaps['SPY'][tradingDays[0]];
    const spyEndP = priceMaps['SPY'][lastDate];
    const spyReturn = (((spyEndP - spyStartP) / spyStartP) * 100).toFixed(2);

    const qqqStartP = priceMaps['QQQ'][tradingDays[0]];
    const qqqEndP = priceMaps['QQQ'][lastDate];
    const qqqReturn = (((qqqEndP - qqqStartP) / qqqStartP) * 100).toFixed(2);

    const btcStartP = btcMap[tradingDays[0]]?.close || 1;
    const btcEndP = btcMap[lastDate]?.close || 1;
    const btcReturn = (((btcEndP - btcStartP) / btcStartP) * 100).toFixed(2);

    console.log("================================================================================");
    console.log(`   FINALE KAMIKAZE GROWTH BILANZ | STAND: ${lastDate}`);
    console.log("================================================================================\n");
    console.log(`Startkapital:            $ ${initialCapitalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} (90k Cash Dollar)`);
    console.log(`Endwert Portfolio:       $ ${finalDepotUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`Nettogewinn:             $ ${netProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${returnPct} %)`);
    console.log(`Maximaler Drawdown:      -${maxDrawdownPct.toFixed(2)} %`);
    console.log("--------------------------------------------------------------------------------");
    console.log("ALLOKATION ZUM STICHTAG (SILO-ÜBERSICHT):");
    const finalSpyVal = spyShares * (priceMaps['SPY'][lastDate] || 0);
    console.log(`* S&P 500 Mutterschiff:      $ ${finalSpyVal.toFixed(2)} (${((finalSpyVal / finalDepotUSD) * 100).toFixed(1)} %)`);
    if (kryptoClaimUSD > 0) {
        console.log(`* Krypto-Claim im Mutterschiff: $ ${kryptoClaimUSD.toFixed(0)} [Geparkt als Leihgabe für Tech-Compounding]`);
    }
    for (const k of kryptoSymbols) {
        const p = priceMaps[k][lastDate] || 0;
        const v = kryptoPositions[k] * p;
        if (v > 0) {
            console.log(`* Krypto-Equity (${k.padEnd(5)}):      ${kryptoPositions[k].toFixed(2).padStart(8)} Stk. à $${p.toFixed(2)} | $ ${v.toFixed(2)} (${((v / finalDepotUSD) * 100).toFixed(1)} %)`);
        }
    }
    for (const s of Object.keys(techPositions)) {
        const p = priceMaps[s][lastDate] || 0;
        const v = techPositions[s].shares * p;
        console.log(`* Tech-Position (${s.padEnd(5)}):      ${techPositions[s].shares.toFixed(2).padStart(8)} Stk. à $${p.toFixed(2)} | $ ${v.toFixed(2)} (${((v / finalDepotUSD) * 100).toFixed(1)} %) [${techPositions[s].flag}]`);
    }
    console.log("--------------------------------------------------------------------------------");
    console.log("BENCHMARK-VERGLEICH:");
    console.log(`* S&P 500 Buy & Hold (SPY):         +${spyReturn} %`);
    console.log(`* Nasdaq 100 Buy & Hold (QQQ):      +${qqqReturn} %`);
    console.log(`* Bitcoin Buy & Hold (BTC):         +${btcReturn} %`);
    console.log(`* KAMIKAZE GROWTH STRATEGIE:        +${returnPct} %`);
    console.log("--------------------------------------------------------------------------------");
    console.log(`ALPHA vs. SPY (S&P 500):            +${(parseFloat(returnPct) - parseFloat(spyReturn)).toFixed(2)} %-Punkte Outperformance!`);
    console.log(`ALPHA vs. QQQ (Nasdaq 100):         +${(parseFloat(returnPct) - parseFloat(qqqReturn)).toFixed(2)} %-Punkte Outperformance!\n`);

    console.log("WICHTIGSTE TRANSAKTIONEN:");
    for (const t of tradeLog.slice(-40)) {
        console.log(`  [${t.date}] ${(t.symbol || '').padEnd(6)} | ${t.action.padEnd(28)} | ${t.detail}`);
    }

    return {
        initialCapitalUSD,
        finalDepotUSD,
        netProfitUSD,
        returnPct: parseFloat(returnPct),
        maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
        tradeLog
    };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('KamikazeGrowthSimulation.js')) {
    runKamikazeSimulation().catch(console.error);
}
