import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Technical analysis indicators
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

function calculateRSI(closes, period = 14) {
    const rsi = [];
    let gains = 0;
    let losses = 0;
    for (let i = 0; i < closes.length; i++) {
        if (i === 0) {
            rsi.push(50);
            continue;
        }
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        if (i <= period) {
            gains += gain;
            losses += loss;
            if (i === period) {
                const avgG = gains / period;
                const avgL = losses / period;
                const rs = avgL === 0 ? 100 : avgG / avgL;
                rsi.push(100 - (100 / (1 + rs)));
            } else {
                rsi.push(50);
            }
        } else {
            gains = (gains * (period - 1) + gain) / period;
            losses = (losses * (period - 1) + loss) / period;
            const rs = losses === 0 ? 100 : gains / losses;
            rsi.push(100 - (100 / (1 + rs)));
        }
    }
    return rsi;
}

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { PanicCapitulationIndicator } from '../../../src/analysis/indicators/PanicCapitulationIndicator.js';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function loadData(priceStartDate = '2014-10-01') {
    const cacheDir = path.resolve(__dirname, 'cache');
    const spyPath = path.join(cacheDir, 'SPY_2014-10-01_2026-09-06.json');
    const gldPath = path.join(cacheDir, 'GLD_2014-10-01_2026-09-06.json');
    const vixPath = path.join(cacheDir, 'VIX_2014-10-01_2026-09-06.json');
    const fxPath = path.join(cacheDir, 'EURUSD=X_2014-10-01_2026-09-06.json');

    const spyQuotes = JSON.parse(fs.readFileSync(spyPath, 'utf8'));
    const gldQuotes = JSON.parse(fs.readFileSync(gldPath, 'utf8'));
    const vixQuotes = JSON.parse(fs.readFileSync(vixPath, 'utf8'));
    const fxQuotes = JSON.parse(fs.readFileSync(fxPath, 'utf8'));

    // Macro Liquidity Data (TiDB / FinanceExpert)
    const netLiqDeltaMap = {};
    const panicCapitulationMap = {};

    let timeline = null;
    try {
        if (process.env.DATABASE_URL) {
            const fe = new FinanceExpert();
            timeline = await fe.getDailyGroupedData(priceStartDate, { bypassMemoryGuard: true });
            await fe.close();
        }
    } catch (e) {
        console.warn("FinanceExpert Timeline nicht verfügbar:", e.message);
    }

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

    return { spyQuotes, gldQuotes, vixQuotes, fxQuotes, netLiqDeltaMap, panicCapitulationMap };
}

