import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const cacheDir = path.resolve(__dirname, '../../trash/cache');
const spyQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'SPY_2004-11-18_2026-09-08.json'), 'utf8'));
const gldQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'GLD_2004-11-18_2026-09-08.json'), 'utf8'));
const vixQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, '_VIX_2004-11-18_2026-09-08.json'), 'utf8'));
const fxQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'EURUSD_X_2004-11-18_2026-09-08.json'), 'utf8'));

import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { PanicCapitulationIndicator } from '../../../src/analysis/indicators/PanicCapitulationIndicator.js';

async function runDiagnostics() {
    const fe = new FinanceExpert();
    const timeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
    await fe.close();

    const panicCapitulationMap = {};
    const panicInd = new PanicCapitulationIndicator();
    for (let i = 90; i < timeline.length; i++) {
        const panicRes = panicInd.evaluate(timeline.slice(0, i + 1));
        if (panicRes && panicRes.status === 'CRITICAL') {
            panicCapitulationMap[timeline[i].date] = true;
        }
    }

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

    const spyMap = {}, gldMap = {}, vixMap = {}, fxMap = {};
    spyQuotes.forEach(q => spyMap[q.date.substring(0, 10)] = q.adjClose || q.close);
    gldQuotes.forEach(q => gldMap[q.date.substring(0, 10)] = q.adjClose || q.close);
    vixQuotes.forEach(q => vixMap[q.date.substring(0, 10)] = q.close);
    fxQuotes.forEach(q => fxMap[q.date.substring(0, 10)] = q.close);

    const tradingDays = Object.keys(spyMap).filter(d => gldMap[d] && vixMap[d] && fxMap[d]).sort();

    const indicators = {};
    let prevEma20 = spyMap[tradingDays[0]];
    const k20 = 2 / (20 + 1);

    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        const close = spyMap[d];
        const ema20 = (close * k20) + (prevEma20 * (1 - k20));
        prevEma20 = ema20;

        indicators[d] = {
            date: d,
            close,
            gld: gldMap[d],
            vix: vixMap[d],
            eurUsd: fxMap[d],
            ema20,
            stress: stressMap[d] !== undefined ? stressMap[d] : -0.5
        };
    }

    const START_CAPITAL_EUR = 10000;
    const MONTHLY_RATE_EUR = 150;

    let sSpyShares = 0, sGldShares = 0, sCashUSD = 0;
    let sInvestedEUR = START_CAPITAL_EUR;
    let sPeakEUR = 0, sMaxDD = 0, sMaxDDDate = '', sMaxDDPeakDate = '';
    let sLastMonth = tradingDays[0].substring(0, 7);
    let sMacroRed = false;
    let sLastReEntryIdx = -999;
    sSpyShares += (START_CAPITAL_EUR * indicators[tradingDays[0]].eurUsd) / indicators[tradingDays[0]].close;

    let bSpyShares = (START_CAPITAL_EUR * indicators[tradingDays[0]].eurUsd) / indicators[tradingDays[0]].close;
    let bPeakEUR = 0, bMaxDD = 0, bMaxDDDate = '', bMaxDDPeakDate = '';

    let lastNetLiqDelta = 0;
    const events = [];
    let entryInfo = null;

    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        const ind = indicators[d];
        const m = d.substring(0, 7);

        if (netLiqDeltaMap[d] !== undefined) {
            lastNetLiqDelta = netLiqDeltaMap[d];
        }

        const isPanicCapitulation = panicCapitulationMap[d] || (ind.vix >= 35 && ind.close > ind.ema20);
        const isCreditStress = (ind.stress > -0.25 || ind.vix > 28);
        const shouldTriggerRed = (lastNetLiqDelta < -5.0 && isCreditStress);
        const shouldReEnter = (lastNetLiqDelta >= 0.0 || isPanicCapitulation);

        if (m !== sLastMonth) {
            sInvestedEUR += MONTHLY_RATE_EUR;
            if (sMacroRed) {
                sGldShares += (MONTHLY_RATE_EUR * 0.5 * ind.eurUsd) / ind.gld;
                sCashUSD += MONTHLY_RATE_EUR * 0.5 * ind.eurUsd;
            } else {
                sSpyShares += (MONTHLY_RATE_EUR * ind.eurUsd) / ind.close;
            }
            bSpyShares += (MONTHLY_RATE_EUR * ind.eurUsd) / ind.close;
            sLastMonth = m;
        }

        const canTriggerS = (i - sLastReEntryIdx > 30);
        if (!sMacroRed && shouldTriggerRed && canTriggerS) {
            sMacroRed = true;
            const totalUSD = (sSpyShares * ind.close) + (sGldShares * ind.gld) + sCashUSD;
            entryInfo = {
                triggerDate: d,
                spyPrice: ind.close,
                gldPrice: ind.gld,
                totalUSD,
                eurUsd: ind.eurUsd,
                netLiqDelta: lastNetLiqDelta,
                vix: ind.vix,
                stress: ind.stress,
                triggerIdx: i
            };
            sSpyShares = 0;
            sGldShares = (totalUSD * 0.50) / ind.gld;
            sCashUSD = totalUSD * 0.50;
        } else if (sMacroRed && shouldReEnter) {
            sMacroRed = false;
            sLastReEntryIdx = i;
            const totalUSD = (sGldShares * ind.gld) + sCashUSD;
            const spyReturn = ((ind.close - entryInfo.spyPrice) / entryInfo.spyPrice) * 100;
            const gldReturn = ((ind.gld - entryInfo.gldPrice) / entryInfo.gldPrice) * 100;
            const portReturn = ((totalUSD - entryInfo.totalUSD) / entryInfo.totalUSD) * 100;

            events.push({
                exitDate: entryInfo.triggerDate,
                reEntryDate: d,
                durationDays: i - entryInfo.triggerIdx,
                spyExit: entryInfo.spyPrice.toFixed(2),
                spyReEntry: ind.close.toFixed(2),
                spyReturnPct: spyReturn.toFixed(2) + '%',
                gldExit: entryInfo.gldPrice.toFixed(2),
                gldReEntry: ind.gld.toFixed(2),
                gldReturnPct: gldReturn.toFixed(2) + '%',
                portReturnPct: portReturn.toFixed(2) + '%',
                reEntryReason: lastNetLiqDelta >= 0.0 ? 'NetLiq >= 0' : 'Panic Capitulation'
            });

            sGldShares = 0;
            sCashUSD = 0;
            sSpyShares = totalUSD / ind.close;
            entryInfo = null;
        }

        const curValB_EUR = (bSpyShares * ind.close) / ind.eurUsd;
        if (curValB_EUR > bPeakEUR) {
            bPeakEUR = curValB_EUR;
            bMaxDDPeakDate = d;
        }
        const ddB = ((bPeakEUR - curValB_EUR) / bPeakEUR) * 100;
        if (ddB > bMaxDD) {
            bMaxDD = ddB;
            bMaxDDDate = d;
        }

        const curValS_EUR = ((sSpyShares * ind.close) + (sGldShares * ind.gld) + sCashUSD) / ind.eurUsd;
        if (curValS_EUR > sPeakEUR) {
            sPeakEUR = curValS_EUR;
            sMaxDDPeakDate = d;
        }
        const ddS = ((sPeakEUR - curValS_EUR) / sPeakEUR) * 100;
        if (ddS > sMaxDD) {
            sMaxDD = ddS;
            sMaxDDDate = d;
        }
    }

    console.log('=== ALLE NOTFALL-TRIGGER & HEDGE-PERIODEN (MODELL 4: 50/50 GOLD/CASH) ===');
    console.table(events);

    console.log('\n=== DRAWDOWN ANALYSE ===');
    console.log(`Reiner SPY Buy&Hold: Max DD -${bMaxDD.toFixed(2)}% am ${bMaxDDDate} (Peak war am ${bMaxDDPeakDate})`);
    console.log(`Gold-SPY Shield:     Max DD -${sMaxDD.toFixed(2)}% am ${sMaxDDDate} (Peak war am ${sMaxDDPeakDate})`);
}

runDiagnostics().catch(console.error);
