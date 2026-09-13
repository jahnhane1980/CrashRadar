import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { PortfolioStrategyEngine } from '../../../src/strategies/PortfolioStrategyEngine.js';
import { SatelliteStrategy } from '../../../src/strategies/SatelliteStrategy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function inspectTransitions() {
  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
  await fe.close();

  const engine = new PortfolioStrategyEngine();
  const satellite = new SatelliteStrategy();
  engine.registerStrategy(satellite);

  const transitions = [];
  let lastStatus = 'NORMAL_HODL';
  let crisisCycles = [];
  let currentCycle = null;

  const startIndex = Math.max(200, timeline.findIndex(t => t.date >= '2020-01-01'));
  console.log(`Starte Evaluation ab ${timeline[startIndex].date} (${timeline.length - startIndex} Handelstage)...`);

  for (let i = startIndex; i < timeline.length; i++) {
    const slice = timeline.slice(0, i + 1);
    const todayStr = slice[slice.length - 1].date;

    const evalRes = await engine.evaluateAll({
      date: todayStr,
      timeline: slice
    });

    const satRes = evalRes.strategyResults.SATELITE;

    if (satRes.status !== lastStatus) {
      transitions.push({
        date: todayStr,
        from: lastStatus,
        to: satRes.status,
        reason: satRes.reason
      });

      if (satRes.status === 'EMERGENCY_SHIELD') {
        currentCycle = { start: todayStr, shieldDays: 0, reEntryDate: null, returnToNormalDate: null };
      } else if (satRes.status === 'RE_ENTRY_RESET' && currentCycle) {
        currentCycle.reEntryDate = todayStr;
      } else if (satRes.status === 'NORMAL_HODL' && currentCycle && currentCycle.reEntryDate) {
        currentCycle.returnToNormalDate = todayStr;
        crisisCycles.push(currentCycle);
        currentCycle = null;
      }

      lastStatus = satRes.status;
    }
  }

  console.log(`Total Transitions: ${transitions.length}`);
  
  // Zähle Übergangstypen
  const typeCounts = {};
  for (const t of transitions) {
    const key = `${t.from} -> ${t.to}`;
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  }
  console.log('Transition Types:', JSON.stringify(typeCounts, null, 2));

  // Filtere nach Makro-Krisen (EMERGENCY_SHIELD)
  const emergencyEntries = transitions.filter(t => t.to === 'EMERGENCY_SHIELD');
  console.log(`\nAnzahl echter Krisen-Aktivierungen (EMERGENCY_SHIELD): ${emergencyEntries.length}`);

  console.log('\nAlle Makro-Krisen Phasen:');
  crisisCycles.forEach((c, idx) => {
    console.log(`  [Krise #${idx + 1}] Start: ${c.start} | Re-Entry: ${c.reEntryDate} | Normal: ${c.returnToNormalDate}`);
  });

  // BTC Airbag Transitions (BTC_HEDGE_CASH)
  const btcAirbagTransitions = transitions.filter(t => t.from === 'BTC_HEDGE_CASH' || t.to === 'BTC_HEDGE_CASH');
  console.log(`\nAnzahl BTC Airbag Umschaltungen (Option B): ${btcAirbagTransitions.length}`);
}

inspectTransitions().catch(console.error);
