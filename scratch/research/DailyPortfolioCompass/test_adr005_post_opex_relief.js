import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { OpexCalendarSensor } from '../../../src/signals/sensors/OpexCalendarSensor.js';
import { DerivativesSensorHub } from '../../../src/signals/hubs/DerivativesSensorHub.js';
import { LiquiditySensorHub } from '../../../src/signals/hubs/LiquiditySensorHub.js';
import { GoldilocksSensorHub } from '../../../src/signals/hubs/GoldilocksSensorHub.js';
import { SignalStatus, DerivativesRegime } from '../../../src/signals/contracts/SignalTypes.js';

dotenv.config();

async function runPostOpexReliefBacktest() {
  console.log('================================================================================');
  console.log('   GROSSER HÄRTETEST ADR-005: POST-OPEX-RELIEF-THESE (2020 - 2026)');
  console.log('   DREHT DAS ABWARTEN DES VERFALLSTAGES DIE 50% BULL-TRAPS IN HOHE WIN-RATES?');
  console.log('================================================================================\n');

  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})`);

  const derivHub = new DerivativesSensorHub();
  const liqHub = new LiquiditySensorHub();
  const goldiHub = new GoldilocksSensorHub();

  // 1. Finde alle OpEx-Termine von 2020 bis September 2026
  const opexEvents = [];
  for (let y = 2020; y <= 2026; y++) {
    for (let m = 0; m < 12; m++) {
      if (y === 2026 && m > 8) break;
      const thirdFriday = OpexCalendarSensor.getThirdFriday(y, m);
      const dStr = thirdFriday.toISOString().split('T')[0];
      const isQuad = OpexCalendarSensor.isQuadrupleWitching(m);
      opexEvents.push({
        date: dStr,
        year: y,
        month: m + 1,
        isQuad,
        type: isQuad ? 'HEXENSABBAT' : 'MONATS-OPEX'
      });
    }
  }

  console.log(`Analysierte OpEx-Events ab 2020: ${opexEvents.length} (davon ${opexEvents.filter(e => e.isQuad).length} Hexensabbat-Events)\n`);

  const allEventsEvaluated = [];

  for (const event of opexEvents) {
    const opexIdx = timeline.findIndex(t => t.date >= event.date);
    if (opexIdx === -1 || opexIdx < 10) continue;

    const opexDay = timeline[opexIdx];
    const spyOpex = opexDay.assets?.SPY;
    if (!spyOpex) continue;

    // A. Pre-OpEx Phase untersuchen (D-5 bis D)
    const preWindow = timeline.slice(Math.max(0, opexIdx - 5), opexIdx + 1);
    let hasExtremeSqueezeCoil = false;
    let maxPcr = 0;
    let maxShortVol = 0;
    let isLiqCriticalPre = false;

    for (let k = 0; k < preWindow.length; k++) {
      const sliceK = timeline.slice(0, opexIdx - 5 + k + 1);
      const dRes = derivHub.evaluate(sliceK);
      const lRes = liqHub.evaluate(sliceK);

      if (dRes.regime === DerivativesRegime.EXTREME_SQUEEZE_COIL) {
        hasExtremeSqueezeCoil = true;
      }
      const pcr = dRes.diagnostics?.gamma?.pcr || 0;
      const shortVol = dRes.diagnostics?.squeeze?.shortVolumePct || 0;
      if (pcr > maxPcr) maxPcr = pcr;
      if (shortVol > maxShortVol) maxShortVol = shortVol;
      if (lRes.status === SignalStatus.CRITICAL) isLiqCriticalPre = true;
    }

    // Forward Performance Helper
    const calcPerformance = (entryIdx, entryPrice) => {
      const fwdSlice = (days) => timeline.slice(entryIdx + 1, Math.min(timeline.length, entryIdx + 1 + days));
      const getStats = (days) => {
        const slice = fwdSlice(days);
        if (!slice.length) return { ret: 0, maxDD: 0, maxRunup: 0 };
        const prices = slice.map(d => d.assets?.SPY).filter(p => p !== null && p !== undefined);
        if (!prices.length) return { ret: 0, maxDD: 0, maxRunup: 0 };
        const finalP = prices[prices.length - 1];
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        return {
          ret: Number((((finalP - entryPrice) / entryPrice) * 100).toFixed(2)),
          maxDD: Number((((minP - entryPrice) / entryPrice) * 100).toFixed(2)),
          maxRunup: Number((((maxP - entryPrice) / entryPrice) * 100).toFixed(2))
        };
      };

      return {
        d5: getStats(5),
        d10: getStats(10),
        d20: getStats(20)
      };
    };

    // Baseline: Kauf am OpEx-Tag (Freitag D)
    const baselinePerf = calcPerformance(opexIdx, spyOpex);

    // B. Post-OpEx Fenster untersuchen (D+1 bis D+5 nach OpEx)
    const postWindow = timeline.slice(opexIdx + 1, Math.min(timeline.length, opexIdx + 6));
    
    // Strategie 1: Blindes Post-OpEx Kaufen (Tag D+1 / Montag)
    let strat1Result = null;
    if (postWindow.length > 0) {
      const day1 = postWindow[0];
      const spyDay1 = day1.assets?.SPY;
      if (spyDay1) {
        strat1Result = {
          entryDate: day1.date,
          entryPrice: spyDay1,
          priceDeltaVsOpexPct: Number((((spyDay1 - spyOpex) / spyOpex) * 100).toFixed(2)),
          perf: calcPerformance(opexIdx + 1, spyDay1)
        };
      }
    }

    // Strategie 2: Post-OpEx Bestätigter Relief / Vol-Crush
    // Einstieg an dem ersten Tag in D+1 bis D+5, an dem VIX kollabiert (VolCrush) ODER SPY steigt
    let strat2Result = null;
    for (let p = 0; p < postWindow.length; p++) {
      const curIdx = opexIdx + 1 + p;
      const sliceP = timeline.slice(0, curIdx + 1);
      const dRes = derivHub.evaluate(sliceP);
      const curDay = postWindow[p];
      const curSpy = curDay.assets?.SPY;
      if (!curSpy) continue;

      const isVolCrush = dRes.diagnostics?.volCrush?.isVolCrushing;
      const isUnpinned = dRes.regime === DerivativesRegime.POST_OPEX_EXPANSION;
      const isSpyUpVsOpex = curSpy >= spyOpex;

      if (isVolCrush || (isUnpinned && isSpyUpVsOpex)) {
        strat2Result = {
          entryDate: curDay.date,
          dayOffset: p + 1,
          trigger: isVolCrush ? 'VOL_CRUSH' : 'UNPINNING_UP',
          entryPrice: curSpy,
          priceDeltaVsOpexPct: Number((((curSpy - spyOpex) / spyOpex) * 100).toFixed(2)),
          perf: calcPerformance(curIdx, curSpy)
        };
        break;
      }
    }

    // Strategie 3: Dual-Gatekeeper Post-OpEx Relief (Strategie 2 + Makro-Filter)
    let strat3Result = null;
    if (strat2Result) {
      const entryIdx = timeline.findIndex(t => t.date === strat2Result.entryDate);
      const sliceEntry = timeline.slice(0, entryIdx + 1);
      const lRes = liqHub.evaluate(sliceEntry);
      const gRes = goldiHub.evaluate(sliceEntry);

      const isLiqSafe = lRes.status !== SignalStatus.CRITICAL;
      const isGoldiSafe = gRes.status === SignalStatus.OK || gRes.isAboveSma200;

      if (isLiqSafe && isGoldiSafe) {
        strat3Result = {
          ...strat2Result,
          macroApproved: true,
          liqRegime: lRes.regime,
          goldiRegime: gRes.regime
        };
      } else {
        strat3Result = {
          entryDate: strat2Result.entryDate,
          tradeBlocked: true,
          blockReason: !isLiqSafe ? 'LIQUIDITY_CRITICAL' : `GOLDI_VETO (${gRes.regime})`,
          avoidedDD20: strat2Result.perf.d20.maxDD,
          avoidedRet20: strat2Result.perf.d20.ret
        };
      }
    }

    allEventsEvaluated.push({
      date: event.date,
      type: event.type,
      isQuad: event.isQuad,
      hasExtremeSqueezeCoil,
      maxPcr: Number(maxPcr.toFixed(2)),
      maxShortVol: Number(maxShortVol.toFixed(1)),
      isLiqCriticalPre,
      spyOpex,
      baselinePerf,
      strat1: strat1Result,
      strat2: strat2Result,
      strat3: strat3Result
    });
  }

  // 2. Statistische Auswertung der Kohorten
  console.log('================================================================================');
  console.log('1. STATISTISCHE KOHORTEN-ANALYSE (22 EXTREME SQUEEZE-COIL EVENTS)');
  console.log('================================================================================');

  const squeezeEvents = allEventsEvaluated.filter(e => e.hasExtremeSqueezeCoil && !e.isLiqCriticalPre);
  const normalEvents = allEventsEvaluated.filter(e => !e.hasExtremeSqueezeCoil && !e.isLiqCriticalPre);

  console.log(`Extrahierte Pre-OpEx Squeeze-Events (ohne Liquiditäts-Crash): ${squeezeEvents.length} Events\n`);

  const summarizeStrategy = (name, events, extractor) => {
    const valid = events.map(extractor).filter(Boolean);
    const n = valid.length;
    if (!n) return null;

    const win5 = (valid.filter(v => v.perf.d5.ret > 0).length / n) * 100;
    const win10 = (valid.filter(v => v.perf.d10.ret > 0).length / n) * 100;
    const win20 = (valid.filter(v => v.perf.d20.ret > 0).length / n) * 100;

    const avgRet5 = valid.reduce((acc, v) => acc + v.perf.d5.ret, 0) / n;
    const avgRet10 = valid.reduce((acc, v) => acc + v.perf.d10.ret, 0) / n;
    const avgRet20 = valid.reduce((acc, v) => acc + v.perf.d20.ret, 0) / n;

    const avgDD20 = valid.reduce((acc, v) => acc + v.perf.d20.maxDD, 0) / n;
    const avgRunup20 = valid.reduce((acc, v) => acc + v.perf.d20.maxRunup, 0) / n;
    const asymmetry = avgDD20 !== 0 ? (avgRunup20 / Math.abs(avgDD20)) : 99;

    console.log(`📈 ${name} (${n} Trades ausgeführt):`);
    console.log(`   • Win-Rate D+5:  ${win5.toFixed(1)}% | Ø Return D+5:  ${avgRet5 >= 0 ? '+' : ''}${avgRet5.toFixed(2)}%`);
    console.log(`   • Win-Rate D+10: ${win10.toFixed(1)}% | Ø Return D+10: ${avgRet10 >= 0 ? '+' : ''}${avgRet10.toFixed(2)}%`);
    console.log(`   • Win-Rate D+20: ${win20.toFixed(1)}% | Ø Return D+20: ${avgRet20 >= 0 ? '+' : ''}${avgRet20.toFixed(2)}%`);
    console.log(`   • Ø Max DD (20d): ${avgDD20.toFixed(2)}% | Ø Max Runup (20d): +${avgRunup20.toFixed(2)}%`);
    console.log(`   • Asymmetrie (Runup / DD): ${asymmetry.toFixed(2)} : 1\n`);

    return {
      n,
      win5: Number(win5.toFixed(1)),
      win10: Number(win10.toFixed(1)),
      win20: Number(win20.toFixed(1)),
      avgRet5: Number(avgRet5.toFixed(2)),
      avgRet10: Number(avgRet10.toFixed(2)),
      avgRet20: Number(avgRet20.toFixed(2)),
      avgDD20: Number(avgDD20.toFixed(2)),
      avgRunup20: Number(avgRunup20.toFixed(2)),
      asymmetry: Number(asymmetry.toFixed(2))
    };
  };

  const resBaseline = summarizeStrategy(
    'KOHORTE A: BASELINE ADR-003 (Kauf am OpEx-Freitag bei Squeeze-Coil)',
    squeezeEvents,
    e => ({ perf: e.baselinePerf })
  );

  const resStrat1 = summarizeStrategy(
    'KOHORTE B1: BLINDER POST-OPEX EINSTIEG (Kauf an Tag D+1 / Montag nach Verfall)',
    squeezeEvents,
    e => e.strat1
  );

  const resStrat2 = summarizeStrategy(
    'KOHORTE B2: POST-OPEX BESTÄTIGTER RELIEF / VOL-CRUSH (Einstieg bei Bestätigung D+1 bis D+5)',
    squeezeEvents,
    e => e.strat2
  );

  const resStrat3 = summarizeStrategy(
    'KOHORTE B3: DUAL-GATEKEEPER POST-OPEX RELIEF (Bestätigter Relief + Makro-Safe)',
    squeezeEvents,
    e => (e.strat3 && !e.strat3.tradeBlocked ? e.strat3 : null)
  );

  const resNormal = summarizeStrategy(
    'KOHORTE C: NORMALE OPEX OHNE SQUEEZE (Baseline Referenz)',
    normalEvents,
    e => ({ perf: e.baselinePerf })
  );

  // 3. Detail-Analyse der 11 Bull Traps aus ADR-003
  console.log('================================================================================');
  console.log('2. WAS WURDE AUS DEN 11 BULL-TRAPS AUS ADR-003?');
  console.log('================================================================================');

  const bullTrapEvents = squeezeEvents.filter(e => e.baselinePerf.d20.ret < 0);
  console.log(`Anzahl der 11 Bull-Trap-Events untersucht: ${bullTrapEvents.length}\n`);

  let resolvedIntoProfits = 0;
  let blockedByMacro = 0;
  let remainingTraps = 0;

  for (const bt of bullTrapEvents) {
    const bRet = bt.baselinePerf.d20.ret;
    const s1 = bt.strat1?.perf.d20.ret;
    const s2 = bt.strat2?.perf.d20.ret;
    const s3 = bt.strat3;

    let verdict = '';
    if (s3?.tradeBlocked) {
      verdict = `🛡️ DUAL-GATE BLOCKIERT (${s3.blockReason}) -> Bull Trap abgewehrt!`;
      blockedByMacro++;
    } else if (s2 !== undefined && s2 > 0) {
      verdict = `🟢 IN GEWINN GEDREHT (Post-OpEx Relief: +${s2.toFixed(2)}% vs. Baseline ${bRet.toFixed(2)}%)`;
      resolvedIntoProfits++;
    } else {
      verdict = `⚠️ BLEIBT SCHWIEG (Verlust: ${s2 ?? s1 ?? 'N/A'}%)`;
      remainingTraps++;
    }

    console.log(`[${bt.date} - ${bt.type}] Baseline OpEx D+20: ${bRet.toFixed(2)}%`);
    console.log(`  • Tag D+1 Ret: ${s1 !== undefined ? s1.toFixed(2) + '%' : 'N/A'} | Relief Trigger Ret: ${s2 !== undefined ? s2.toFixed(2) + '%' : 'Kein Trigger'}`);
    console.log(`  👉 Urteil: ${verdict}\n`);
  }

  console.log(`Synthese der 11 Bull Traps:`);
  console.log(`  • Erfolgreich durch Makro-Gatekeeper blockiert: ${blockedByMacro}`);
  console.log(`  • Durch Abwarten von Post-OpEx in Gewinn gedreht: ${resolvedIntoProfits}`);
  console.log(`  • Rest-Fallen:                                  ${remainingTraps}\n`);

  fs.writeFileSync('scratch/research/DailyPortfolioCompass/adr005_test_results.json', JSON.stringify({
    totalEvents: allEventsEvaluated.length,
    squeezeEventsCount: squeezeEvents.length,
    cohorts: {
      baselinePreOpex: resBaseline,
      postOpexBlindD1: resStrat1,
      postOpexConfirmedRelief: resStrat2,
      dualGatePostOpexRelief: resStrat3,
      normalOpex: resNormal
    },
    bullTrapsAnalysis: {
      totalBullTraps: bullTrapEvents.length,
      blockedByMacro,
      resolvedIntoProfits,
      remainingTraps
    },
    events: allEventsEvaluated
  }, null, 2));

  console.log('✅ Ergebnisse erfolgreich in scratch/research/DailyPortfolioCompass/adr005_test_results.json gespeichert!');

  await expert.close();
}

runPostOpexReliefBacktest().catch(console.error);
