import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(REPO_ROOT, 'data/cache/turnarounds');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));
const macroMatrix = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'macro_regime_daily.json'), 'utf8'));

// Calculate SMA 200
const sma200 = [];
for (let i = 0; i < quotes.length; i++) {
    if (i < 199) sma200.push(null);
    else {
        let s = 0;
        for (let j = 0; j < 200; j++) s += quotes[i - j].close;
        sma200.push(s / 200);
    }
}

console.log("================================================================================");
console.log("   HÄRTETEST: MAKRO-KRISE (isCrisisHedged) + SMA 200 BRUCH (NOW 2018-2026)");
console.log("================================================================================\n");

const startIdx = quotes.findIndex(q => q.date >= '2018-01-02');
const startPrice = quotes[startIdx].close;
const initialCapital = 10000;

const bnH_shares = initialCapital / startPrice;
const finalPrice = quotes[quotes.length - 1].close;
const bnH_finalValue = bnH_shares * finalPrice;

let s_shares = initialCapital / startPrice;
let s_cash = 0;
let isDeRisked = false;
let sellPrice = 0;

const trades = [];

for (let i = startIdx; i < quotes.length; i++) {
    const q = quotes[i];
    const s200 = sma200[i];
    const m = macroMatrix[q.date];

    const isCrisis = m ? m.isCrisisHedged === true : false;

    if (s_cash > 0) {
        s_cash *= (1 + 0.03 / 252);
    }

    // Sell 50% when Macro is in Crisis AND Stock is under SMA 200
    if (!isDeRisked && isCrisis && s200 && q.close < s200) {
        const sharesToSell = s_shares * 0.50;
        const proceeds = sharesToSell * q.close;
        s_shares -= sharesToSell;
        s_cash += proceeds;
        isDeRisked = true;
        sellPrice = q.close;

        trades.push({
            date: q.date,
            action: 'CRISIS_SKIM_50%',
            price: q.close.toFixed(2),
            proceeds: proceeds.toFixed(2),
            remainingShares: s_shares.toFixed(2),
            cash: s_cash.toFixed(2)
        });
    }

    // Re-entry when Crisis ends OR stock reclaims SMA 200 OR deep panic discount
    if (isDeRisked && s_cash > 0) {
        const crisisEnded = m ? m.isCrisisHedged === false : true;
        const reclaimedSMA = s200 && q.close > s200;
        const deepDiscount = q.close < sellPrice * 0.70;

        if (crisisEnded || reclaimedSMA || deepDiscount) {
            const sharesBought = s_cash / q.close;
            s_shares += sharesBought;

            trades.push({
                date: q.date,
                action: 'CRISIS_REENTRY',
                price: q.close.toFixed(2),
                sharesBought: sharesBought.toFixed(2),
                totalShares: s_shares.toFixed(2),
                cashSpent: s_cash.toFixed(2),
                discountVsSellPrice: (((q.close - sellPrice) / sellPrice) * 100).toFixed(1) + '%'
            });

            s_cash = 0;
            isDeRisked = false;
        }
    }
}

const finalValue = s_shares * finalPrice + s_cash;

console.log("TRADE LOG:");
console.table(trades);

console.log("\n--------------------------------------------------------------------------------");
console.log(`ERGEBNIS-VERGLEICH:`);
console.log(`1. PURE BUY & HOLD:`);
console.log(`   Endbestand: ${bnH_shares.toFixed(2)} Aktien | Endwert: $${bnH_finalValue.toFixed(2)} (+${(((bnH_finalValue - initialCapital) / initialCapital) * 100).toFixed(1)}%)`);
console.log(`2. MAKRO-KRISE TEILVERKAUF (50%) & RE-ENTRY:`);
console.log(`   Endbestand: ${s_shares.toFixed(2)} Aktien (${(((s_shares - bnH_shares) / bnH_shares) * 100).toFixed(1)}% mehr Aktien!)`);
console.log(`   Endwert:    $${finalValue.toFixed(2)} (+${(((finalValue - initialCapital) / initialCapital) * 100).toFixed(1)}%)`);
console.log(`   MEHRWERT:   +$${(finalValue - bnH_finalValue).toFixed(2)} (${(((finalValue - bnH_finalValue) / bnH_finalValue) * 100).toFixed(1)}%)`);
console.log("--------------------------------------------------------------------------------");
