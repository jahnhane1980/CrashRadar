import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { PortfolioStrategyEngine } from '../../src/strategies/PortfolioStrategyEngine.js';
import { GoldSpyDcaStrategy } from '../../src/strategies/GoldSpyDcaStrategy.js';
import { GoldSniperIndicator } from '../../src/analysis/indicators/GoldSniperIndicator.js';
import { DarkPoolAccumulationIndicator } from '../../src/analysis/indicators/DarkPoolAccumulationIndicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runSimulation(rawTimeline, trancheConfig) {
  const engine = new PortfolioStrategyEngine();
  engine.registerStrategy(new GoldSpyDcaStrategy());
  const dpIndicator = new DarkPoolAccumulationIndicator();

  let spyShares = 100;
  let gldShares = 0;
  let cashUSD = 0;

  let peakUSD = 0;
  let maxDdPct = 0;
  let maxDdDate = '';

  let trancheLevel = 0; // 0 = in hedge/cash, 1, 2, 3
  let daysSinceT1 = 0;

  for (let i = 200; i < rawTimeline.length; i++) {
    const day = rawTimeline[i];
    if (day.date > '2020-05-01') break;
    const slice = rawTimeline.slice(0, i + 1);
    const res = await engine.evaluateAll({ date: day.date, timeline: slice });
    const strat = res.strategyResults.GOLD_SPY;
    const spyPrice = Number(day.assets?.SPY);
    const gldPrice = Number(day.assets?.GLD || day.assets?.Gold);
    const dpRes = dpIndicator.evaluate(slice);

    // Current total USD value
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
      trancheLevel = 0;
      daysSinceT1 = 0;
      spyShares = 0;
      gldShares = (currentValUSD * 0.75) / gldPrice;
      cashUSD = currentValUSD * 0.25;
    } else if (strat.status === 'PRE_MARGIN_CASH_LOCK' || strat.status === 'MARGIN_CALL_ACTIVE') {
      trancheLevel = 0;
      daysSinceT1 = 0;
      spyShares = 0;
      cashUSD = currentValUSD;
      gldShares = 0;
    } else if (strat.status === 'RE_ENTRY_SNIPER' || strat.status === 'NORMAL_DCA') {
      // Re-Entry logic
      if (strat.status === 'NORMAL_DCA' && !res.macroSignalContext.katastrophenMatrix?.isShieldActive) {
        // Full normal market: 100% SPY
        trancheLevel = 3;
        spyShares = currentValUSD / spyPrice;
        gldShares = 0;
        cashUSD = 0;
      } else {
        // Re-Entry via Tranches
        if (trancheLevel === 0) {
          trancheLevel = 1;
          daysSinceT1 = 1;
        } else {
          daysSinceT1++;
        }

        // Check if Tranche 2 triggers
        if (trancheLevel === 1) {
          if (trancheConfig.mode === 'EQUAL_33') {
            // Tranche 2 after 10 days OR if SPY dropped another 5%
            if (daysSinceT1 >= 10 || dpRes.status === 'CRITICAL') {
              trancheLevel = 2;
            }
          } else if (trancheConfig.mode === '30_40_30') {
            // Tranche 2 when Dark Pool fires OR after 10 days
            if (dpRes.status === 'CRITICAL' || daysSinceT1 >= 10) {
              trancheLevel = 2;
            }
          } else if (trancheConfig.mode === 'ALL_IN') {
            trancheLevel = 3;
          }
        }

        // Check if Tranche 3 triggers
        if (trancheLevel === 2) {
          if (daysSinceT1 >= 20 || dpRes.status === 'CRITICAL') {
            trancheLevel = 3;
          }
        }

        // Apply allocation based on trancheLevel
        let targetSpyPct = 100;
        if (trancheConfig.mode === 'EQUAL_33') {
          targetSpyPct = trancheLevel === 1 ? 33.3 : trancheLevel === 2 ? 66.6 : 100.0;
        } else if (trancheConfig.mode === '30_40_30') {
          targetSpyPct = trancheLevel === 1 ? 30.0 : trancheLevel === 2 ? 70.0 : 100.0;
        } else if (trancheConfig.mode === 'ALL_IN') {
          targetSpyPct = 100.0;
        }

        const targetSpyUSD = currentValUSD * (targetSpyPct / 100);
        const remUSD = currentValUSD - targetSpyUSD;

        spyShares = targetSpyUSD / spyPrice;
        cashUSD = remUSD;
        gldShares = 0;
      }
    }
  }

  return { maxDdPct, maxDdDate };
}

async function main() {
  console.log('--- TESTE TRANCHEN-MODELLE IN CORONA 2020 ---');
  const fe = new FinanceExpert();
  const rawTimeline = await fe.getDailyGroupedData('2019-01-01', { bypassMemoryGuard: true });

  const rAllIn = await runSimulation(rawTimeline, { mode: 'ALL_IN' });
  console.log(`1. Status Quo (100% All-In):      Max DD: ${rAllIn.maxDdPct.toFixed(2)}% on ${rAllIn.maxDdDate}`);

  const rEqual = await runSimulation(rawTimeline, { mode: 'EQUAL_33' });
  console.log(`2. Gleiche Tranchen (33/33/34%):  Max DD: ${rEqual.maxDdPct.toFixed(2)}% on ${rEqual.maxDdDate}`);

  const r304030 = await runSimulation(rawTimeline, { mode: '30_40_30' });
  console.log(`3. Asymmetrisch (30/40/30%):      Max DD: ${r304030.maxDdPct.toFixed(2)}% on ${r304030.maxDdDate}`);
}

main().catch(console.error);
