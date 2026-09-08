import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

async function runMacroDetectionTest() {
    console.log('Lade Makro-Historie via FinanceExpert...');
    const fe = new FinanceExpert();
    const timeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
    await fe.close();

    const timelineMap = {};
    timeline.forEach(t => timelineMap[t.date] = t);

    const spyMap = {}, gldMap = {}, vixMap = {}, fxMap = {};
    spyQuotes.forEach(q => spyMap[q.date.substring(0, 10)] = q.adjClose || q.close);
    gldQuotes.forEach(q => gldMap[q.date.substring(0, 10)] = q.adjClose || q.close);
    vixQuotes.forEach(q => vixMap[q.date.substring(0, 10)] = q.close);
    fxQuotes.forEach(q => fxMap[q.date.substring(0, 10)] = q.close);

    const tradingDays = Object.keys(spyMap).filter(d => gldMap[d] && vixMap[d] && fxMap[d]).sort();

    // Moving Averages and Indicators
    const spySma200 = {};
    const spySma50 = {};
    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        if (i >= 199) {
            let s200 = 0;
            for (let j = 0; j < 200; j++) s200 += spyMap[tradingDays[i - j]];
            spySma200[d] = s200 / 200;
        }
        if (i >= 49) {
            let s50 = 0;
            for (let j = 0; j < 50; j++) s50 += spyMap[tradingDays[i - j]];
            spySma50[d] = s50 / 50;
        }
    }

    // Weekly Net Liquidity calculation
    const weeklyNetLiq = [];
    const netLiqDeltaMap = {};
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
    }
    for (let i = 8; i < weeklyNetLiq.length; i++) {
        const cur = weeklyNetLiq[i].netLiq;
        const past8 = weeklyNetLiq[i - 8].netLiq;
        const deltaPct = past8 !== 0 ? ((cur - past8) / Math.abs(past8)) * 100 : 0;
        netLiqDeltaMap[weeklyNetLiq[i].date] = deltaPct;
    }

    // Margin Debt Drawdown calculation
    const marginDebtHistory = [];
    const marginDebtDdMap = {};
    for (let i = 0; i < timeline.length; i++) {
        const md = timeline[i].macroGroups?.Leading?.MarginDebt;
        if (md !== undefined && md !== null) {
            marginDebtHistory.push({ date: timeline[i].date, val: md });
            const lookback = marginDebtHistory.slice(Math.max(0, marginDebtHistory.length - 180));
            const maxVal = Math.max(...lookback.map(x => x.val));
            const dd = maxVal > 0 ? ((md - maxVal) / maxVal) * 100 : 0;
            marginDebtDdMap[timeline[i].date] = dd;
        }
    }

    function simulateWithCondition(name, triggerConditionFn, reEntryConditionFn) {
        const START_CAPITAL_EUR = 10000;
        const MONTHLY_RATE_EUR = 150;
        let spyShares = 0, gldShares = 0, cashUSD = 0;
        let investedEUR = START_CAPITAL_EUR;
        let isHedged = false;
        let peakEUR = 0, maxDD = 0, maxDDDate = '';
        let lastMonth = tradingDays[0].substring(0, 7);

        const firstD = tradingDays[0];
        spyShares = (START_CAPITAL_EUR * fxMap[firstD]) / spyMap[firstD];
        let spyAth = spyMap[firstD];

        let triggerCount = 0;
        let daysUnderSma200 = 0;
        let lastNetLiqDelta = 0;
        let lastMarginDebtDd = 0;

        const events = [];
        let entryInfo = null;

        for (let i = 0; i < tradingDays.length; i++) {
            const d = tradingDays[i];
            const spyPrice = spyMap[d];
            const gldPrice = gldMap[d];
            const fx = fxMap[d];
            const vix = vixMap[d];
            const m = d.substring(0, 7);
            const s200 = spySma200[d];
            const s50 = spySma50[d];

            if (netLiqDeltaMap[d] !== undefined) lastNetLiqDelta = netLiqDeltaMap[d];
            if (marginDebtDdMap[d] !== undefined) lastMarginDebtDd = marginDebtDdMap[d];

            const tDay = timelineMap[d];
            const cfi = tDay?.macroGroups?.FinancialConditions?.ChicagoFedIndex !== undefined ? tDay.macroGroups.FinancialConditions.ChicagoFedIndex : -0.5;
            const sahm = tDay?.macroGroups?.Leading?.SahmRule !== undefined ? tDay.macroGroups.Leading.SahmRule : 0;
            const spread10y2y = tDay?.macroGroups?.YieldCurve?.Spread10y2y !== undefined ? tDay.macroGroups.YieldCurve.Spread10y2y : 1.0;

            if (spyPrice > spyAth) spyAth = spyPrice;
            const spyDdFromAth = ((spyAth - spyPrice) / spyAth) * 100;

            if (s200 && spyPrice < s200) {
                daysUnderSma200++;
            } else {
                daysUnderSma200 = 0;
            }

            // DCA
            if (m !== lastMonth) {
                investedEUR += MONTHLY_RATE_EUR;
                lastMonth = m;
                const addUSD = MONTHLY_RATE_EUR * fx;
                if (isHedged) {
                    gldShares += (addUSD * 0.75) / gldPrice;
                    cashUSD += addUSD * 0.25;
                } else {
                    spyShares += addUSD / spyPrice;
                }
            }

            const ctx = {
                d, i, spyPrice, gldPrice, fx, vix, s200, s50,
                spyAth, spyDdFromAth, daysUnderSma200,
                cfi, sahm, spread10y2y, netLiqDelta: lastNetLiqDelta, marginDebtDd: lastMarginDebtDd
            };

            const shouldTrigger = triggerConditionFn(ctx);
            const shouldReEnter = reEntryConditionFn(ctx, entryInfo);

            if (!isHedged && shouldTrigger) {
                isHedged = true;
                triggerCount++;
                const totalUSD = (spyShares * spyPrice) + (gldShares * gldPrice) + cashUSD;
                spyShares = 0;
                gldShares = (totalUSD * 0.75) / gldPrice;
                cashUSD = totalUSD * 0.25;
                entryInfo = { date: d, spyPrice, gldPrice, totalUSD, i };
            } else if (isHedged && shouldReEnter) {
                isHedged = false;
                const totalUSD = (gldShares * gldPrice) + cashUSD;
                events.push({
                    exit: entryInfo.date,
                    reEntry: d,
                    days: i - entryInfo.i,
                    spyDrop: ((spyPrice - entryInfo.spyPrice) / entryInfo.spyPrice * 100).toFixed(1) + '%'
                });
                gldShares = 0;
                cashUSD = 0;
                spyShares = totalUSD / spyPrice;
                entryInfo = null;
            }

            const curValUSD = (spyShares * spyPrice) + (gldShares * gldPrice) + cashUSD;
            const curValEUR = curValUSD / fx;
            if (curValEUR > peakEUR) peakEUR = curValEUR;
            const dd = ((peakEUR - curValEUR) / peakEUR) * 100;
            if (dd > maxDD) {
                maxDD = dd;
                maxDDDate = d;
            }
        }

        const lastD = tradingDays[tradingDays.length - 1];
        const finalUSD = (spyShares * spyMap[lastD]) + (gldShares * gldMap[lastD]) + cashUSD;
        const finalEUR = finalUSD / fxMap[lastD];
        return {
            name,
            finalEUR,
            profit: finalEUR - investedEUR,
            ret: ((finalEUR - investedEUR) / investedEUR) * 100,
            maxDD,
            maxDDDate,
            triggerCount,
            eventsCount: events.length
        };
    }

    // Standard Re-entry: SMA200 reclaim or VIX >= 35 panic reversal
    const standardReEntry = (ctx) => (ctx.s200 && ctx.spyPrice > ctx.s200) || (ctx.vix >= 35 && (ctx.s200 ? ctx.spyPrice > ctx.s200 * 0.85 : true));

    // 1. Baseline: SPY < SMA200 & DD >= 8% (ohne Makro-Filter)
    const baseline = simulateWithCondition(
        '1. Baseline: Reiner Trend-Bruch (SPY < SMA200 & DD >= 8%)',
        ctx => ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 8.0,
        standardReEntry
    );

    // 2. Filter 3-Tage-Hysterese: SPY muss mind. 3 Tage unter SMA 200 schließen (vermeidet Whipsaw bei 1-2 Tage Dips)
    const filterHysteresis = simulateWithCondition(
        '2. Filter Hysterese: SPY mindestens 3 Tage unter SMA 200 & DD >= 8%',
        ctx => ctx.s200 && ctx.daysUnderSma200 >= 3 && ctx.spyDdFromAth >= 8.0,
        standardReEntry
    );

    // 3. Filter Makro-Katastrophe (Kombi-Signal):
    // SPY < SMA200 & DD >= 8% UND mindestens EIN harter Makro-Alarm ist aktiv:
    // (ChicagoFedIndex > -0.20 ODER SahmRule >= 0.40 ODER NetLiq < -5% ODER MarginDebt <= -5% ODER VIX > 28)
    const filterMacroConfirmed = simulateWithCondition(
        '3. Makro-Validierung: Trend-Bruch + Makro-Katastrophen-Alarm (Kredit / Sahm / NetLiq / VIX)',
        ctx => {
            const technicalTrendBreak = ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 8.0;
            const macroAlarm = (ctx.cfi > -0.20) || (ctx.sahm >= 0.40) || (ctx.netLiqDelta < -5.0) || (ctx.marginDebtDd <= -5.0) || (ctx.vix >= 28);
            return technicalTrendBreak && macroAlarm;
        },
        standardReEntry
    );

    // 4. Filter Tiefer Drawdown Puffer (DD >= 10% statt 8%):
    // Erlaubt normale Korrekturen bis 10%, steigt erst bei echtem Bärenmarkt-Verdacht aus
    const filterDdPuffer = simulateWithCondition(
        '4. Robuster Puffer: SPY < SMA200 & DD >= 10.0% (Toleriert normale 8-9% Dips)',
        ctx => ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 10.0,
        standardReEntry
    );

    // 5. Das Ultimative Dual-Regime (Makro schlägt Trend):
    // A) Sofortiger Ausstieg bei Schock-Katastrophe: VIX > 35 ODER (NetLiq < -5% & CFI > 0)
    // B) Oder bei Trend-Bruch SPY < SMA200 mit 3-Tage Hysterese & DD >= 9%
    const filterUltimate = simulateWithCondition(
        '5. Ultimatives Schutzschild: (Schock: VIX>35 | NetLiq+Stress) ODER (3-Tage Trendbruch & DD>=9%)',
        ctx => {
            const shockEvent = (ctx.vix >= 35) || (ctx.netLiqDelta < -5.0 && ctx.cfi > 0);
            const trendConfirmed = ctx.s200 && ctx.daysUnderSma200 >= 3 && ctx.spyDdFromAth >= 9.0;
            return shockEvent || trendConfirmed;
        },
        standardReEntry
    );

    console.log('='.repeat(90));
    console.log('   VERGLEICH: WIE VERMEIDEN WIR FEHLAUSSTIEGE IN NORMALEN KORREKTUREN?');
    console.log('='.repeat(90));

    [baseline, filterHysteresis, filterMacroConfirmed, filterDdPuffer, filterUltimate].forEach(r => {
        console.log(`\n📌 ${r.name}`);
        console.log(`   * Depot-Endwert:      € ${r.finalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
        console.log(`   * Reingewinn:         +€ ${r.profit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${r.ret.toFixed(2)} %)`);
        console.log(`   * Maximaler Drawdown: -${r.maxDD.toFixed(2)} % (${r.maxDDDate})`);
        console.log(`   * Ausstiege (Events): ${r.triggerCount} Triggers`);
    });
}

runMacroDetectionTest().catch(console.error);
