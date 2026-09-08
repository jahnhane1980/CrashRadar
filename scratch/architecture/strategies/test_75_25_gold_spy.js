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

// Calculate SMA 200
const sma200 = {};
for (let i = 0; i < tradingDays.length; i++) {
    if (i >= 199) {
        let sum = 0;
        for (let j = 0; j < 200; j++) sum += spyMap[tradingDays[i - j]];
        sma200[tradingDays[i]] = sum / 200;
    }
}

function simulateShield(name, goldWeight, cashWeight, usePanicSniper) {
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
                gldShares += (addUSD * goldWeight) / gldPrice;
                cashUSD += addUSD * cashWeight;
            } else {
                spyShares += addUSD / spyPrice;
            }
        }

        // Trigger: SPY < SMA 200 & DD >= 8%
        const shouldTrigger = s200 && spyPrice < s200 && spyDdFromAth >= 8.0;

        // Re-Entry
        const trendReclaim = s200 && spyPrice > s200;
        const panicSniper = vix >= 35 && (s200 ? spyPrice > s200 * 0.85 : true);
        const shouldReEnter = usePanicSniper ? (trendReclaim || panicSniper) : trendReclaim;

        if (!isHedged && shouldTrigger) {
            isHedged = true;
            triggerCount++;
            const totalUSD = (spyShares * spyPrice) + (gldShares * gldPrice) + cashUSD;
            spyShares = 0;
            gldShares = (totalUSD * goldWeight) / gldPrice;
            cashUSD = totalUSD * cashWeight;
        } else if (isHedged && shouldReEnter) {
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
    const ret = ((finalEUR - investedEUR) / investedEUR) * 100;

    return {
        name,
        finalEUR,
        profit: finalEUR - investedEUR,
        ret,
        maxDD,
        maxDDDate,
        triggerCount
    };
}

// Benchmark: Buy & Hold SPY
const buyAndHold = (() => {
    const START_CAPITAL_EUR = 10000;
    const MONTHLY_RATE_EUR = 150;
    let spyShares = (START_CAPITAL_EUR * fxMap[tradingDays[0]]) / spyMap[tradingDays[0]];
    let investedEUR = START_CAPITAL_EUR;
    let peakEUR = 0, maxDD = 0, maxDDDate = '';
    let lastMonth = tradingDays[0].substring(0, 7);

    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        const m = d.substring(0, 7);
        if (m !== lastMonth) {
            investedEUR += MONTHLY_RATE_EUR;
            spyShares += (MONTHLY_RATE_EUR * fxMap[d]) / spyMap[d];
            lastMonth = m;
        }
        const curEUR = (spyShares * spyMap[d]) / fxMap[d];
        if (curEUR > peakEUR) peakEUR = curEUR;
        const dd = ((peakEUR - curEUR) / peakEUR) * 100;
        if (dd > maxDD) {
            maxDD = dd;
            maxDDDate = d;
        }
    }
    const lastD = tradingDays[tradingDays.length - 1];
    const finalEUR = (spyShares * spyMap[lastD]) / fxMap[lastD];
    return {
        name: 'Reiner S&P 500 Buy & Hold DCA',
        finalEUR,
        profit: finalEUR - investedEUR,
        ret: ((finalEUR - investedEUR) / investedEUR) * 100,
        maxDD,
        maxDDDate,
        triggerCount: 0
    };
})();

console.log('='.repeat(85));
console.log('   EMPIRISCHER TEST: 75% GOLD / 25% CASH IM NOTFALL-SCHUTZSCHILD (2004 - 2026)');
console.log('='.repeat(85));

const results = [
    buyAndHold,
    // Nur Trend Re-entry (ohne Panic Sniper)
    simulateShield('Trend-Shield: 50% Gold / 50% Cash (Nur SMA 200 Re-Entry)', 0.50, 0.50, false),
    simulateShield('Trend-Shield: 75% Gold / 25% Cash (Nur SMA 200 Re-Entry)', 0.75, 0.25, false),
    simulateShield('Trend-Shield: 100% Gold / 0% Cash (Nur SMA 200 Re-Entry)', 1.00, 0.00, false),
    // Mit Panic Sniper (VIX >= 35 Reversal + SMA 200)
    simulateShield('Trend-Shield + Panic-Sniper: 50% Gold / 50% Cash', 0.50, 0.50, true),
    simulateShield('Trend-Shield + Panic-Sniper: 75% Gold / 25% Cash', 0.75, 0.25, true),
    simulateShield('Trend-Shield + Panic-Sniper: 100% Gold / 0% Cash', 1.00, 0.00, true)
];

results.forEach(r => {
    console.log(`\n📌 ${r.name}`);
    console.log(`   * Depot-Endwert:      € ${r.finalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
    console.log(`   * Reingewinn:         +€ ${r.profit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${r.ret.toFixed(2)} %)`);
    console.log(`   * Maximaler Drawdown: -${r.maxDD.toFixed(2)} % (${r.maxDDDate})`);
});
