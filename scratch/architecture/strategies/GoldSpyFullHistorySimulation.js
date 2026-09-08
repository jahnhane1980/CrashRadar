import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
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

function calculateRSI(closes, period = 14) {
    const rsi = [];
    let gains = 0, losses = 0;
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

async function loadFullHistoryData() {
    const cacheDir = path.resolve(__dirname, '../../trash/cache');
    const spyPath = path.join(cacheDir, 'SPY_2004-11-18_2026-09-08.json');
    const gldPath = path.join(cacheDir, 'GLD_2004-11-18_2026-09-08.json');
    const vixPath = path.join(cacheDir, '_VIX_2004-11-18_2026-09-08.json');
    const fxPath = path.join(cacheDir, 'EURUSD_X_2004-11-18_2026-09-08.json');

    const spyQuotes = JSON.parse(fs.readFileSync(spyPath, 'utf8'));
    const gldQuotes = JSON.parse(fs.readFileSync(gldPath, 'utf8'));
    const vixQuotes = JSON.parse(fs.readFileSync(vixPath, 'utf8'));
    const fxQuotes = JSON.parse(fs.readFileSync(fxPath, 'utf8'));

    // Load macro data from FinanceExpert
    console.log('Lade historische Makro-Timeline ab 2004 via FinanceExpert...');
    const fe = new FinanceExpert();
    const timeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
    await fe.close();
    console.log(`Makro-Timeline geladen: ${timeline.length} Tage.`);

    // Panic Capitulation Indicators
    const panicCapitulationMap = {};
    const panicInd = new PanicCapitulationIndicator();
    for (let i = 90; i < timeline.length; i++) {
        const panicRes = panicInd.evaluate(timeline.slice(0, i + 1));
        if (panicRes && panicRes.status === 'CRITICAL') {
            panicCapitulationMap[timeline[i].date] = true;
        }
    }

    // Weekly Net Liquidity calculation
    const weeklyNetLiq = [];
    const netLiqDeltaMap = {};
    const stressMap = {};

    for (let i = 0; i < timeline.length; i++) {
        const day = timeline[i];
        const nl = day.macroGroups?.NetLiquidity;
        if (nl && nl.WALCL !== undefined) {
            const dObj = new Date(day.date);
            const val = nl.WALCL - (nl.TGA || 0) - (nl.RRPONTSYD || 0);
            if (dObj.getDay() === 4 || weeklyNetLiq.length === 0) {
                weeklyNetLiq.push({ date: day.date, netLiq: val });
            }
        }

        // Stress: ChicagoFedIndex > 0 oder Spread10y2y < 0
        const fc = day.macroGroups?.FinancialConditions;
        const cfi = fc?.ChicagoFedIndex !== undefined ? fc.ChicagoFedIndex : -0.5;
        stressMap[day.date] = cfi;
    }

    for (let i = 8; i < weeklyNetLiq.length; i++) {
        const cur = weeklyNetLiq[i].netLiq;
        const past8 = weeklyNetLiq[i - 8].netLiq;
        const deltaPct = past8 !== 0 ? ((cur - past8) / Math.abs(past8)) * 100 : 0;
        netLiqDeltaMap[weeklyNetLiq[i].date] = deltaPct;
    }

    return { spyQuotes, gldQuotes, vixQuotes, fxQuotes, netLiqDeltaMap, panicCapitulationMap, stressMap };
}

async function runFullHistorySimulation() {
    console.log('='.repeat(80));
    console.log('   CRASHRADAR: 21.8 JAHRE HISTORISCHER GOLD-SPY SIMULATIONSLTEST (2004 - 2026)');
    console.log('   Frage: Was hat Gold uns über die gesamte Zeit tatsächlich gebracht?');
    console.log('='.repeat(80));

    const { spyQuotes, gldQuotes, vixQuotes, fxQuotes, netLiqDeltaMap, panicCapitulationMap, stressMap } = await loadFullHistoryData();

    const gldMap = new Map(gldQuotes.map(q => [q.date, q.close]));
    const vixMap = new Map(vixQuotes.map(q => [q.date, q.close]));
    const fxMap = new Map(fxQuotes.map(q => [q.date, q.close]));

    const spyCloses = spyQuotes.map(q => q.close);
    const spySMA50 = calculateSMA(spyCloses, 50);
    const spySMA200 = calculateSMA(spyCloses, 200);
    const spyEMA20 = calculateEMA(spyCloses, 20);
    const spyRSI = calculateRSI(spyCloses, 14);

    const tradingDays = [];
    const indicators = {};

    for (let i = 0; i < spyQuotes.length; i++) {
        const d = spyQuotes[i].date;
        if (!gldMap.has(d)) continue;

        tradingDays.push(d);

        let sec5dReturn = 0;
        if (i >= 5) {
            sec5dReturn = (spyQuotes[i].close - spyQuotes[i - 5].close) / spyQuotes[i - 5].close;
        }

        indicators[d] = {
            close: spyQuotes[i].close,
            sma50: spySMA50[i],
            sma200: spySMA200[i],
            ema20: spyEMA20[i],
            rsi: spyRSI[i],
            sec5dReturn,
            vix: vixMap.get(d) || 20,
            gld: gldMap.get(d) || 45,
            eurUsd: fxMap.get(d) || 1.25,
            stress: stressMap[d] !== undefined ? stressMap[d] : -0.5
        };
    }

    console.log(`Gemeinsame Handelstage: ${tradingDays.length} Tage (Start: ${tradingDays[0]} bis Ende: ${tradingDays[tradingDays.length - 1]})\n`);

    const START_CAPITAL_EUR = 10000;
    const MONTHLY_RATE_EUR = 150;

    // -------------------------------------------------------------------------
    // Modell 1: Reiner S&P 500 Buy & Hold DCA (100% SPY)
    // -------------------------------------------------------------------------
    let bSpyShares = 0;
    let bInvestedEUR = START_CAPITAL_EUR;
    let bPeakEUR = 0, bMaxDD = 0;
    let bLastMonth = tradingDays[0].substring(0, 7);

    // Initial
    bSpyShares += (START_CAPITAL_EUR * indicators[tradingDays[0]].eurUsd) / indicators[tradingDays[0]].close;

    // -------------------------------------------------------------------------
    // Modell 2: Reiner Gold Buy & Hold DCA (100% GLD)
    // -------------------------------------------------------------------------
    let gGldShares = 0;
    let gInvestedEUR = START_CAPITAL_EUR;
    let gPeakEUR = 0, gMaxDD = 0;
    let gLastMonth = tradingDays[0].substring(0, 7);

    gGldShares += (START_CAPITAL_EUR * indicators[tradingDays[0]].eurUsd) / indicators[tradingDays[0]].gld;

    // -------------------------------------------------------------------------
    // Modell 3: 50% SPY / 50% GLD Permanent Portfolio (Monatlicher Sparplan 50/50)
    // -------------------------------------------------------------------------
    let pSpyShares = 0, pGldShares = 0;
    let pInvestedEUR = START_CAPITAL_EUR;
    let pPeakEUR = 0, pMaxDD = 0;
    let pLastMonth = tradingDays[0].substring(0, 7);

    pSpyShares += (START_CAPITAL_EUR * 0.5 * indicators[tradingDays[0]].eurUsd) / indicators[tradingDays[0]].close;
    pGldShares += (START_CAPITAL_EUR * 0.5 * indicators[tradingDays[0]].eurUsd) / indicators[tradingDays[0]].gld;

    // -------------------------------------------------------------------------
    // Modell 4: Gold-SPY Dynamic Shield (100% SPY DCA bei GRÜN, Notfall-Evakuierung 50/50 Gold/Cash bei ROT)
    // -------------------------------------------------------------------------
    let sSpyShares = 0, sGldShares = 0, sCashUSD = 0;
    let sInvestedEUR = START_CAPITAL_EUR;
    let sPeakEUR = 0, sMaxDD = 0;
    let sLastMonth = tradingDays[0].substring(0, 7);
    let sMacroRed = false;
    let sTriggerCount = 0;
    let sLastReEntryIdx = -999;

    sSpyShares += (START_CAPITAL_EUR * indicators[tradingDays[0]].eurUsd) / indicators[tradingDays[0]].close;

    // -------------------------------------------------------------------------
    // Modell 5: Gold-SPY mit 100% Gold-Notfall-Evakuierung (100% Gold im Crash)
    // -------------------------------------------------------------------------
    let fSpyShares = 0, fGldShares = 0;
    let fInvestedEUR = START_CAPITAL_EUR;
    let fPeakEUR = 0, fMaxDD = 0;
    let fMacroRed = false;
    let fLastReEntryIdx = -999;

    fSpyShares += (START_CAPITAL_EUR * indicators[tradingDays[0]].eurUsd) / indicators[tradingDays[0]].close;

    let lastNetLiqDelta = 0;
    const crisisEvents = [];

    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        const ind = indicators[d];
        const m = d.substring(0, 7);

        // Update Net Liquidity Delta
        if (netLiqDeltaMap[d] !== undefined) {
            lastNetLiqDelta = netLiqDeltaMap[d];
        }

        // Trigger Definition: NetLiq 8W-Delta < -5.0% AND (VIX > 25 oder ChicagoFedIndex > -0.2 oder Kurs unter SMA50)
        // Bei akutem Liquiditätsentzug + Marktstress
        const isPanicCapitulation = panicCapitulationMap[d] || (ind.vix >= 35 && ind.close > ind.ema20);
        const isCreditStress = (ind.stress > -0.25 || ind.vix > 28);
        const shouldTriggerRed = (lastNetLiqDelta < -5.0 && isCreditStress);
        const shouldReEnter = (lastNetLiqDelta >= 0.0 || isPanicCapitulation);

        // Monatliche Sparplanausführung
        if (m !== bLastMonth) {
            bInvestedEUR += MONTHLY_RATE_EUR;
            bSpyShares += (MONTHLY_RATE_EUR * ind.eurUsd) / ind.close;
            bLastMonth = m;

            gInvestedEUR += MONTHLY_RATE_EUR;
            gGldShares += (MONTHLY_RATE_EUR * ind.eurUsd) / ind.gld;
            gLastMonth = m;

            pInvestedEUR += MONTHLY_RATE_EUR;
            pSpyShares += (MONTHLY_RATE_EUR * 0.5 * ind.eurUsd) / ind.close;
            pGldShares += (MONTHLY_RATE_EUR * 0.5 * ind.eurUsd) / ind.gld;
            pLastMonth = m;

            sInvestedEUR += MONTHLY_RATE_EUR;
            if (sMacroRed) {
                // Bei Notfall: 50% Gold / 50% Cash
                sGldShares += (MONTHLY_RATE_EUR * 0.5 * ind.eurUsd) / ind.gld;
                sCashUSD += MONTHLY_RATE_EUR * 0.5 * ind.eurUsd;
            } else {
                // Bei Normalzustand: 100% SPY
                sSpyShares += (MONTHLY_RATE_EUR * ind.eurUsd) / ind.close;
            }

            fInvestedEUR += MONTHLY_RATE_EUR;
            if (fMacroRed) {
                fGldShares += (MONTHLY_RATE_EUR * ind.eurUsd) / ind.gld;
            } else {
                fSpyShares += (MONTHLY_RATE_EUR * ind.eurUsd) / ind.close;
            }
        }

        // NOTFALL-STECKER LOGIK FÜR MODELL 4 (50% Gold / 50% Cash)
        // Anti-Whipsaw: Nach einem Re-Entry mindestens 30 Handelstage Cooldown vor neuem Trigger
        const canTriggerS = (i - sLastReEntryIdx > 30);
        if (!sMacroRed && shouldTriggerRed && canTriggerS) {
            sMacroRed = true;
            sTriggerCount++;
            const totalUSD = (sSpyShares * ind.close) + (sGldShares * ind.gld) + sCashUSD;
            sSpyShares = 0;
            sGldShares = (totalUSD * 0.50) / ind.gld;
            sCashUSD = totalUSD * 0.50;
            crisisEvents.push({ date: d, event: 'NOTFALL-EVAKUIERUNG (50/50 Gold/Cash)', spyPrice: ind.close, gldPrice: ind.gld, vix: ind.vix, totalUSD });
        } else if (sMacroRed && shouldReEnter) {
            sMacroRed = false;
            sLastReEntryIdx = i;
            const totalUSD = (sGldShares * ind.gld) + sCashUSD;
            sGldShares = 0;
            sCashUSD = 0;
            sSpyShares = totalUSD / ind.close;
            crisisEvents.push({ date: d, event: 'RE-ENTRY IN SPY', spyPrice: ind.close, gldPrice: ind.gld, vix: ind.vix, totalUSD });
        }

        // NOTFALL-LOGIK FÜR MODELL 5 (100% Gold)
        const canTriggerF = (i - fLastReEntryIdx > 30);
        if (!fMacroRed && shouldTriggerRed && canTriggerF) {
            fMacroRed = true;
            const totalUSD = (fSpyShares * ind.close) + (fGldShares * ind.gld);
            fSpyShares = 0;
            fGldShares = totalUSD / ind.gld;
        } else if (fMacroRed && shouldReEnter) {
            fMacroRed = false;
            fLastReEntryIdx = i;
            const totalUSD = fGldShares * ind.gld;
            fGldShares = 0;
            fSpyShares = totalUSD / ind.close;
        }

        // Drawdown Tracking
        const curValB_EUR = (bSpyShares * ind.close) / ind.eurUsd;
        if (curValB_EUR > bPeakEUR) bPeakEUR = curValB_EUR;
        const ddB = ((bPeakEUR - curValB_EUR) / bPeakEUR) * 100;
        if (ddB > bMaxDD) bMaxDD = ddB;

        const curValG_EUR = (gGldShares * ind.gld) / ind.eurUsd;
        if (curValG_EUR > gPeakEUR) gPeakEUR = curValG_EUR;
        const ddG = ((gPeakEUR - curValG_EUR) / gPeakEUR) * 100;
        if (ddG > gMaxDD) gMaxDD = ddG;

        const curValP_EUR = ((pSpyShares * ind.close) + (pGldShares * ind.gld)) / ind.eurUsd;
        if (curValP_EUR > pPeakEUR) pPeakEUR = curValP_EUR;
        const ddP = ((pPeakEUR - curValP_EUR) / pPeakEUR) * 100;
        if (ddP > pMaxDD) pMaxDD = ddP;

        const curValS_EUR = ((sSpyShares * ind.close) + (sGldShares * ind.gld) + sCashUSD) / ind.eurUsd;
        if (curValS_EUR > sPeakEUR) sPeakEUR = curValS_EUR;
        const ddS = ((sPeakEUR - curValS_EUR) / sPeakEUR) * 100;
        if (ddS > sMaxDD) sMaxDD = ddS;

        const curValF_EUR = ((fSpyShares * ind.close) + (fGldShares * ind.gld)) / ind.eurUsd;
        if (curValF_EUR > fPeakEUR) fPeakEUR = curValF_EUR;
        const ddF = ((fPeakEUR - curValF_EUR) / fPeakEUR) * 100;
        if (ddF > fMaxDD) fMaxDD = ddF;
    }

    const lastDay = tradingDays[tradingDays.length - 1];
    const lastInd = indicators[lastDay];

    const finalValB_EUR = (bSpyShares * lastInd.close) / lastInd.eurUsd;
    const finalValG_EUR = (gGldShares * lastInd.gld) / lastInd.eurUsd;
    const finalValP_EUR = ((pSpyShares * lastInd.close) + (pGldShares * lastInd.gld)) / lastInd.eurUsd;
    const finalValS_EUR = ((sSpyShares * lastInd.close) + (sGldShares * lastInd.gld) + sCashUSD) / lastInd.eurUsd;
    const finalValF_EUR = ((fSpyShares * lastInd.close) + (fGldShares * lastInd.gld)) / lastInd.eurUsd;

    console.log('-'.repeat(80));
    console.log(`VERGLEICH ÜBER 21.8 JAHRE (18.11.2004 - 08.09.2026):`);
    console.log(`Gesamteinzahlung: € ${bInvestedEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (10.000 € Start + 261 Sparraten à 150 €)`);
    console.log('-'.repeat(80));

    const results = [
        { name: '1. Reiner S&P 500 Buy & Hold DCA (100% SPY)', endVal: finalValB_EUR, profit: finalValB_EUR - bInvestedEUR, ret: (finalValB_EUR - bInvestedEUR) / bInvestedEUR * 100, maxDD: bMaxDD },
        { name: '2. Reiner Gold Buy & Hold DCA (100% GLD)', endVal: finalValG_EUR, profit: finalValG_EUR - gInvestedEUR, ret: (finalValG_EUR - gInvestedEUR) / gInvestedEUR * 100, maxDD: gMaxDD },
        { name: '3. 50/50 SPY / GLD Permanent Portfolio DCA', endVal: finalValP_EUR, profit: finalValP_EUR - pInvestedEUR, ret: (finalValP_EUR - pInvestedEUR) / pInvestedEUR * 100, maxDD: pMaxDD },
        { name: '4. Gold-SPY Dynamic Shield (Notfall: 50% Gold / 50% Cash)', endVal: finalValS_EUR, profit: finalValS_EUR - sInvestedEUR, ret: (finalValS_EUR - sInvestedEUR) / sInvestedEUR * 100, maxDD: sMaxDD },
        { name: '5. Gold-SPY Dynamic Shield (Notfall: 100% Gold)', endVal: finalValF_EUR, profit: finalValF_EUR - fInvestedEUR, ret: (finalValF_EUR - fInvestedEUR) / fInvestedEUR * 100, maxDD: fMaxDD }
    ];

    results.forEach(r => {
        console.log(`\n📌 ${r.name}`);
        console.log(`   * Depot-Endwert:      € ${r.endVal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
        console.log(`   * Reingewinn:         +€ ${r.profit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${r.ret.toFixed(2)} %)`);
        console.log(`   * Maximaler Drawdown: -${r.maxDD.toFixed(2)} %`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('DIE WICHTIGSTEN KRISEN-EVENTS (NOTFALL-EVAKUIERUNGEN):');
    console.log('='.repeat(80));
    crisisEvents.slice(0, 15).forEach(e => {
        console.log(`[${e.date}] ${e.event} | SPY: $${e.spyPrice.toFixed(2)} | GLD: $${e.gldPrice.toFixed(2)} | VIX: ${e.vix.toFixed(1)} | Depot: $${e.totalUSD.toFixed(2)}`);
    });
    console.log('='.repeat(80));
}

runFullHistorySimulation().catch(console.error);
