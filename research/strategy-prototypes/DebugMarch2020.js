import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { PortfolioStrategyEngine } from '../../src/strategies/PortfolioStrategyEngine.js';
import { PanicCapitulationIndicator } from '../../src/analysis/indicators/PanicCapitulationIndicator.js';
import { DarkPoolAccumulationIndicator } from '../../src/analysis/indicators/DarkPoolAccumulationIndicator.js';
import { VixSpikeCrushIndicator } from '../../src/analysis/indicators/VixSpikeCrushIndicator.js';
import { GdxSellingClimaxIndicator } from '../../src/analysis/indicators/GdxSellingClimaxIndicator.js';
import { GoldVolumeClimaxIndicator } from '../../src/analysis/indicators/GoldVolumeClimaxIndicator.js';

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const expert = new FinanceExpert();
  const tl = await expert.getDailyGroupedData('2019-01-01', { bypassMemoryGuard: true });

  const pc = new PanicCapitulationIndicator();
  const dp = new DarkPoolAccumulationIndicator();
  const vix = new VixSpikeCrushIndicator();
  const gdx = new GdxSellingClimaxIndicator();
  const gldVol = new GoldVolumeClimaxIndicator();

  console.log('Date       | SPY DD% | PC Crit? | DP Crit? | VIX Crit? | GDX Crit? | GLDvol Crit?');
  console.log('---------------------------------------------------------------------------------');

  for (let i = 40; i < tl.length; i++) {
    const day = tl[i];
    if (day.date < '2020-03-01' || day.date > '2020-04-01') continue;
    const slice = tl.slice(0, i + 1);

    const pcRes = pc.evaluate(slice);
    const dpRes = dp.evaluate(slice);
    const vixRes = vix.evaluate(slice);
    const gdxRes = gdx.evaluate(slice);
    const gldVolRes = gldVol.evaluate(slice);

    // Calculate drawdown
    let maxSpy = 0;
    for (let j = 0; j <= i; j++) {
      const p = Number(tl[j].assets?.SPY);
      if (p > maxSpy) maxSpy = p;
    }
    const curSpy = Number(day.assets?.SPY);
    const dd = ((curSpy - maxSpy) / maxSpy * 100).toFixed(1);

    console.log(`${day.date} | ${dd}% | PC:${pcRes?.status === 'CRITICAL'} | DP:${dpRes?.status === 'CRITICAL'} | VIX:${vixRes?.status === 'CRITICAL'} | GDX:${gdxRes?.status === 'CRITICAL'} | GLDvol:${gldVolRes?.status === 'CRITICAL'}`);
  }
}

main().catch(console.error);
