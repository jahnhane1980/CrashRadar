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

async function runKatastrophenMatrix() {
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

    const spySma200 = {};
    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        if (i >= 199) {
            let s200 = 0;
            for (let j = 0; j < 200; j++) s200 += spyMap[tradingDays[i - j]];
            spySma200[d] = s200 / 200;
        }
    }

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

    function runSimulation(name, filterFn) {
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
        let lastReEntryIdx = -999;
        const hedgeTrades = [];
        let hedgeEntry = null;

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
                cfi, sahm, netLiqDelta: lastNetLiqDelta, marginDebtDd: lastMarginDebtDd
            };

            const isKatastrophe = filterFn(ctx);

            // Re-entry: Entweder S&P 500 erobert SMA 200 zurück ODER VIX-Panik-Boden (VIX >= 35 und SPY überlebt)
            // Anti-Whipsaw: Mindestens 15 Tage im Hedge
            const canReEnter = (i - hedgeEntry?.idx >= 15);
            const trendReclaim = s200 && spyPrice > s200;
            const panicCapitulation = vix >= 35 && (s200 ? spyPrice > s200 * 0.85 : true);
            const shouldReEnter = isHedged && canReEnter && (trendReclaim || panicCapitulation);

            if (!isHedged && isKatastrophe && (i - lastReEntryIdx > 20)) {
                isHedged = true;
                triggerCount++;
                const totalUSD = (spyShares * spyPrice) + (gldShares * gldPrice) + cashUSD;
                spyShares = 0;
                gldShares = (totalUSD * 0.75) / gldPrice;
                cashUSD = totalUSD * 0.25;
                hedgeEntry = { idx: i, date: d, spyPrice, gldPrice, totalUSD };
            } else if (shouldReEnter) {
                isHedged = false;
                lastReEntryIdx = i;
                const totalUSD = (gldShares * gldPrice) + cashUSD;
                const spyChange = ((spyPrice - hedgeEntry.spyPrice) / hedgeEntry.spyPrice) * 100;
                const gldChange = ((gldPrice - hedgeEntry.gldPrice) / hedgeEntry.gldPrice) * 100;
                const portChange = ((totalUSD - hedgeEntry.totalUSD) / hedgeEntry.totalUSD) * 100;
                hedgeTrades.push({
                    start: hedgeEntry.date,
                    end: d,
                    days: i - hedgeEntry.idx,
                    spyChange: spyChange.toFixed(1) + '%',
                    gldChange: gldChange.toFixed(1) + '%',
                    portChange: portChange.toFixed(1) + '%'
                });
                gldShares = 0;
                cashUSD = 0;
                spyShares = totalUSD / spyPrice;
                hedgeEntry = null;
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
            hedgeTrades
        };
    }

    // Benchmark 1: Reines Trend-Signal (Kein Makro-Filter)
    const mTrend = runSimulation(
        '1. Reiner Chart-Trendbruch: SPY < SMA 200 & DD >= 8%',
        ctx => ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 8.0
    );

    // Filter A: Trend + Volatilitäts-Filter (VIX >= 24)
    // "Eine normale Korrektur hat VIX < 24; ein echter Absturz hat Panik"
    const mVix = runSimulation(
        '2. Chart + Volatilität: SPY < SMA 200 & DD >= 8% & VIX >= 24',
        ctx => ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 8.0 && ctx.vix >= 24.0
    );

    // Filter B: Die 3-Säulen-Katastrophen-Matrix (Chartbruch + mindestens 1 System-Alarm):
    // 1. Schock/Flash-Crash: VIX >= 28
    // 2. Kredit-Stress: Chicago Fed Index > -0.20
    // 3. Liquiditäts-Entzug: NetLiq 8W-Delta < -5.0%
    // 4. Hebel-Kollaps: Margin Debt Drawdown <= -5.0%
    // 5. Rezessions-Ausbruch: Sahm Rule >= 0.40
    const mMatrix = runSimulation(
        '3. Die 3-Säulen-Katastrophen-Matrix (Trendbruch + Makro-Alarm)',
        ctx => {
            const chartBreak = ctx.s200 && ctx.spyPrice < ctx.s200 && ctx.spyDdFromAth >= 8.0;
            const macroKatastrophe = (ctx.vix >= 28.0) ||
                                     (ctx.cfi > -0.20) ||
                                     (ctx.netLiqDelta < -5.0) ||
                                     (ctx.marginDebtDd <= -5.0) ||
                                     (ctx.sahm >= 0.40);
            return chartBreak && macroKatastrophe;
        }
    );

    console.log('='.repeat(95));
    console.log('   VERGLEICH: CHARTBRUCH ALLEIN VS. KATASTROPHEN-MATRIX');
    console.log('='.repeat(95));

    [mTrend, mVix, mMatrix].forEach(r => {
        console.log(`\n📌 ${r.name}`);
        console.log(`   * Depot-Endwert:      € ${r.finalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
        console.log(`   * Reingewinn:         +€ ${r.profit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${r.ret.toFixed(2)} %)`);
        console.log(`   * Maximaler Drawdown: -${r.maxDD.toFixed(2)} % (${r.maxDDDate})`);
        console.log(`   * Notfall-Ausstiege:  ${r.triggerCount} Mal in 21.8 Jahren`);
    });

    console.log('\n' + '='.repeat(95));
    console.log('DIE TRADES DER KATASTROPHEN-MATRIX (3):');
    console.log('='.repeat(95));
    console.table(mMatrix.hedgeTrades);
}

runKatastrophenMatrix().catch(console.error);
