import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { GoldilocksSensorHub } from '../../src/signals/hubs/GoldilocksSensorHub.js';

dotenv.config();

async function checkLiveGoldilocks() {
  console.log('================================================================================');
  console.log('   LIVE EVALUATION: GOLDILOCKS SENSOR HUB');
  console.log('================================================================================\n');

  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2024-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (Bis ${timeline[timeline.length - 1]?.date})\n`);

  const hub = new GoldilocksSensorHub();
  const result = hub.evaluate(timeline);

  console.log('STATUS:  ', result.status);
  console.log('REGIME:  ', result.regime);
  console.log('SCORE:   ', `${result.score} / 100`);
  console.log('MESSAGE: ', result.message);
  console.log('GUIDANCE:', result.guidance);
  console.log('\n--- SCORE BREAKDOWN ---');
  console.log(JSON.stringify(result.scoreBreakdown, null, 2));
  console.log('\n--- DIAGNOSTICS ---');
  console.log(JSON.stringify(result.diagnostics, null, 2));
}

checkLiveGoldilocks().catch(console.error);
