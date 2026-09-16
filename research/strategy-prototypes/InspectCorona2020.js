import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { KatastrophenMatrixIndicator } from '../../src/analysis/indicators/KatastrophenMatrixIndicator.js';
import { GoldSniperIndicator } from '../../src/analysis/indicators/GoldSniperIndicator.js';
import { PanicCapitulationIndicator } from '../../src/analysis/indicators/PanicCapitulationIndicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function inspectCorona() {
  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2019-01-01', { bypassMemoryGuard: true });
  await fe.close();

  const km = new KatastrophenMatrixIndicator();
  const gs = new GoldSniperIndicator();
  const pc = new PanicCapitulationIndicator();

  console.log(`Loaded ${timeline.length} days. Inspecting Corona period: 2020-02-15 to 2020-04-15...`);

  const startIdx = timeline.findIndex(t => t.date >= '2020-02-15');
  const endIdx = timeline.findIndex(t => t.date >= '2020-04-15');

  for (let i = startIdx; i <= endIdx; i++) {
    const slice = timeline.slice(0, i + 1);
    const day = timeline[i];
    const kmRes = km.evaluate(slice);
    const pcRes = pc.evaluate(slice);
    const gsRes = gs.evaluate(slice, { katastrophenMatrix: kmRes, panicCapitulation: pcRes });

    const spy = day.assets?.SPY;
    const gold = day.assets?.GLD ?? day.assets?.Gold;

    console.log(`${day.date} | SPY: ${Number(spy).toFixed(1)} (DD: ${kmRes.spyDrawdownPct.toFixed(1)}%, <SMA200: ${kmRes.chartBreak}) | Pillars: [${kmRes.activePillars.join('; ')}] | Shield: ${kmRes.isShieldActive} (days: ${kmRes.daysInAlarm}) | GS State: ${gsRes.state} Signal: ${gsRes.signal}`);
  }
}

inspectCorona().catch(console.error);
