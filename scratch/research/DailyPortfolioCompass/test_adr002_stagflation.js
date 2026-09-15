import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { GoldilocksSensorHub } from '../../../src/signals/hubs/GoldilocksSensorHub.js';
import { GoldilocksRegime } from '../../../src/signals/contracts/SignalTypes.js';

dotenv.config();

async function runStagflationBacktest() {
  console.log('================================================================================');
  console.log('   GROSSER HÄRTETEST ADR-002: STAGFLATIONS-DECKEL-THESE (2020 - 2026)');
  console.log('   SCHEITERN ALLZEITHOCH-AUSBRÜCHE BEI STAGFLATION_PRESSURE SYSTEMATISCH?');
  console.log('================================================================================\n');

  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})`);

  const startIdx = timeline.findIndex(t => t.date >= '2020-01-01');
  const endIdx = timeline.findLastIndex(t => t.date <= '2026-09-14');

  const goldiHub = new GoldilocksSensorHub();

  let runningAth = 0;
  const athDays = [];

  for (let i = 0; i <= endIdx; i++) {
    const day = timeline[i];
    const spy = day.assets?.SPY;
    if (spy && spy > runningAth) runningAth = spy;

    if (i < startIdx || !spy) continue;

    const slice = timeline.slice(0, i + 1);
    const goldiRes = goldiHub.evaluate(slice);

    const distToAthPct = ((spy - runningAth) / runningAth) * 100;
    const isNearAth = distToAthPct >= -2.0;

    const oil = day.assets?.['CL=F'] ?? day.macroGroups?.Inflation?.OilPrice ?? goldiRes.diagnostics?.inflation?.oilPrice;
    const realYield = day.macroGroups?.FinancialConditions?.RealYield10y ?? goldiRes.diagnostics?.monetary?.realYield10y;
    const cpiYoY = goldiRes.diagnostics?.inflation?.coreCpiYoY ?? day.macroGroups?.Inflation?.CoreCPI;

    const forward20Days = timeline.slice(i + 1, Math.min(timeline.length, i + 21));
    const forward60Days = timeline.slice(i + 1, Math.min(timeline.length, i + 61));

    const getMinMaxReturn = (fwdSlice) => {
      if (!fwdSlice.length) return { minReturn: 0, maxReturn: 0, finalReturn: 0 };
      const prices = fwdSlice.map(d => d.assets?.SPY).filter(p => p !== undefined && p !== null);
      if (!prices.length) return { minReturn: 0, maxReturn: 0, finalReturn: 0 };
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const finalP = prices[prices.length - 1];
      return {
        minReturn: ((minP - spy) / spy) * 100,
        maxReturn: ((maxP - spy) / spy) * 100,
        finalReturn: ((finalP - spy) / spy) * 100
      };
    };

    const fwd20 = getMinMaxReturn(forward20Days);
    const fwd60 = getMinMaxReturn(forward60Days);

    const record = {
      date: day.date,
      spy,
      runningAth,
      distToAthPct,
      isNearAth,
      regime: goldiRes.regime,
      score: goldiRes.score,
      oil,
      realYield,
      cpiYoY,
      isComponentStress: (oil && oil > 90.0) || (realYield && realYield > 2.20),
      fwd20,
      fwd60
    };

    if (isNearAth) {
      athDays.push(record);
    }
  }

  console.log(`Gesamtanzahl Handelstage nahe Allzeithoch (SPY <= 2% unter ATH): ${athDays.length}\n`);

  // Stufe 1: Reines STAGFLATION_PRESSURE Regime
  const stagRegimeDays = athDays.filter(d => d.regime === GoldilocksRegime.STAGFLATION_PRESSURE);
  // Stufe 2: Komponentischer Stagflations-Stress (Öl > 90$ ODER Realzins > 2.2%)
  const componentStressDays = athDays.filter(d => d.isComponentStress);
  // Stufe 3: Normales / gesundes Goldilocks-Umfeld
  const cleanExpansionDays = athDays.filter(d => d.regime === GoldilocksRegime.GOLDILOCKS_EXPANSION && !d.isComponentStress);

  const calcStats = (days, label) => {
    const n = days.length;
    if (!n) return;
    const avgRet20 = days.reduce((a, b) => a + b.fwd20.finalReturn, 0) / n;
    const avgRet60 = days.reduce((a, b) => a + b.fwd60.finalReturn, 0) / n;
    const avgDD20 = days.reduce((a, b) => a + b.fwd20.minReturn, 0) / n;
    const avgDD60 = days.reduce((a, b) => a + b.fwd60.minReturn, 0) / n;
    const avgRunup20 = days.reduce((a, b) => a + b.fwd20.maxReturn, 0) / n;
    const avgRunup60 = days.reduce((a, b) => a + b.fwd60.maxReturn, 0) / n;

    // Fehlausbruch: Drawdown <= -2.5% oder negativer 20d-Return
    const failed20 = (days.filter(d => d.fwd20.minReturn <= -2.5 || d.fwd20.finalReturn < 0).length / n) * 100;
    const failed60 = (days.filter(d => d.fwd60.minReturn <= -5.0 || d.fwd60.finalReturn < 0).length / n) * 100;

    console.log(`📈 ${label} (${n} Handelstage):`);
    console.log(`   • Fehlausbruchs-Quote 20d (Failure Rate): ${failed20.toFixed(1)}%`);
    console.log(`   • Fehlausbruchs-Quote 60d (Failure Rate): ${failed60.toFixed(1)}%`);
    console.log(`   • Ø Return D+20:  ${avgRet20 >= 0 ? '+' : ''}${avgRet20.toFixed(2)}% | Ø Max DD 20d: ${avgDD20.toFixed(2)}% | Ø Runup 20d: +${avgRunup20.toFixed(2)}%`);
    console.log(`   • Ø Return D+60:  ${avgRet60 >= 0 ? '+' : ''}${avgRet60.toFixed(2)}% | Ø Max DD 60d: ${avgDD60.toFixed(2)}% | Ø Runup 60d: +${avgRunup60.toFixed(2)}%\n`);
  };

  console.log('================================================================================');
  console.log('1. ERGEBNISSE AN ALLZEITHOCHS NACH MAKRO-BEDINGUNG');
  console.log('================================================================================');
  calcStats(componentStressDays, 'KOHORTE A: STAGFLATIONS-STRESS AN HOCHS (Öl > 90$ oder Realzins > 2.2%)');
  calcStats(cleanExpansionDays, 'KOHORTE B: UNGESTÖRTE EXPANSION AN HOCHS (Kein Zins/Öl-Stress)');
  calcStats(stagRegimeDays, 'KOHORTE C: DISKRETES STAGFLATION_PRESSURE REGIME (September 2026)');

  fs.writeFileSync('scratch/research/DailyPortfolioCompass/adr002_test_results.json', JSON.stringify({
    athDaysCount: athDays.length,
    componentStressCount: componentStressDays.length,
    cleanExpansionCount: cleanExpansionDays.length,
    stagRegimeCount: stagRegimeDays.length,
    componentStressDays: componentStressDays.map(d => ({ date: d.date, spy: d.spy, oil: d.oil, realYield: d.realYield, dd20: d.fwd20.minReturn, ret20: d.fwd20.finalReturn })),
    stagRegimeDays: stagRegimeDays.map(d => ({ date: d.date, spy: d.spy, oil: d.oil, realYield: d.realYield, dd20: d.fwd20.minReturn, ret20: d.fwd20.finalReturn }))
  }, null, 2));

  await expert.close();
}

runStagflationBacktest().catch(console.error);
