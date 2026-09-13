import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Trading212Runner } from '../../src/runners/Trading212Runner.js';
import { NtfyService } from '../../src/services/NtfyService.js';
import { Logger } from '../../src/core/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const SNAPSHOT_PATH = path.join(ROOT_DIR, 'data/trading212_portfolio_snapshot.json');

// Parse CLI Flags
const args = process.argv.slice(2);
const shouldSendNtfy = args.includes('--send-ntfy');
const scenarioArg = args.find((a) => a.startsWith('--scenario='))?.split('=')[1] || 'all';

if (!fs.existsSync(SNAPSHOT_PATH)) {
  console.error('Snapshot-Datei nicht gefunden:', SNAPSHOT_PATH);
  process.exit(1);
}

const previousSnapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));

console.log('\n================================================================');
console.log('   SIMULATION: TRADING 212 TRADE EXECUTION & ALERT');
console.log('================================================================');
console.log(`Basis-Snapshot: ${previousSnapshot.positionsCount} Positionen, Cash: ${previousSnapshot.cashPct.toFixed(1)} %`);
console.log(`Offene Orders: ${previousSnapshot.pendingOrders?.length || 0}`);

/**
 * Wir simulieren eine realistische Trading-Aktivität:
 * 1. Limit-Order SentinelOne ("S") über 200 Stk. @ 18.80 USD wurde ausgeführt!
 *    - Order aus pendingOrders entfernt
 *    - Position "S" von 187.5 Stk. auf 387.5 Stk. erhöht (+200 Stk.)
 *    - Gewichtung steigt von 3.58 % auf ~7.20 %
 * 2. Teilgewinnmitnahme bei AIRO:
 *    - 600 Stk. verkauft (2600 Stk. -> 2000 Stk.)
 *    - Gewichtung sinkt von 17.89 % auf ~13.76 %
 * 3. Neukauf einer kleinen Einstiegsposition (z.B. PLTR):
 *    - 50 Stk. @ 145 USD neu im Portfolio (+4.5 % Gewicht)
 * 4. Eine alte Limit-Order gelöscht (PGY)
 * 5. Eine neue Limit-Order platziert (NVTS @ 10.50 USD)
 */
const simulatedCurrent = JSON.parse(JSON.stringify(previousSnapshot));
simulatedCurrent.timestamp = new Date().toISOString();

// 1. Limit-Order "S" ausgeführt:
const sOrderIndex = simulatedCurrent.pendingOrders.findIndex((o) => o.ticker === 'S');
if (sOrderIndex !== -1) {
  simulatedCurrent.pendingOrders.splice(sOrderIndex, 1);
}
const sPos = simulatedCurrent.positions.find((p) => p.ticker === 'S');
if (sPos) {
  sPos.quantity = 387.5;
  sPos.weightPct = 7.20;
}

// 2. Teilverkauf AIRO
const airoPos = simulatedCurrent.positions.find((p) => p.ticker === 'AIRO');
if (airoPos) {
  airoPos.quantity = 2000;
  airoPos.weightPct = 13.76;
}

// 3. Neukauf PLTR
simulatedCurrent.positions.push({
  ticker: 'PLTR',
  rawTicker: 'PLTR_US_EQ',
  quantity: 50,
  averagePrice: 145.0,
  currentPrice: 145.0,
  weightPct: 4.50,
  pnlPct: 0.0,
});
simulatedCurrent.positionsCount = simulatedCurrent.positions.length;

// 4. Limit-Order PGY gelöscht
const pgyOrderIndex = simulatedCurrent.pendingOrders.findIndex((o) => o.ticker === 'PGY');
if (pgyOrderIndex !== -1) {
  simulatedCurrent.pendingOrders.splice(pgyOrderIndex, 1);
}

// 5. Neue Limit-Order NVTS erstellt
simulatedCurrent.pendingOrders.push({
  id: 58999999999,
  ticker: 'NVTS',
  rawTicker: 'LOKB_US_EQ',
  side: 'BUY',
  type: 'LIMIT',
  quantity: 150,
  limitPrice: 10.50,
  currency: 'USD',
  status: 'NEW',
  targetWeightPct: 1.45,
});
simulatedCurrent.pendingOrdersCount = simulatedCurrent.pendingOrders.length;

// Cash-Anpassung
simulatedCurrent.cashPct = 9.20;
simulatedCurrent.freeCashPct = 6.80;
simulatedCurrent.blockedCashPct = 2.40;
simulatedCurrent.investedPct = 90.80;

// Runner initialisieren
const runner = new Trading212Runner({ mode: 'trades' });
const deltas = runner.detectDeltas(previousSnapshot, simulatedCurrent);

console.log('\n--- DETEKTIERTE DELTAS ---');
console.log(`HasChanges: ${deltas.hasChanges}`);
console.log(`Neukäufe (added): ${deltas.added.map((a) => `${a.ticker} (${a.quantity} Stk.)`).join(', ') || 'keine'}`);
console.log(`Modifiziert (modified): ${deltas.modified.map((m) => `${m.type} ${m.ticker} (${m.qtyDiff} Stk.)`).join(', ') || 'keine'}`);
console.log(`Verkäufe (removed): ${deltas.removed.map((r) => r.ticker).join(', ') || 'keine'}`);
console.log(`Orders hinzugefügt: ${deltas.ordersAdded.map((o) => `${o.ticker} (${o.quantity} @ ${o.limitPrice})`).join(', ') || 'keine'}`);
console.log(`Orders entfernt: ${deltas.ordersRemoved.map((o) => `${o.ticker} (${o.quantity} @ ${o.limitPrice})`).join(', ') || 'keine'}`);
console.log(`Cash-Delta: ${deltas.cashDeltaPct > 0 ? '+' : ''}${deltas.cashDeltaPct} %`);

const report = runner.formatTradesReport(simulatedCurrent, deltas);

console.log('\n--- GENERIERTE NTFY-NACHRICHT (MARKDOWN) ---\n');
console.log(report);
console.log('--------------------------------------------\n');

if (shouldSendNtfy) {
  const topic = process.env.NTFY_PORTFOLIO_TOPIC || 'JahnsPortfolio-baLvp3m0KdnYQdAC';
  console.log(`Sende simulierten Alert an Ntfy Topic: ${topic}...`);
  const ntfy = new NtfyService(topic);
  await ntfy.send(
    'Kamikaze Transaktions-Alert (SIMULATION)',
    report,
    'high',
    'bell,chart_with_upwards_trend'
  );
  console.log('Simulation erfolgreich an Ntfy übertragen! Bitte Smartphone prüfen.');
} else {
  console.log('Tipp: Führe das Skript mit "--send-ntfy" aus, um den Alert live an dein Handy zu senden.');
}
