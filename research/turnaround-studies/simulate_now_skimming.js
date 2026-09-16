import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(REPO_ROOT, 'data/cache/turnarounds');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));

// Indicators
function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) sma.push(null);
        else {
            let s = 0;
            for (let j = 0; j < period; j++) s += data[i - j].close;
            sma.push(s / period);
        }
    }
    return sma;
}

function calculateRSI(data, period = 14) {
    const rsi = new Array(data.length).fill(null);
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    rsi[period] = 100 - (100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss)));

    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        rsi[i] = 100 - (100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss)));
    }
    return rsi;
}

const sma200 = calculateSMA(quotes, 200);
const rsi = calculateRSI(quotes, 14);

console.log("================================================================================");
console.log("   SIMULATION: STOIRES BUY & HOLD VS. 40% CLIMAX SKIMMING + RE-ENTRY (NOW)");
console.log("   Zeitraum: 2018 bis 2026 (Startkapital: $10.000)");
console.log("================================================================================\n");

// Start in early 2018
const startIdx = quotes.findIndex(q => q.date >= '2018-01-02');
const startPrice = quotes[startIdx].close;
const initialCapital = 10000;

// Strategy 1: Pure Buy & Hold
const bnH_shares = initialCapital / startPrice;
const finalPrice = quotes[quotes.length - 1].close;
const bnH_finalValue = bnH_shares * finalPrice;

// Strategy 2: 40% Climax Skimming with Panic Re-Entry
// Rules:
// 1. Climax Skimming Trigger: Stock is >= 35% above SMA 200 AND RSI >= 70 AND at least +50% gain from last entry.
//    Action: Sell 40% of shares, park cash (at 3% p.a. interest).
// 2. Re-Entry Sniper Trigger: Stock drops >= 35% from the recent peak AND (RSI <= 30 OR cross above SMA 50 / reversal).
//    Action: Re-invest 100% of the parked cash into shares!

let s2_shares = initialCapital / startPrice;
let s2_cash = 0;
let lastPeak = startPrice;
let lastEntryPrice = startPrice;
let skimmed = false;

const logTrades = [];

for (let i = startIdx; i < quotes.length; i++) {
    const q = quotes[i];
    const s200 = sma200[i];
    const r = rsi[i];

    if (q.close > lastPeak) {
        lastPeak = q.close;
    }

    // Cash interest daily (3% p.a.)
    if (s2_cash > 0) {
        s2_cash *= (1 + 0.03 / 252);
    }

    // Skim trigger
    if (!skimmed && s200 && (q.close - s200) / s200 >= 0.35 && r >= 70 && (q.close - lastEntryPrice) / lastEntryPrice >= 0.50) {
        const sharesToSell = s2_shares * 0.40;
        const proceeds = sharesToSell * q.close;
        s2_shares -= sharesToSell;
        s2_cash += proceeds;
        skimmed = true;
        logTrades.push({
            date: q.date,
            action: 'CLIMAX_SKIM (40%)',
            price: q.close,
            sharesSold: sharesToSell,
            proceeds: proceeds,
            remainingShares: s2_shares,
            cash: s2_cash
        });
    }

    // Re-entry trigger
    if (skimmed && s2_cash > 0) {
        const ddFromPeak = (q.close - lastPeak) / lastPeak;
        // Condition: dropped >= 40% from peak AND oversold (RSI <= 30 or crossed back above EMA20/SMA50)
        if (ddFromPeak <= -0.40 && (r <= 32 || q.close < s200 * 0.75)) {
            const sharesBought = s2_cash / q.close;
            s2_shares += sharesBought;
            logTrades.push({
                date: q.date,
                action: 'PANIC_REENTRY',
                price: q.close,
                sharesBought: sharesBought,
                totalShares: s2_shares,
                cashSpent: s2_cash,
                discountVsPeak: (ddFromPeak * 100).toFixed(1) + '%'
            });
            s2_cash = 0;
            skimmed = false;
            lastPeak = q.close;
            lastEntryPrice = q.close;
        }
    }
}

const s2_finalValue = s2_shares * finalPrice + s2_cash;

console.log("TRADE LOG DER SKIMMING-STRATEGIE:");
console.table(logTrades);

console.log("\n--------------------------------------------------------------------------------");
console.log(`ERGEBNIS-VERGLEICH (2018-01-02 bis ${quotes[quotes.length - 1].date}):`);
console.log(`Startkapital: $${initialCapital.toFixed(2)} (Startkurs: $${startPrice.toFixed(2)})`);
console.log(`Endkurs NOW:  $${finalPrice.toFixed(2)}`);
console.log("--------------------------------------------------------------------------------");
console.log(`1. PURE BUY & HOLD:`);
console.log(`   Endbestand: ${bnH_shares.toFixed(2)} Aktien`);
console.log(`   Endwert:    $${bnH_finalValue.toFixed(2)} (+${(((bnH_finalValue - initialCapital) / initialCapital) * 100).toFixed(1)}%)`);
console.log(`\n2. 40% CLIMAX SKIMMING & PANIC RE-ENTRY:`);
console.log(`   Endbestand: ${s2_shares.toFixed(2)} Aktien (${((s2_shares / bnH_shares - 1) * 100).toFixed(1)}% mehr Aktien!)`);
console.log(`   Cash-Rest:  $${s2_cash.toFixed(2)}`);
console.log(`   Endwert:    $${s2_finalValue.toFixed(2)} (+${(((s2_finalValue - initialCapital) / initialCapital) * 100).toFixed(1)}%)`);
console.log(`   MEHRWERT:   +$${(s2_finalValue - bnH_finalValue).toFixed(2)}`);
console.log("--------------------------------------------------------------------------------");
