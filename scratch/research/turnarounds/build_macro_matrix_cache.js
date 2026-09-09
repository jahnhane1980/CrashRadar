import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const cacheDir = path.resolve(__dirname, '../../trash/cache');
const outCacheDir = path.resolve(__dirname, 'data_cache');
const spyQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'SPY_2004-11-18_2026-09-08.json'), 'utf8'));
const gldQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'GLD_2004-11-18_2026-09-08.json'), 'utf8'));
const vixQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, '_VIX_2004-11-18_2026-09-08.json'), 'utf8'));
const fxQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'EURUSD_X_2004-11-18_2026-09-08.json'), 'utf8'));

import { FinanceExpert } from '../../../src/services/FinanceExpert.js';

async function buildMacroMatrixCache() {
    console.log('[MACRO CACHE] Lade Makro-Zeitreihe aus DB...');
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

    // Run Katastrophen-Matrix state tracker
    let isHedged = false;
    let hedgeEntry = null;
    let lastReEntryIdx = -999;
    let lastNetLiqDelta = 0;
    let lastMarginDebtDd = 0;
    let spyAth = spyMap[tradingDays[0]];

    const macroMatrixByDate = {};

    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        const spyPrice = spyMap[d];
        const vix = vixMap[d];
        const s200 = spySma200[d];

        if (netLiqDeltaMap[d] !== undefined) lastNetLiqDelta = netLiqDeltaMap[d];
        if (marginDebtDdMap[d] !== undefined) lastMarginDebtDd = marginDebtDdMap[d];

        const tDay = timelineMap[d];
        const cfi = tDay?.macroGroups?.FinancialConditions?.ChicagoFedIndex !== undefined ? tDay.macroGroups.FinancialConditions.ChicagoFedIndex : -0.5;
        const sahm = tDay?.macroGroups?.Leading?.SahmRule !== undefined ? tDay.macroGroups.Leading.SahmRule : 0;

        if (spyPrice > spyAth) spyAth = spyPrice;
        const spyDdFromAth = ((spyAth - spyPrice) / spyAth) * 100;

        // Katastrophen-Matrix Logic (from Investment-Signaldienst.md)
        const chartBreak = s200 && spyPrice < s200 && spyDdFromAth >= 8.0;
        const macroKatastrophe = (vix >= 28.0) ||
                                 (cfi > -0.20) ||
                                 (lastNetLiqDelta < -5.0) ||
                                 (lastMarginDebtDd <= -5.0) ||
                                 (sahm >= 0.40);
        const isKatastropheTrigger = chartBreak && macroKatastrophe;

        const canReEnter = (i - hedgeEntry?.idx >= 15);
        const trendReclaim = s200 && spyPrice > s200;
        const panicCapitulation = vix >= 35 && (s200 ? spyPrice > s200 * 0.85 : true);
        const shouldReEnter = isHedged && canReEnter && (trendReclaim || panicCapitulation);

        if (!isHedged && isKatastropheTrigger && (i - lastReEntryIdx > 20)) {
            isHedged = true;
            hedgeEntry = { idx: i, date: d, spyPrice };
        } else if (shouldReEnter) {
            isHedged = false;
            lastReEntryIdx = i;
            hedgeEntry = null;
        }

        macroMatrixByDate[d] = {
            date: d,
            isCrisisHedged: isHedged, // True when macro crisis active
            isKatastropheTrigger,
            spyPrice,
            s200: s200 || null,
            spyDdFromAth: parseFloat(spyDdFromAth.toFixed(2)),
            vix: parseFloat(vix.toFixed(2)),
            cfi: parseFloat(cfi.toFixed(2)),
            netLiqDelta: parseFloat(lastNetLiqDelta.toFixed(2)),
            marginDebtDd: parseFloat(lastMarginDebtDd.toFixed(2)),
            sahm: parseFloat(sahm.toFixed(2))
        };
    }

    const outFile = path.join(outCacheDir, 'macro_regime_daily.json');
    fs.writeFileSync(outFile, JSON.stringify(macroMatrixByDate, null, 2));
    console.log(`[ERFOLG] Makro-Katastrophen-Matrix gecacht: ${Object.keys(macroMatrixByDate).length} Tage -> ${outFile}`);
}

buildMacroMatrixCache().catch(console.error);
