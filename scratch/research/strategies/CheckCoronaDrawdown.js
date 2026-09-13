import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { PortfolioStrategyEngine } from '../../../src/strategies/PortfolioStrategyEngine.js';
import { GoldSpyDcaStrategy } from '../../../src/strategies/GoldSpyDcaStrategy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  const fe = new FinanceExpert();
  const rawTimeline = await fe.getDailyGroupedData('2019-01-01', { bypassMemoryGuard: true });
  const engine = new PortfolioStrategyEngine();
  engine.registerStrategy(new GoldSpyDcaStrategy());

  let spyShares = 100;
  let gldShares = 0;
  let cashUSD = 0;

  let peakUSD = 0;
  let maxDdPct = 0;
  let maxDdDate = '';

  for (let i = 200; i < rawTimeline.length; i++) {
    const day = rawTimeline[i];
    if (day.date > '2020-05-01') break;
    const slice = rawTimeline.slice(0, i + 1);
    const res = await engine.evaluateAll({ date: day.date, timeline: slice });
    const strat = res.strategyResults.GOLD_SPY;
    const spyPrice = Number(day.assets?.SPY);
    const gldPrice = Number(day.assets?.GLD || day.assets?.Gold);

    // Rebalance based on strategy
    const currentValUSD = (spyShares * spyPrice) + (gldShares * gldPrice) + cashUSD;
    if (day.date >= '2020-02-15') {
      if (currentValUSD > peakUSD) peakUSD = currentValUSD;
      const dd = ((currentValUSD - peakUSD) / peakUSD) * 100;
      if (dd < maxDdPct) {
        maxDdPct = dd;
        maxDdDate = day.date;
      }
    }

    if (strat.status === 'EMERGENCY_HEDGE') {
      spyShares = 0;
      gldShares = (currentValUSD * 0.75) / gldPrice;
      cashUSD = currentValUSD * 0.25;
    } else if (strat.status === 'PRE_MARGIN_CASH_LOCK' || strat.status === 'MARGIN_CALL_ACTIVE') {
      spyShares = 0;
      cashUSD = currentValUSD;
      gldShares = 0;
    } else {
      spyShares = currentValUSD / spyPrice;
      gldShares = 0;
      cashUSD = 0;
    }
  }

  console.log(`Corona 2020 Strategy Max Drawdown: ${maxDdPct.toFixed(2)}% on ${maxDdDate}`);
}

main().catch(console.error);