export async function runGoldSpySimulation(options = {}) {
    const startDate = options.startDate || '2015-01-01';
    const initialDepositEUR = options.initialDepositEUR || 10000;
    const monthlyDepositEUR = options.monthlyDepositEUR || 150;

    const { spyQuotes, gldQuotes, vixQuotes, fxQuotes, netLiqDeltaMap, panicCapitulationMap } = await loadData('2014-10-01');

    // Map by date
    const gldMap = new Map(gldQuotes.map(q => [q.date, q.close]));
    const vixMap = new Map(vixQuotes.map(q => [q.date, q.close]));
    const fxMap = new Map(fxQuotes.map(q => [q.date, q.close]));

    const filteredSpy = spyQuotes.filter(q => q.date >= '2014-10-01');
    const spyCloses = filteredSpy.map(q => q.close);
    const spySMA50 = calculateSMA(spyCloses, 50);
    const spySMA200 = calculateSMA(spyCloses, 200);
    const spyEMA20 = calculateEMA(spyCloses, 20);
    const spyRSI = calculateRSI(spyCloses, 14);

    const tradingDays = [];
    const indicators = {};
    for (let i = 0; i < filteredSpy.length; i++) {
        const d = filteredSpy[i].date;
        if (d >= startDate) tradingDays.push(d);

        let sec5dReturn = 0;
        if (i >= 5) {
            sec5dReturn = (filteredSpy[i].close - filteredSpy[i - 5].close) / filteredSpy[i - 5].close;
        }

        indicators[d] = {
            close: filteredSpy[i].close,
            sma50: spySMA50[i],
            sma200: spySMA200[i],
            ema20: spyEMA20[i],
            rsi: spyRSI[i],
            sec5dReturn,
            vix: vixMap.get(d) || 20,
            gld: gldMap.get(d) || 120,
            eurUsd: fxMap.get(d) || 1.12
        };
    }

    // =========================================================================
    // 1. BENCHMARK: REINER S&P 500 BUY & HOLD DCA
    // =========================================================================
    let bSpyShares = 0;
    let bTotalInvestedEUR = initialDepositEUR;
    let bStartEurUsd = indicators[tradingDays[0]].eurUsd;
    bSpyShares += (initialDepositEUR * bStartEurUsd) / indicators[tradingDays[0]].close;

    let bPeakEUR = 0;
    let bMaxDrawdownPct = 0;
    let bLastMonth = tradingDays[0].substring(0, 7);

    for (const d of tradingDays) {
        const ind = indicators[d];
        const m = d.substring(0, 7);
        if (m !== bLastMonth) {
            bTotalInvestedEUR += monthlyDepositEUR;
            const addUSD = monthlyDepositEUR * ind.eurUsd;
            bSpyShares += addUSD / ind.close;
            bLastMonth = m;
        }

        const curValUSD = bSpyShares * ind.close;
        const curValEUR = curValUSD / ind.eurUsd;
        if (curValEUR > bPeakEUR) bPeakEUR = curValEUR;
        const dd = ((bPeakEUR - curValEUR) / bPeakEUR) * 100;
        if (dd > bMaxDrawdownPct) bMaxDrawdownPct = dd;
    }

    const lastD = tradingDays[tradingDays.length - 1];
    const bFinalInd = indicators[lastD];
    const bFinalUSD = bSpyShares * bFinalInd.close;
    const bFinalEUR = bFinalUSD / bFinalInd.eurUsd;
    const bNetProfitEUR = bFinalEUR - bTotalInvestedEUR;
    const bReturnPct = ((bNetProfitEUR / bTotalInvestedEUR) * 100).toFixed(2);

    // =========================================================================
    // 2. STRATEGIE: GOLD-SPY DYNAMIC DCA (MAKRO-SCHILD + 40/30/30 BOTTOM-SNIPER)
    // =========================================================================
    let sSpyShares = 0;
    let sGldShares = 0;
    let sCashUSD = 0;
    let sTotalInvestedEUR = initialDepositEUR;
    let sStartEurUsd = indicators[tradingDays[0]].eurUsd;
    sSpyShares += (initialDepositEUR * sStartEurUsd) / indicators[tradingDays[0]].close;

    let macroGuardActive = false;
    let reEntryPhase = 0; // 0 = keine, 1 = Tranche 1 aktiv, 2 = Tranche 2 aktiv, 3 = Tranche 3 aktiv
    let reEntryStartIdx = -999;
    let reEntryPoolUSD = 0; // Pool zum Re-Entry
    let lastSkimIdx = -999;
    let lastDipRebalanceIdx = -999;
    let peakPortfolioEUR = 0;
    let maxDrawdownPct = 0;
    let sLastMonth = tradingDays[0].substring(0, 7);
    let lastNetLiqDelta = 0;
    let recentVixHigh = 0;

    const tradeLog = [];

    function getTotalPortfolioUSD(d) {
        const ind = indicators[d];
        return (sSpyShares * ind.close) + (sGldShares * ind.gld) + sCashUSD;
    }

    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        const ind = indicators[d];
        const m = d.substring(0, 7);

        // Track VIX for Panic Capitulation
        if (ind.vix > recentVixHigh) recentVixHigh = ind.vix;
        if (i % 20 === 0) recentVixHigh = ind.vix; // decay tracking

        // Monatliche Sparrate (150 €)
        if (m !== sLastMonth) {
            sTotalInvestedEUR += monthlyDepositEUR;
            const addUSD = monthlyDepositEUR * ind.eurUsd;
            sLastMonth = m;

            if (macroGuardActive) {
                // Sparplan während Alarm: 50 % Gold / 50 % Cash
                sGldShares += (addUSD * 0.50) / ind.gld;
                sCashUSD += addUSD * 0.50;
            } else {
                // Normalzustand: 100 % SPY
                sSpyShares += addUSD / ind.close;
            }
        }

        // Makro-Liquiditäts-Update mit 14-Tage Lookback (Donnerstags-Stichtag)
        let latestDelta = null;
        for (let back = 0; back < 14; back++) {
            const checkD = new Date(new Date(d).getTime() - back * 86400000).toISOString().split('T')[0];
            if (netLiqDeltaMap[checkD] !== undefined) {
                latestDelta = netLiqDeltaMap[checkD];
                break;
            }
        }

        const isMacroRed = latestDelta !== null && latestDelta < -5.0;
        const isMacroGreen = latestDelta !== null && latestDelta >= 0.0;

        // ---------------------------------------------------------------------
        // A. NOTFALL-EVAKUIERUNG (MAKRO ROT)
        // ---------------------------------------------------------------------
        if (!macroGuardActive && isMacroRed) {
            macroGuardActive = true;
            reEntryPhase = 0;

            const soldSpyUSD = sSpyShares * ind.close;
            sSpyShares = 0;

            const evGoldUSD = soldSpyUSD * 0.50;
            const evCashUSD = soldSpyUSD * 0.50;

            sGldShares += evGoldUSD / ind.gld;
            sCashUSD += evCashUSD;

            tradeLog.push({
                date: d,
                action: 'MAKRO_NOTFALL_EVAKUIERUNG',
                detail: `Makro ROT (NetLiq Delta: ${lastNetLiqDelta.toFixed(2)}% < -5%). 100% SPY evakuiert in 50% Gold ($${evGoldUSD.toFixed(0)}) & 50% Cash ($${evCashUSD.toFixed(0)}).`
            });
        }

        // ---------------------------------------------------------------------
        // B. BOTTOM-DETEKTOR & 40/30/30 TRANCHEN-RE-ENTRY
        // ---------------------------------------------------------------------
        if (macroGuardActive) {
            // Trigger 1: Panic Capitulation Sniper (VIX war >= 35 und dreht ab ODER RSI < 30 ODER Indicator CRITICAL)
            const isPanicCapitulation = (panicCapitulationMap && panicCapitulationMap[d]) || (recentVixHigh >= 35 && ind.vix <= 30 && ind.close > ind.ema20) || (ind.rsi < 30 && ind.close > ind.ema20);
            const isMacroTurn = isMacroGreen;

            if (reEntryPhase === 0 && (isPanicCapitulation || isMacroTurn)) {
                // BOTTOM FESTGESTELLT! Start des 40/30/30 Tranchen-Manövers
                const triggerReason = isPanicCapitulation ? `Panic-Capitulation Sniper (VIX Reversal: ${ind.vix.toFixed(1)})` : `Makro-Wende (NetLiq Delta: +${lastNetLiqDelta.toFixed(2)}%)`;
                reEntryPhase = 1;
                reEntryStartIdx = i;

                // Berechne gesamten Re-Entry Pool aus Gold und Cash
                const currentGoldUSD = sGldShares * ind.gld;
                reEntryPoolUSD = currentGoldUSD + sCashUSD;

                // Tranche 1 (40 %): Sofort-Kauf am Boden
                const t1USD = reEntryPoolUSD * 0.40;
                const goldSoldUSD = Math.min(sGldShares * ind.gld, t1USD * 0.50);
                const cashUsedUSD = t1USD - goldSoldUSD;

                sGldShares -= goldSoldUSD / ind.gld;
                sCashUSD -= cashUsedUSD;
                sSpyShares += t1USD / ind.close;

                tradeLog.push({
                    date: d,
                    action: 'BOTTOM_REENTRY_TRANCHE_1',
                    detail: `Bottom erkannt via [${triggerReason}]. Tranche 1 (40% = $${t1USD.toFixed(0)}) in SPY @ $${ind.close.toFixed(2)} investiert.`
                });
            } else if (reEntryPhase === 1) {
                // Tranche 2 (30 %): Nach 15 Tagen Trendbestätigung (SPY > EMA 20)
                const daysInReEntry = i - reEntryStartIdx;
                if (daysInReEntry >= 15 && ind.close > ind.ema20) {
                    reEntryPhase = 2;
                    const t2USD = reEntryPoolUSD * 0.30;
                    const goldSoldUSD = Math.min(sGldShares * ind.gld, t2USD * 0.50);
                    const cashUsedUSD = t2USD - goldSoldUSD;

                    sGldShares -= goldSoldUSD / ind.gld;
                    sCashUSD -= cashUsedUSD;
                    sSpyShares += t2USD / ind.close;

                    tradeLog.push({
                        date: d,
                        action: 'BOTTOM_REENTRY_TRANCHE_2',
                        detail: `15 Tage Trendbestätigung (SPY > EMA20). Tranche 2 (30% = $${t2USD.toFixed(0)}) in SPY @ $${ind.close.toFixed(2)} investiert.`
                    });
                }
            } else if (reEntryPhase === 2) {
                // Tranche 3 (30 %): Nach 30 Tagen oder wenn SPY SMA 200 zurückerobert
                const daysInReEntry = i - reEntryStartIdx;
                if (daysInReEntry >= 30 || (ind.sma200 && ind.close > ind.sma200)) {
                    reEntryPhase = 3;
                    macroGuardActive = false; // Schutzschirm vollständig aufgelöst

                    // Reinvestiere verbleibendes evakuiertes Kapital
                    const t3USD = Math.max(0, sCashUSD + (sGldShares * ind.gld) * 0.60);
                    const goldSoldUSD = Math.min(sGldShares * ind.gld, t3USD * 0.50);
                    const cashUsedUSD = Math.min(sCashUSD, t3USD - goldSoldUSD);

                    sGldShares -= goldSoldUSD / ind.gld;
                    sCashUSD -= cashUsedUSD;
                    const totalT3 = goldSoldUSD + cashUsedUSD;
                    sSpyShares += totalT3 / ind.close;

                    tradeLog.push({
                        date: d,
                        action: 'BOTTOM_REENTRY_TRANCHE_3',
                        detail: `30 Tage Konsolidierung vollendet / SMA 200 intakt. Tranche 3 ($${totalT3.toFixed(0)}) vollendet Re-Entry. Normalzustand wiederhergestellt.`
                    });
                }
            }
        }

        // ---------------------------------------------------------------------
        // C. NORMALZUSTAND: PARABOLISCHES SKIMMING & KONTRÄRES REBALANCING
        // ---------------------------------------------------------------------
        if (!macroGuardActive) {
            const totalValUSD = getTotalPortfolioUSD(d);
            const spyValUSD = sSpyShares * ind.close;
            const gldValUSD = sGldShares * ind.gld;

            // 1. Parabolisches Skimming in Gold (Gewinnsicherung im Boom)
            // Bedingung: SPY > 15 % über SMA 200 und bricht unter 20T-EMA
            const isParabolic = ind.sma200 && (ind.close - ind.sma200) / ind.sma200 >= 0.15;
            const isPullback = ind.ema20 && ind.close < ind.ema20;
            const daysSinceSkim = i - lastSkimIdx;

            if (isParabolic && isPullback && daysSinceSkim >= 20 && spyValUSD > 5000) {
                const skimUSD = spyValUSD * 0.08; // 8 % aus SPY in Gold umschichten
                sSpyShares -= skimUSD / ind.close;
                sGldShares += skimUSD / ind.gld;
                lastSkimIdx = i;

                tradeLog.push({
                    date: d,
                    action: 'PARABOLIC_GOLD_SKIM',
                    detail: `Parabolische Streckung (${((ind.close - ind.sma200) / ind.sma200 * 100).toFixed(1)}% > SMA200) & EMA20-Bruch: 8% ($${skimUSD.toFixed(0)}) in Gold abgeschöpft.`
                });
            }

            // 2. Konträres Rebalancing aus Gold bei gesundem Bullenmarkt-Dip
            // Bedingung: Sektor/Markt-Dip (5d Return <= -3.5%), Makro GRÜN, Gold-Anteil vorhanden (> 10%)
            const isDip = ind.sec5dReturn <= -0.035 && ind.close < ind.ema20;
            const goldWeight = gldValUSD / totalValUSD;
            const daysSinceDip = i - lastDipRebalanceIdx;

            if (isDip && goldWeight >= 0.10 && daysSinceDip >= 20 && gldValUSD >= 2000) {
                const rebalanceUSD = gldValUSD * 0.20; // 20 % des Goldbestands konträr in SPY
                sGldShares -= rebalanceUSD / ind.gld;
                sSpyShares += rebalanceUSD / ind.close;
                lastDipRebalanceIdx = i;

                tradeLog.push({
                    date: d,
                    action: 'CONTRARIAN_DIP_REBALANCE',
                    detail: `Bullenmarkt-Dip (${(ind.sec5dReturn * 100).toFixed(1)}% in 5T @ $${ind.close.toFixed(2)}): $${rebalanceUSD.toFixed(0)} aus Gold-Speicher konträr in SPY nachgekauft.`
                });
            }
        }

        // Drawdown Tracking
        const curDayUSD = getTotalPortfolioUSD(d);
        const curDayEUR = curDayUSD / ind.eurUsd;
        if (curDayEUR > peakPortfolioEUR) peakPortfolioEUR = curDayEUR;
        const curDayDD = ((peakPortfolioEUR - curDayEUR) / peakPortfolioEUR) * 100;
        if (curDayDD > maxDrawdownPct) maxDrawdownPct = curDayDD;
    }

    // Finale Bilanz
    const finalInd = indicators[lastD];
    const sFinalSpyUSD = sSpyShares * finalInd.close;
    const sFinalGldUSD = sGldShares * finalInd.gld;
    const sFinalTotalUSD = sFinalSpyUSD + sFinalGldUSD + sCashUSD;
    const sFinalEUR = sFinalTotalUSD / finalInd.eurUsd;
    const sNetProfitEUR = sFinalEUR - sTotalInvestedEUR;
    const sReturnPct = ((sNetProfitEUR / sTotalInvestedEUR) * 100).toFixed(2);

    console.log("================================================================================");
    console.log(`   GOLD-SPY DYNAMIC DCA VS. REINER S&P 500 BUY & HOLD (${startDate} BIS ${lastD})`);
    console.log("================================================================================\n");

    console.log("1. BENCHMARK: REINER S&P 500 BUY & HOLD DCA");
    console.log(`* Gesamteinzahlung:        € ${bTotalInvestedEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
    console.log(`* Endwert Portfolio:       € ${bFinalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($ ${bFinalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
    console.log(`* Nettogewinn:             € ${bNetProfitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${bReturnPct} %)`);
    console.log(`* Maximaler Drawdown:      -${bMaxDrawdownPct.toFixed(2)} %\n`);

    console.log("--------------------------------------------------------------------------------");
    console.log("2. STRATEGIE: GOLD-SPY DYNAMIC DCA (MAKRO-SCHILD + 40/30/30 BOTTOM-SNIPER)");
    console.log(`* Gesamteinzahlung:        € ${sTotalInvestedEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
    console.log(`* Endwert Portfolio:       € ${sFinalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($ ${sFinalTotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
    console.log(`* Nettogewinn:             € ${sNetProfitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${sReturnPct} %)`);
    console.log(`* Maximaler Drawdown:      -${maxDrawdownPct.toFixed(2)} %`);
    console.log("--------------------------------------------------------------------------------");
    console.log("VERMÖGENS-AUFTEILUNG ZUM STICHTAG:");
    console.log(`* S&P 500 (SPY):           € ${(sFinalSpyUSD / finalInd.eurUsd).toFixed(2)} (${((sFinalSpyUSD / sFinalTotalUSD) * 100).toFixed(1)} %)`);
    console.log(`* Gold-Speicher (GLD):     € ${(sFinalGldUSD / finalInd.eurUsd).toFixed(2)} (${((sFinalGldUSD / sFinalTotalUSD) * 100).toFixed(1)} %)`);
    console.log(`* Taktisches Cash (USD):   € ${(sCashUSD / finalInd.eurUsd).toFixed(2)} (${((sCashUSD / sFinalTotalUSD) * 100).toFixed(1)} %)`);
    console.log("--------------------------------------------------------------------------------");
    console.log(`MEHRWERT / ALPHA:          +${(parseFloat(sReturnPct) - parseFloat(bReturnPct)).toFixed(2)} %-Punkte Outperformance!`);
    console.log(`ZUSÄTZLICHER VERMÖGENSGEWINN: +€ ${(sFinalEUR - bFinalEUR).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`RISIKO-REDUKTION (DRAWDOWN):  Von -${bMaxDrawdownPct.toFixed(2)} % auf -${maxDrawdownPct.toFixed(2)} % (Kompression um ${(bMaxDrawdownPct - maxDrawdownPct).toFixed(2)} %-Punkte!)`);
    console.log("================================================================================\n");

    console.log("WICHTIGSTE STRATEGIE-EREIGNISSE (EVAKUIERUNG & 40/30/30 RE-ENTRY):");
    for (const t of tradeLog) {
        console.log(`  [${t.date}] ${t.action.padEnd(28)} | ${t.detail}`);
    }

    return {
        benchmark: { totalInvestedEUR: bTotalInvestedEUR, finalEUR: bFinalEUR, returnPct: parseFloat(bReturnPct), maxDrawdownPct: bMaxDrawdownPct },
        strategy: { totalInvestedEUR: sTotalInvestedEUR, finalEUR: sFinalEUR, returnPct: parseFloat(sReturnPct), maxDrawdownPct },
        tradeLog
    };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('GoldSpyDcaSimulation.js')) {
    runGoldSpySimulation().catch(console.error);
}
