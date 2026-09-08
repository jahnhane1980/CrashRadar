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

// Indicator Calculations
const spySma200 = {};
const gldSma20 = {};
const gldSma50 = {};

for (let i = 0; i < tradingDays.length; i++) {
    const d = tradingDays[i];
    if (i >= 199) {
        let sum = 0;
        for (let j = 0; j < 200; j++) sum += spyMap[tradingDays[i - j]];
        spySma200[d] = sum / 200;
    }
    if (i >= 19) {
        let sum = 0;
        for (let j = 0; j < 20; j++) sum += gldMap[tradingDays[i - j]];
        gldSma20[d] = sum / 20;
    }
    if (i >= 49) {
        let sum = 0;
        for (let j = 0; j < 50; j++) sum += gldMap[tradingDays[i - j]];
        gldSma50[d] = sum / 50;
    }
}

function simulateStrategy(name, hedgeLogicFn) {
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

    for (let i = 0; i < tradingDays.length; i++) {
        const d = tradingDays[i];
        const spyPrice = spyMap[d];
        const gldPrice = gldMap[d];
        const fx = fxMap[d];
        const vix = vixMap[d];
        const m = d.substring(0, 7);
        const s200 = spySma200[d];
        const g20 = gldSma20[d];
        const g50 = gldSma50[d];

        if (spyPrice > spyAth) spyAth = spyPrice;
        const spyDdFromAth = ((spyAth - spyPrice) / spyAth) * 100;

        // DCA
        if (m !== lastMonth) {
            investedEUR += MONTHLY_RATE_EUR;
            lastMonth = m;
            const addUSD = MONTHLY_RATE_EUR * fx;
            if (isHedged) {
                // Sparplan folgt aktuellem Hedge-Zustand
                const totalVal = (gldShares * gldPrice) + cashUSD;
                const gWeight = totalVal > 0 ? (gldShares * gldPrice) / totalVal : 0.75;
                gldShares += (addUSD * gWeight) / gldPrice;
                cashUSD += addUSD * (1 - gWeight);
            } else {
                spyShares += addUSD / spyPrice;
            }
        }

        // SPY Trend Trigger
        const shouldTriggerHedge = s200 && spyPrice < s200 && spyDdFromAth >= 8.0;
        const trendReclaim = s200 && spyPrice > s200;
        const panicSniper = vix >= 35 && (s200 ? spyPrice > s200 * 0.85 : true);
        const shouldReEnterSPY = trendReclaim || panicSniper;

        const ctx = {
            d, i, spyPrice, gldPrice, fx, vix, s200, g20, g50,
            spyAth, spyDdFromAth, isHedged,
            spyShares, gldShares, cashUSD
        };

        if (!isHedged && shouldTriggerHedge) {
            isHedged = true;
            const totalUSD = (spyShares * spyPrice) + (gldShares * gldPrice) + cashUSD;
            spyShares = 0;
            const alloc = hedgeLogicFn.onEnterHedge(ctx, totalUSD);
            gldShares = alloc.gldShares;
            cashUSD = alloc.cashUSD;
        } else if (isHedged && shouldReEnterSPY) {
            isHedged = false;
            const totalUSD = (gldShares * gldPrice) + cashUSD;
            gldShares = 0;
            cashUSD = 0;
            spyShares = totalUSD / spyPrice;
        } else if (isHedged) {
            // Tägliches Management im Hedge
            const updated = hedgeLogicFn.onManageHedge(ctx);
            gldShares = updated.gldShares;
            cashUSD = updated.cashUSD;
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
        maxDDDate
    };
}

// -----------------------------------------------------------------------------
// MODELL 1: Statisch 75% Gold / 25% Cash (Baseline)
// -----------------------------------------------------------------------------
const m1 = simulateStrategy('1. Statisch: 75% Gold / 25% Cash (Baseline)', {
    onEnterHedge: (ctx, totalUSD) => ({
        gldShares: (totalUSD * 0.75) / ctx.gldPrice,
        cashUSD: totalUSD * 0.25
    }),
    onManageHedge: (ctx) => ({
        gldShares: ctx.gldShares,
        cashUSD: ctx.cashUSD
    })
});

// -----------------------------------------------------------------------------
// MODELL 2: Gold-Indikator: Margin-Call-Airbag (Gold > SMA20 Filter)
// Wenn SPY fällt: Erst 100% Cash halten, bis Gold Stärke zeigt (Gold > SMA 20).
// Sobald Gold > SMA 20 dreht: Umschichten in 75% Gold / 25% Cash!
// -----------------------------------------------------------------------------
const m2 = simulateStrategy('2. Gold-Indikator: Margin-Call Airbag (Warte auf Gold > SMA 20)', {
    onEnterHedge: (ctx, totalUSD) => {
        const isGoldStrong = ctx.g20 && ctx.gldPrice > ctx.g20;
        if (isGoldStrong) {
            return {
                gldShares: (totalUSD * 0.75) / ctx.gldPrice,
                cashUSD: totalUSD * 0.25
            };
        } else {
            // Im Margin-Call-Dip: Erst 100% Cash als Puffer!
            return {
                gldShares: 0,
                cashUSD: totalUSD
            };
        }
    },
    onManageHedge: (ctx) => {
        const totalUSD = (ctx.gldShares * ctx.gldPrice) + ctx.cashUSD;
        const isGoldStrong = ctx.g20 && ctx.gldPrice > ctx.g20;
        if (ctx.gldShares === 0 && isGoldStrong) {
            // Gold beendet Margin-Call-Sog und dreht nach oben: Einstieg in Gold!
            return {
                gldShares: (totalUSD * 0.75) / ctx.gldPrice,
                cashUSD: totalUSD * 0.25
            };
        }
        return {
            gldShares: ctx.gldShares,
            cashUSD: ctx.cashUSD
        };
    }
});

// -----------------------------------------------------------------------------
// MODELL 3: Vollständige Gold-Indikatoren (SMA 20 Einstieg + Schallmauer +10% SMA 50 Exit)
// - Startet in Cash falls Gold schwach (Margin-Call-Schutz)
// - Kauft 75% Gold wenn Gold > SMA 20
// - Skimmt 20% in Cash wenn Gold > 10% über SMA 50 (Schallmauer)
// - Catastrophe-Stop: Wenn Gold > 10% unter SMA 50 fällt -> temporär in Cash
// -----------------------------------------------------------------------------
const m3 = simulateStrategy('3. Vollständige Gold-Indikatoren (Trend + Schallmauer + Catastrophe Stop)', {
    onEnterHedge: (ctx, totalUSD) => {
        const isGoldStrong = ctx.g20 && ctx.gldPrice > ctx.g20;
        if (isGoldStrong) {
            return {
                gldShares: (totalUSD * 0.75) / ctx.gldPrice,
                cashUSD: totalUSD * 0.25
            };
        } else {
            return {
                gldShares: 0,
                cashUSD: totalUSD
            };
        }
    },
    onManageHedge: (ctx) => {
        let currentGoldUSD = ctx.gldShares * ctx.gldPrice;
        let currentCash = ctx.cashUSD;
        let totalUSD = currentGoldUSD + currentCash;

        // 1. Einstieg in Gold wenn Stärke bestätigt
        if (ctx.gldShares === 0 && ctx.g20 && ctx.gldPrice > ctx.g20) {
            return {
                gldShares: (totalUSD * 0.75) / ctx.gldPrice,
                cashUSD: totalUSD * 0.25
            };
        }

        // 2. Schallmauer-Skimming: Gold > 10% über SMA 50
        if (ctx.gldShares > 0 && ctx.g50 && (ctx.gldPrice - ctx.g50) / ctx.g50 > 0.10) {
            // Reduziere Gold-Gewicht auf 50% (Gewinnmitnahme)
            const targetGold = totalUSD * 0.50;
            if (currentGoldUSD > targetGold) {
                const diff = currentGoldUSD - targetGold;
                currentGoldUSD -= diff;
                currentCash += diff;
            }
        }

        // 3. Catastrophe Stop: Gold fällt > 10% unter SMA 50
        if (ctx.gldShares > 0 && ctx.g50 && (ctx.gldPrice - ctx.g50) / ctx.g50 < -0.10) {
            // Notfall-Rückzug in Cash
            currentCash += currentGoldUSD;
            currentGoldUSD = 0;
        }

        return {
            gldShares: currentGoldUSD / ctx.gldPrice,
            cashUSD: currentCash
        };
    }
});

// -----------------------------------------------------------------------------
// MODELL 4: Dynamischer 100% Gold-Turbo mit Margin-Call-Airbag
// Startet in Cash bei Margin-Call; geht zu 100% in Gold wenn Gold > SMA 20!
// -----------------------------------------------------------------------------
const m4 = simulateStrategy('4. Gold-Indikator: 100% Gold-Turbo (aber erst NACH Margin-Call-Boden)', {
    onEnterHedge: (ctx, totalUSD) => {
        const isGoldStrong = ctx.g20 && ctx.gldPrice > ctx.g20;
        if (isGoldStrong) {
            return {
                gldShares: totalUSD / ctx.gldPrice,
                cashUSD: 0
            };
        } else {
            return {
                gldShares: 0,
                cashUSD: totalUSD
            };
        }
    },
    onManageHedge: (ctx) => {
        const totalUSD = (ctx.gldShares * ctx.gldPrice) + ctx.cashUSD;
        if (ctx.gldShares === 0 && ctx.g20 && ctx.gldPrice > ctx.g20) {
            return {
                gldShares: totalUSD / ctx.gldPrice,
                cashUSD: 0
            };
        }
        return {
            gldShares: ctx.gldShares,
            cashUSD: ctx.cashUSD
        };
    }
});

console.log('='.repeat(85));
console.log('   EMPIRISCHER VERGLEICH: WAS BRINGEN DIE SPEZIELLEN GOLD-INDIKATOREN?');
console.log('='.repeat(85));

[m1, m2, m3, m4].forEach(r => {
    console.log(`\n📌 ${r.name}`);
    console.log(`   * Depot-Endwert:      € ${r.finalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
    console.log(`   * Reingewinn:         +€ ${r.profit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${r.ret.toFixed(2)} %)`);
    console.log(`   * Maximaler Drawdown: -${r.maxDD.toFixed(2)} % (${r.maxDDDate})`);
});
