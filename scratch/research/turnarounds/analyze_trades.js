import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRADES_FILE = path.join(__dirname, 'data_cache', 'simulation_trades.json');
const trades = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));

console.log('================================================================================');
console.log(`ANALYSIS OF TURNAROUND SIMULATION TRADES (${trades.length} TOTAL TRADES)`);
console.log('================================================================================\n');

const byCategory = {};
const byTicker = {};
const byYear = {};

for (const t of trades) {
    // category
    byCategory[t.category] = byCategory[t.category] || { count: 0, wins: 0, gain: 0, losses: 0, lossVal: 0, winVal: 0 };
    byCategory[t.category].count++;
    byCategory[t.category].gain += t.pnlPct;
    if (t.pnlPct > 0) {
        byCategory[t.category].wins++;
        byCategory[t.category].winVal += t.pnlPct;
    } else {
        byCategory[t.category].losses++;
        byCategory[t.category].lossVal += t.pnlPct;
    }

    // ticker
    byTicker[t.ticker] = byTicker[t.ticker] || { count: 0, wins: 0, gain: 0, winVal: 0, lossVal: 0, trades: [] };
    byTicker[t.ticker].count++;
    byTicker[t.ticker].gain += t.pnlPct;
    if (t.pnlPct > 0) {
        byTicker[t.ticker].wins++;
        byTicker[t.ticker].winVal += t.pnlPct;
    } else {
        byTicker[t.ticker].lossVal += t.pnlPct;
    }
    byTicker[t.ticker].trades.push(t);

    // year
    const yr = t.entryDate.split('-')[0];
    byYear[yr] = byYear[yr] || { count: 0, wins: 0, gain: 0, winVal: 0, lossVal: 0 };
    byYear[yr].count++;
    byYear[yr].gain += t.pnlPct;
    if (t.pnlPct > 0) {
        byYear[yr].wins++;
        byYear[yr].winVal += t.pnlPct;
    } else {
        byYear[yr].lossVal += t.pnlPct;
    }
}

console.log('--- 1. PERFORMANCE BY CATEGORY ---');
for (const [cat, s] of Object.entries(byCategory)) {
    const avg = s.gain / s.count;
    const wr = (s.wins / s.count) * 100;
    const pf = Math.abs(s.lossVal) > 0 ? (s.winVal / Math.abs(s.lossVal)).toFixed(2) : 'INF';
    console.log(`${cat.padEnd(20)}: ${s.count} Trades | Win: ${wr.toFixed(1)}% | Avg PnL: ${avg >= 0 ? '+' : ''}${avg.toFixed(1)}% | Profit Factor: ${pf}`);
}

console.log('\n--- 2. PERFORMANCE BY TICKER ---');
for (const [sym, s] of Object.entries(byTicker)) {
    const avg = s.gain / s.count;
    const wr = (s.wins / s.count) * 100;
    const pf = Math.abs(s.lossVal) > 0 ? (s.winVal / Math.abs(s.lossVal)).toFixed(2) : 'INF';
    console.log(`${sym.padEnd(6)}: ${String(s.count).padStart(2)} Trades | Win: ${wr.toFixed(1).padStart(5)}% | Avg PnL: ${(avg >= 0 ? '+' : '') + avg.toFixed(1).padStart(5)}% | PF: ${pf.padStart(5)}`);
}

console.log('\n--- 3. PERFORMANCE BY ENTRY YEAR ---');
for (const [yr, s] of Object.entries(byYear).sort()) {
    const avg = s.gain / s.count;
    const wr = (s.wins / s.count) * 100;
    const pf = Math.abs(s.lossVal) > 0 ? (s.winVal / Math.abs(s.lossVal)).toFixed(2) : 'INF';
    console.log(`${yr}: ${String(s.count).padStart(2)} Trades | Win: ${wr.toFixed(1).padStart(5)}% | Avg PnL: ${(avg >= 0 ? '+' : '') + avg.toFixed(1).padStart(5)}% | PF: ${pf.padStart(5)}`);
}

console.log('\n--- 4. TOP 5 WINNERS & LOSERS ---');
const sorted = [...trades].sort((a, b) => b.pnlPct - a.pnlPct);
console.log('Top 5 Winners:');
for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const t = sorted[i];
    console.log(`  +${t.pnlPct.toFixed(1)}% | ${t.ticker} (${t.entryDate} -> ${t.exitDate}, ${t.holdingDays}d) [${t.reason}]`);
}
console.log('\nWorst 5 Losers:');
for (let i = sorted.length - 1; i >= Math.max(0, sorted.length - 5); i--) {
    const t = sorted[i];
    console.log(`  ${t.pnlPct.toFixed(1)}% | ${t.ticker} (${t.entryDate} -> ${t.exitDate}, ${t.holdingDays}d) [${t.reason}]`);
}
