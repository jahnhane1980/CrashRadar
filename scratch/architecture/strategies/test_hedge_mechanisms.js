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

const spyMap = {}, gldMap = {}, vixMap = {}, fxMap = {};
spyQuotes.forEach(q => spyMap[q.date.substring(0, 10)] = q.adjClose || q.close);
gldQuotes.forEach(q => gldMap[q.date.substring(0, 10)] = q.adjClose || q.close);
vixQuotes.forEach(q => vixMap[q.date.substring(0, 10)] = q.close);
fxQuotes.forEach(q => fxMap[q.date.substring(0, 10)] = q.close);

const tradingDays = Object.keys(spyMap).filter(d => gldMap[d] && vixMap[d] && fxMap[d]).sort();

// Calculate SMA 200 and ATH for SPY
const sma200 = {};
for (let i = 0; i < tradingDays.length; i++) {
    if (i >= 199) {
        let sum = 0;
        for (let j = 0; j < 200; j++) sum += spyMap[tradingDays[i - j]];
        sma200[tradingDays[i]] = sum / 200;
    }
}

console.log('=== TEST: WAS PASSIERT BEI VERSCHIEDENEN AUSSTIEGS-TRIGGERN? ===');

// Let's test:
// Case 1: Pure Buy & Hold SPY
// Case 2: User's intuition: "Wenn SPY 10% Drawdown hat und unter SMA 200 fällt -> Evakuierung in 50% Gold / 50% Cash"
// Re-entry wenn SPY wieder über SMA 200 schließt oder VIX von Panik (>35) abdreht
function simulateRule(name, triggerFn, reEntryFn, allocation) {
    const START_CAPITAL_EUR = 10000;
    const MONTHLY_RATE_EUR = 150;
    let spyShares = 0, gldShares = 0, cashUSD = 0;
    let investedEUR = START_CAPITAL_EUR;
    let isHedged = false;
    let peakEUR = 0, maxDD = 0, maxDDDate = '';
    let lastMonth = tradingDays[0].substring(0, 7);

    // Initial buy
    const firstD = tradingDays[0];
    spyShares = (START_CAPITAL_EUR * fxMap[firstD]) / spyMap[firstD];

    let spyAth = spyMap[firstD];
    let hedgeEvents = [];
    let entryInfo = null;

    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        const spyPrice = spyMap[d];
        const gldPrice = gldMap[d];
        const fx = fxMap[d];
        const vix = vixMap[d];
        const m = d.substring(0, 7);
        const s200 = sma200[d];

        if (spyPrice > spyAth) spyAth = spyPrice;
        const spyDdFromAth = ((spyAth - spyPrice) / spyAth) * 100;

        // DCA
        if (m !== lastMonth) {
            investedEUR += MONTHLY_RATE_EUR;
            lastMonth = m;
            const addUSD = MONTHLY_RATE_EUR * fx;
            if (isHedged) {
                gldShares += (addUSD * allocation.gold) / gldPrice;
                cashUSD += addUSD * allocation.cash;
            } else {
                spyShares += addUSD / spyPrice;
            }
        }

        const state = { d, i, spyPrice, gldPrice, fx, vix, s200, spyAth, spyDdFromAth, isHedged };

        if (!isHedged && triggerFn(state)) {
            isHedged = true;
            const totalUSD = (spyShares * spyPrice) + (gldShares * gldPrice) + cashUSD;
            spyShares = 0;
            gldShares = (totalUSD * allocation.gold) / gldPrice;
            cashUSD = totalUSD * allocation.cash;
            entryInfo = { date: d, spyPrice, gldPrice, totalUSD };
        } else if (isHedged && reEntryFn(state, entryInfo)) {
            isHedged = false;
            const totalUSD = (gldShares * gldPrice) + cashUSD;
            const spyRet = ((spyPrice - entryInfo.spyPrice) / entryInfo.spyPrice) * 100;
            const gldRet = ((gldPrice - entryInfo.gldPrice) / entryInfo.gldPrice) * 100;
            const portRet = ((totalUSD - entryInfo.totalUSD) / entryInfo.totalUSD) * 100;
            hedgeEvents.push({
                exit: entryInfo.date,
                reEntry: d,
                spyExit: entryInfo.spyPrice.toFixed(2),
                spyReEntry: spyPrice.toFixed(2),
                spyRet: spyRet.toFixed(1) + '%',
                gldRet: gldRet.toFixed(1) + '%',
                portRet: portRet.toFixed(1) + '%'
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
    const ret = ((finalEUR - investedEUR) / investedEUR) * 100;

    return { name, finalEUR, profit: finalEUR - investedEUR, ret, maxDD, maxDDDate, hedgeEventsCount: hedgeEvents.length, hedgeEvents };
}

// Test 1: Trend-Breakdown (SPY bricht unter SMA200 UND DD von ATH > 8%)
// Re-entry: SPY schließt wieder über SMA 200
const testSMA200_5050 = simulateRule(
    'Trend-Filter: SPY < SMA200 & DD > 8% (50/50 Gold/Cash)',
    s => s.s200 && s.spyPrice < s.s200 && s.spyDdFromAth >= 8.0,
    s => s.s200 && s.spyPrice > s.s200,
    { gold: 0.5, cash: 0.5 }
);

const testSMA200_100Gold = simulateRule(
    'Trend-Filter: SPY < SMA200 & DD > 8% (100% Gold)',
    s => s.s200 && s.spyPrice < s.s200 && s.spyDdFromAth >= 8.0,
    s => s.s200 && s.spyPrice > s.s200,
    { gold: 1.0, cash: 0.0 }
);

// Test 2: Trend-Filter + Panic Reversal Re-entry (Bottom-Finder)
const testSMA200_PanicBottom = simulateRule(
    'Trend-Filter + VIX Bottom Reversal (100% Gold)',
    s => s.s200 && s.spyPrice < s.s200 && s.spyDdFromAth >= 8.0,
    (s, entry) => (s.s200 && s.spyPrice > s.s200) || (s.vix > 35 && s.spyPrice > s.s200 * 0.85),
    { gold: 1.0, cash: 0.0 }
);

console.log('\n--- VERGLEICHS-ERGEBNISSE ---');
[testSMA200_5050, testSMA200_100Gold, testSMA200_PanicBottom].forEach(r => {
    console.log(`\nStrategie: ${r.name}`);
    console.log(`Endwert: € ${r.finalEUR.toFixed(2)} | Rendite: +${r.ret.toFixed(2)}% | Max DD: -${r.maxDD.toFixed(2)}% (${r.maxDDDate}) | Triggers: ${r.hedgeEventsCount}`);
    console.table(r.hedgeEvents);
});
