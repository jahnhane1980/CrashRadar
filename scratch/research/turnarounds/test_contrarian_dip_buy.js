import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));

// Calculate RSI 14
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

const rsi = calculateRSI(quotes, 14);

console.log("================================================================================");
console.log("   BEWEIS: STOISCHES BUY & HOLD VS. CONTRARIAN DIP-BUY AM PANIK-TIEF (NOW)");
console.log("   Testet: Niemals Verkaufen + Zündfunken-Nachkauf bei Wall-Street-Panik");
console.log("================================================================================\n");

const startIdx = quotes.findIndex(q => q.date >= '2018-01-02');
const startPrice = quotes[startIdx].close;
const initialCapital = 10000;
const finalPrice = quotes[quotes.length - 1].close;

// Strategy 1: Pure Buy & Hold ($10.000)
const bnH_shares = initialCapital / startPrice;
const bnH_finalValue = bnH_shares * finalPrice;

// Strategy 2: Buy & Hold + 2x Dip Buys ($3.500 Zündfunken aus Mutterschiff)
// Trigger: Drawdown >= 40% vom Allzeithoch UND RSI <= 28
let s2_shares = initialCapital / startPrice;
let investedCapital = initialCapital;
let peak = startPrice;
let lastDipBuyYear = 0;

const dipTrades = [];

for (let i = startIdx; i < quotes.length; i++) {
    const q = quotes[i];
    const r = rsi[i];
    const year = parseInt(q.date.substring(0, 4));

    if (q.close > peak) {
        peak = q.close;
    }

    const ddFromPeak = (q.close - peak) / peak;

    // Trigger: -40% oder tiefer UND RSI überverkauft (< 28) UND max 1x pro Kalenderjahr
    if (ddFromPeak <= -0.40 && r && r <= 28 && year !== lastDipBuyYear) {
        const injection = 3500;
        const sharesBought = injection / q.close;
        s2_shares += sharesBought;
        investedCapital += injection;
        lastDipBuyYear = year;

        dipTrades.push({
            date: q.date,
            action: 'MUTTERSCHIFF_ZÜNDFUNKE_DIP_BUY',
            price: q.close.toFixed(2),
            ddFromPeak: (ddFromPeak * 100).toFixed(1) + '%',
            rsi: r.toFixed(1),
            capitalInjected: `$${injection}`,
            sharesBought: sharesBought.toFixed(2),
            totalShares: s2_shares.toFixed(2)
        });
    }
}

const s2_finalValue = s2_shares * finalPrice;
const bnH_adjustedValue = (bnH_shares * finalPrice) + (investedCapital - initialCapital); // Vergleiche mit gleichem Geldeinsatz

console.log("DIP-BUY LOG:");
console.table(dipTrades);

console.log("\n--------------------------------------------------------------------------------");
console.log(`ERGEBNIS-VERGLEICH:`);
console.log(`1. PURE BUY & HOLD (mit ungenutztem Cash):`);
console.log(`   Investiert: $${investedCapital.toFixed(2)} | Endwert: $${bnH_adjustedValue.toFixed(2)}`);
console.log(`2. DIAMANTEN-STRATEGIE (Niemals Verkaufen + Zündfunke am Panik-Tief):`);
console.log(`   Investiert: $${investedCapital.toFixed(2)} | Endbestand: ${s2_shares.toFixed(2)} Aktien`);
console.log(`   Endwert:    $${s2_finalValue.toFixed(2)} (+${(((s2_finalValue - investedCapital) / investedCapital) * 100).toFixed(1)}%)`);
console.log(`   MEHRWERT:   +$${(s2_finalValue - bnH_adjustedValue).toFixed(2)} (+${(((s2_finalValue - bnH_adjustedValue) / bnH_adjustedValue) * 100).toFixed(1)}%)`);
console.log("--------------------------------------------------------------------------------");
