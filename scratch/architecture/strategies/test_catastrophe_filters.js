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

async function runTest() {
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

    // Moving Averages
    const spySma200 = {};
    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        if (i >= 199) {
            let s200 = 0;
            for (let j = 0; j < 200; j++) s200 += spyMap[tradingDays[i - j]];
            spySma200[d] = s200 / 200;
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

    // Margin Debt Drawdown
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

    function simulateStrategy(name, triggerCheckFn) {
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
        let lastNetLiqDelta = 0;
        let lastMarginDebtDd = 0;
        let hedgeStartIdx = 0;
        const executedHedges = [];

        for (let i = 0; i < tradingDays.length; i++) {
            const d = tradingDays[i];
            const spyPrice = spyMap[d];
            const gldPrice = gldMap[d];
            const fx = fxMap[d];
            const vix = vixMap[d];
            const m = d.substring(0, 7);
            const s200 = spySma200[d];

            if (netLiqDeltaMap[d] !== undefined) lastNetLiqDelta = netLiqDeltaMap[d];
            if (marginDebtDdMap[d] !== undefined) lastMarginDebtDd = marginDebtDdMap[d];

            const tDay = timelineMap[d];
            const cfi = tDay?.macroGroups?.FinancialConditions?.ChicagoFedIndex !== undefined ? tDay.macroGroups.FinancialConditions.ChicagoFedIndex : -0.5;
            const sahm = tDay?.macroGroups?.Leading?.SahmRule !== undefined ? tDay.macroGroups.Leading.SahmRule : 0;
            const spread10y2y = tDay?.macroGroups?.YieldCurve?.Spread10y2y !== undefined ? tDay.macroGroups.YieldCurve.Spread10y2y : 1.0;

            if (spyPrice > spyAth) spyAth = spyPrice;
            const spyDdFromAth = ((spyAth - spyPrice) / spyAth) * 100;

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
                d, i, spyPrice, gldPrice, fx, vix, s200,
                spyAth, spyDdFromAth,
                cfi, sahm, spread10y2y, netLiqDelta: lastNetLiqDelta, marginDebtDd: lastMarginDebtDd
            };

            const shouldTrigger = triggerCheckFn(ctx);

            // Re-Entry: Trend-Rückeroberung (SPY > SMA 200) ODER VIX-Panic Reversal (VIX war hoch und dreht ab)
            // Mit 10-Tage Cooldown gegen Day-to-Day Churn
            const daysInHedge = i - hedgeStartIdx;
            const trendReclaim = s200 && spyPrice > s200;
            const panicReversal = daysInHedge >= 10 && vix < 30 && (s200 ? spyPrice > s200 * 0.90 : true);
            const shouldReEnter = isHedged && (trendReclaim || panicReversal);

            if (!isHedged && shouldTrigger) {
                isHedged = true;
                triggerCount++;
                hedgeStartIdx = i;
                const totalUSD = (spyShares * spyPrice) + (gldShares * gldPrice) + cashUSD;
                spyShares = 0;
                gldShares = (totalUSD * 0.75) / gldPrice;
                cashUSD = totalUSD * 0.25;
                executedHedges.push({
                    start: d,
                    spyPrice,
                    gldPrice,
                    vix,
                    cfi: cfi.toFixed(2),
                    sahm: sahm.toFixed(2),
                    netLiq: lastNetLiqDelta.toFixed(1)
                });
            } else if (shouldReEnter) {
                isHedged = false;
                const totalUSD = (gldShares * gldPrice) + cashUSD;
                gldShares = 0;
                cashUSD = 0;
                spyShares = totalUSD / spyPrice;
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
            executedHedges
        };
    }

    // 1. Reines Trend-Signal (Keine Makro-Bestätigung)
    const t1 = simulateStrategy(
        '1. Reines Chart-Signal: SPY < SMA200 & DD >= 8%',
        ctx => ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 8.0
    );

    // 2. Trend + Volatilitäts-Filter (VIX >= 25 bestätigt echten Verkaufsdruck)
    const t2 = simulateStrategy(
        '2. Trend + VIX-Filter (VIX >= 25): Sortiert müde Dips ohne Volatilität aus',
        ctx => ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 8.0 && ctx.vix >= 25.0
    );

    // 3. Trend + Kredit-Stress-Filter (ChicagoFedIndex > -0.20 ODER VIX > 30)
    const t3 = simulateStrategy(
        '3. Trend + Kreditstress / Schock (ChicagoFed > -0.20 ODER VIX >= 30)',
        ctx => {
            const chartBreak = ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 8.0;
            const stressPresent = (ctx.cfi > -0.20) || (ctx.vix >= 30.0);
            return chartBreak && stressPresent;
        }
    );

    // 4. Trend + Multi-Makro-Radar (Mindestens 1 System-Gefahr aktiv: Kredit / Sahm / NetLiq / MarginDebt / VIX)
    const t4 = simulateStrategy(
        '4. Trend + CrashRadar Makro-Filter (Kredit OR Sahm OR NetLiq-Entzug OR MarginDebt OR VIX)',
        ctx => {
            const chartBreak = ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 8.0;
            const macroWarning = (ctx.cfi > -0.20) || (ctx.sahm >= 0.40) || (ctx.netLiqDelta < -5.0) || (ctx.marginDebtDd <= -5.0) || (ctx.vix >= 28.0);
            return chartBreak && macroWarning;
        }
    );

    // 5. Konservativer Katastrophen-Schutz (DD >= 10% & VIX >= 28)
    const t5 = simulateStrategy(
        '5. Nur schwere Bärenmärkte: SPY < SMA200 & DD >= 10% & VIX >= 28',
        ctx => ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 10.0 && ctx.vix >= 28.0
    );

    console.log('='.repeat(95));
    console.log('   SYSTEM-VERGLEICH: KATASTROPHEN ERKENNEN & NORMALE KORREKTUREN TOLERIEREN');
    console.log('='.repeat(95));

    [t1, t2, t3, t4, t5].forEach(r => {
        console.log(`\n📌 ${r.name}`);
        console.log(`   * Depot-Endwert:      € ${r.finalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
        console.log(`   * Reingewinn:         +€ ${r.profit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${r.ret.toFixed(2)} %)`);
        console.log(`   * Maximaler Drawdown: -${r.maxDD.toFixed(2)} % (${r.maxDDDate})`);
        console.log(`   * Notfall-Ausstiege:  ${r.triggerCount} Mal in 21.8 Jahren`);
    });
}

runTest().catch(console.error);
