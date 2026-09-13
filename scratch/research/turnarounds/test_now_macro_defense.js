import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');

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
console.log("   HÄRTETEST: MAKRO-ROT + SMA 200 BRUCH VS. PURE BUY & HOLD (NOW 2018-2026)");
console.log("   Kann der systemische Makro-Filter das 'Vorzeitige Rausfliegen' verhindern?");
console.log("================================================================================\n");

const startIdx = quotes.findIndex(q => q.date >= '2018-01-02');
const startPrice = quotes[startIdx].close;
const initialCapital = 10000;

const bnH_shares = initialCapital / startPrice;
const finalPrice = quotes[quotes.length - 1].close;
const bnH_finalValue = bnH_shares * finalPrice;

// Macro-Aware Skim Strategy:
// Rule:
// Sell 40% ONLY IF:
//   Macro Regime is RED (net_liquidity_delta_8w < -0.05 OR credit_spreads > 4.0 OR composite_state === 'CRITICAL' / 'BEAR')
//   AND Stock closes BELOW SMA 200!
// Re-entry:
//   When Macro turns GREEN (or VIX >= 35 panic capitulation) AND Stock reclaims SMA 50 or AVWAP from low.

let s_shares = initialCapital / startPrice;
let s_cash = 0;
let isDeRisked = false;
let sellPrice = 0;

const trades = [];

for (let i = startIdx; i < quotes.length; i++) {
    const q = quotes[i];
    const s200 = sma200[i];
    const m = macroMatrix[q.date];

    const isMacroRed = m ? (m.regime === 'RED' || m.net_liq_8w_delta < -0.05 || m.stress_level === 'CRITICAL' || m.macro_veto === true) : false;

    if (s_cash > 0) {
        s_cash *= (1 + 0.03 / 252);
    }

    // Sell 40%
    if (!isDeRisked && isMacroRed && s200 && q.close < s200) {
        const sharesToSell = s_shares * 0.40;
        const proceeds = sharesToSell * q.close;
        s_shares -= sharesToSell;
        s_cash += proceeds;
        isDeRisked = true;
        sellPrice = q.close;

        trades.push({
            date: q.date,
            action: 'MACRO_DEFENSE_SELL_40%',
            price: q.close,
            proceeds: proceeds,
            remainingShares: s_shares,
            macroReason: `Macro RED + Close < SMA200 ($${s200.toFixed(2)})`
        });
    }

    // Re-entry
    if (isDeRisked && s_cash > 0) {
        const isMacroGreen = m ? (m.regime === 'GREEN' || m.net_liq_8w_delta >= 0) : true;
        const isPanicCapitulation = m ? (m.vix_spike || m.panic_reentry) : false;

        // Re-enter when macro clears or panic capitulation occurs and stock is discounted vs sell price
        if ((isMacroGreen || isPanicCapitulation) && (q.close < sellPrice * 0.85 || q.close > s200)) {
            const sharesBought = s_cash / q.close;
            s_shares += sharesBought;

            trades.push({
                date: q.date,
                action: 'MACRO_REENTRY_BUY',
                price: q.close,
                sharesBought: sharesBought,
                totalShares: s_shares,
                cashSpent: s_cash,
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
console.log(`2. MAKRO-GESCHÜTZTES SKIMMING:`);
console.log(`   Endbestand: ${s_shares.toFixed(2)} Aktien | Endwert: $${finalValue.toFixed(2)} (+${(((finalValue - initialCapital) / initialCapital) * 100).toFixed(1)}%)`);
console.log(`   MEHRWERT:   +$${(finalValue - bnH_finalValue).toFixed(2)} (${(((finalValue - bnH_finalValue) / bnH_finalValue) * 100).toFixed(1)}%)`);
console.log("--------------------------------------------------------------------------------");
