import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, 'data_cache');
const baseTrades = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'simulation_trades_baseline.json'), 'utf8'));
const macroTrades = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'simulation_trades_with_macro.json'), 'utf8'));
const macroMatrix = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'macro_regime_daily.json'), 'utf8'));

console.log('================================================================================');
console.log('   DETAIL-ANALYSE: WELCHE EINSTIEGE WURDEN DURCH DEN MAKRO-FILTER VERHINDERT?');
console.log('================================================================================\n');

// Find trades present in Baseline but NOT in MacroTrades (or shifted)
const macroKeySet = new Set(macroTrades.map(t => `${t.ticker}_${t.entryDate}`));

const eliminatedTrades = [];
for (const bt of baseTrades) {
    const key = `${bt.ticker}_${bt.entryDate}`;
    if (!macroKeySet.has(key)) {
        eliminatedTrades.push(bt);
    }
}

console.log(`📌 Es wurden insgesamt ${eliminatedTrades.length} Einstiege durch die Makro-Sperre verhindert:\n`);

let totalEliminatedPnL = 0;
let winCount = 0;
let lossCount = 0;

for (const t of eliminatedTrades) {
    totalEliminatedPnL += t.pnlPct;
    if (t.pnlPct > 0) winCount++;
    else lossCount++;
    const crisisInfo = macroMatrix[t.entryDate];
    console.log(`❌ BLOCKIERT: ${t.ticker.padEnd(5)} am ${t.entryDate} ($${t.entryPrice.toFixed(2)})`);
    console.log(`   • Hätte erzielt:     ${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(1)} % (${t.holdingDays} Tage gehalten)`);
    console.log(`   • Ausstiegsgrund:    ${t.reason}`);
    console.log(`   • Makro-Zustand:     VIX: ${crisisInfo?.vix ?? 'N/A'}, SPY DD: -${crisisInfo?.spyDdFromAth ?? 'N/A'}%, NetLiq: ${crisisInfo?.netLiqDelta ?? 'N/A'}%\n`);
}

console.log('--------------------------------------------------------------------------------');
console.log(`📊 Bilanz der verhinderten Einstiege:`);
console.log(`   • Verhindert:       ${eliminatedTrades.length} Trades (${winCount} Gewinner / ${lossCount} Verlierer)`);
console.log(`   • Durchschnitts-PnL der verhinderten Trades: ${(totalEliminatedPnL / eliminatedTrades.length).toFixed(1)} %`);
console.log('--------------------------------------------------------------------------------\n');

// Also check if any trades were shifted to a later date
console.log('📌 Verschobene / Neue Einstiege mit Makrosperre (später eingestiegen):');
const baseKeySet = new Set(baseTrades.map(t => `${t.ticker}_${t.entryDate}`));
for (const mt of macroTrades) {
    const key = `${mt.ticker}_${mt.entryDate}`;
    if (!baseKeySet.has(key)) {
        console.log(`✨ NEUER / VERSCHOBENER EINSTIEG: ${mt.ticker.padEnd(5)} am ${mt.entryDate} -> PnL: ${mt.pnlPct >= 0 ? '+' : ''}${mt.pnlPct.toFixed(1)}%`);
    }
}
