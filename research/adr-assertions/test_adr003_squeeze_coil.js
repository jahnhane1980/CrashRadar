import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { OpexCalendarSensor } from '../../src/signals/sensors/OpexCalendarSensor.js';
import { DerivativesSensorHub } from '../../src/signals/hubs/DerivativesSensorHub.js';
import { LiquiditySensorHub } from '../../src/signals/hubs/LiquiditySensorHub.js';
import { SignalStatus, DerivativesRegime } from '../../src/signals/contracts/SignalTypes.js';

dotenv.config();

async function runSqueezeCoilBacktest() {
  console.log('================================================================================');
  console.log('   GROSSER HÄRTETEST ADR-003: SQUEEZE-COIL-KATAPULT-THESE (2020 - 2026)');
  console.log('   FÜHRT EXTREMER PRE-OPEX SHORT/PUT-DRUCK ZU ASYMMETRISCHEN REBOUNDS?');
  console.log('================================================================================\n');

  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})`);

  const derivHub = new DerivativesSensorHub();
  const liqHub = new LiquiditySensorHub();

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

  const evaluatedEvents = [];

  for (const event of opexEvents) {
    const opexIdx = timeline.findIndex(t => t.date >= event.date);
    if (opexIdx === -1 || opexIdx < 10) continue;

    const opexDay = timeline[opexIdx];
    const spyOpex = opexDay.assets?.SPY;
    if (!spyOpex) continue;

    // Untersuche das Pre-OpEx-Fenster: 5 Handelstage vor OpEx (D-5 bis D)
    const preWindow = timeline.slice(Math.max(0, opexIdx - 5), opexIdx + 1);
    let hasExtremeSqueezeCoil = false;
    let maxPcr = 0;
    let maxShortVol = 0;
    let isLiquidityCritical = false;
    let preMinSpy = spyOpex;

    for (let k = 0; k < preWindow.length; k++) {
      const dayK = preWindow[k];
      const sliceK = timeline.slice(0, opexIdx - 5 + k + 1);
      const dRes = derivHub.evaluate(sliceK);
      const lRes = liqHub.evaluate(sliceK);

      if (dRes.regime === DerivativesRegime.EXTREME_SQUEEZE_COIL) {
        hasExtremeSqueezeCoil = true;
      }
      const pcr = dayK.assets?.TotalPCR ?? dayK.macroGroups?.SentimentRisk?.TotalPCR ?? 0;
      if (pcr > maxPcr) maxPcr = pcr;

      const sv = dayK.macroGroups?.SentimentRisk?.SPY_ShortVolumeRatio ?? 0;
      if (sv > maxShortVol) maxShortVol = sv;

      if (lRes.status === SignalStatus.CRITICAL) {
        isLiquidityCritical = true;
      }
      if (dayK.assets?.SPY && dayK.assets.SPY < preMinSpy) {
        preMinSpy = dayK.assets.SPY;
      }
    }

    // Pre-OpEx Return (wie stark wurde der Markt vor dem Verfall geschüttelt?)
    const spyPreStart = preWindow[0].assets?.SPY || spyOpex;
    const preReturnPct = ((spyOpex - spyPreStart) / spyPreStart) * 100;

    // Forward-Performance ab OpEx (D+5, D+10, D+20, D+40)
    const fwdSlice = (days) => timeline.slice(opexIdx + 1, Math.min(timeline.length, opexIdx + days + 1)).map(d => d.assets?.SPY).filter(Boolean);
    const fwd5 = fwdSlice(5);
    const fwd10 = fwdSlice(10);
    const fwd20 = fwdSlice(20);
    const fwd40 = fwdSlice(40);

    const calcReturn = (arr) => arr.length ? ((arr[arr.length - 1] - spyOpex) / spyOpex) * 100 : null;
    const calcMin = (arr) => arr.length ? ((Math.min(...arr) - spyOpex) / spyOpex) * 100 : null;
    const calcMax = (arr) => arr.length ? ((Math.max(...arr) - spyOpex) / spyOpex) * 100 : null;

    const ret5 = calcReturn(fwd5);
    const ret10 = calcReturn(fwd10);
    const ret20 = calcReturn(fwd20);
    const ret40 = calcReturn(fwd40);
    const maxDD20 = calcMin(fwd20);
    const maxDD40 = calcMin(fwd40);
    const maxRunup20 = calcMax(fwd20);
    const maxRunup40 = calcMax(fwd40);

    evaluatedEvents.push({
      date: event.date,
      year: event.year,
      month: event.month,
      type: event.type,
      isQuad: event.isQuad,
      spyOpex,
      preReturnPct,
      hasExtremeSqueezeCoil,
      maxPcr,
      maxShortVol,
      isLiquidityCritical,
      ret5,
      ret10,
      ret20,
      ret40,
      maxDD20,
      maxDD40,
      maxRunup20,
      maxRunup40
    });
  }

  // 2. Kohorten-Bildung
  // Kohorte A: EXTREME_SQUEEZE_COIL mit stabiler Liquidität (Liquidity NOT Critical) -> Die These!
  const cohortA = evaluatedEvents.filter(e => e.hasExtremeSqueezeCoil && !e.isLiquidityCritical);
  // Kohorte B: Normale OpEx ohne Squeeze Coil (Liquidität normal)
  const cohortB = evaluatedEvents.filter(e => !e.hasExtremeSqueezeCoil && !e.isLiquidityCritical);
  // Kohorte C: Squeeze Coil unter toxischem Liquiditäts-Crash (z. B. Corona März 2020)
  const cohortC = evaluatedEvents.filter(e => e.hasExtremeSqueezeCoil && e.isLiquidityCritical);

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`📊 KOHORTEN-VERTEILUNG:`);
  console.log(`  • Kohorte A (Squeeze Coil + Liquidität OK - Die These): ${cohortA.length} Events`);
  console.log(`  • Kohorte B (Normale OpEx ohne Squeeze Coil):            ${cohortB.length} Events`);
  console.log(`  • Kohorte C (Squeeze Coil bei Liquidität CRITICAL):     ${cohortC.length} Events`);
  console.log(`--------------------------------------------------------------------------------\n`);

  const printStats = (cohort, label) => {
    // Nur Events mit mind. 20 Tagen Forward-Historie
    const valid = cohort.filter(e => e.ret20 !== null);
    const n = valid.length;
    if (!n) {
      console.log(`📈 ${label}: Keine auswertbaren Events.`);
      return;
    }

    const win5 = (valid.filter(e => e.ret5 !== null && e.ret5 > 0).length / valid.filter(e => e.ret5 !== null).length) * 100;
    const win10 = (valid.filter(e => e.ret10 !== null && e.ret10 > 0).length / valid.filter(e => e.ret10 !== null).length) * 100;
    const win20 = (valid.filter(e => e.ret20 > 0).length / n) * 100;
    const win40 = (valid.filter(e => e.ret40 !== null && e.ret40 > 0).length / valid.filter(e => e.ret40 !== null).length) * 100;

    const avgRet5 = valid.reduce((a, e) => a + (e.ret5 || 0), 0) / valid.filter(e => e.ret5 !== null).length;
    const avgRet10 = valid.reduce((a, e) => a + (e.ret10 || 0), 0) / valid.filter(e => e.ret10 !== null).length;
    const avgRet20 = valid.reduce((a, e) => a + e.ret20, 0) / n;
    const avgRet40 = valid.reduce((a, e) => a + (e.ret40 || 0), 0) / valid.filter(e => e.ret40 !== null).length;

    const avgDD20 = valid.reduce((a, e) => a + (e.maxDD20 || 0), 0) / n;
    const avgRunup20 = valid.reduce((a, e) => a + (e.maxRunup20 || 0), 0) / n;
    const avgDD40 = valid.reduce((a, e) => a + (e.maxDD40 || 0), 0) / valid.filter(e => e.maxDD40 !== null).length;
    const avgRunup40 = valid.reduce((a, e) => a + (e.maxRunup40 || 0), 0) / valid.filter(e => e.maxRunup40 !== null).length;

    // Asymmetrie: Runup vs Drawdown
    const asymmetry20 = Math.abs(avgRunup20 / (avgDD20 || -1)).toFixed(2);
    const asymmetry40 = Math.abs(avgRunup40 / (avgDD40 || -1)).toFixed(2);

    console.log(`📈 ${label} (${n} Events ausgewertet):`);
    console.log(`   • Win-Rate D+5:   ${win5.toFixed(1)}% | Ø Return: ${avgRet5 >= 0 ? '+' : ''}${avgRet5.toFixed(2)}%`);
    console.log(`   • Win-Rate D+10:  ${win10.toFixed(1)}% | Ø Return: ${avgRet10 >= 0 ? '+' : ''}${avgRet10.toFixed(2)}%`);
    console.log(`   • Win-Rate D+20:  ${win20.toFixed(1)}% | Ø Return: ${avgRet20 >= 0 ? '+' : ''}${avgRet20.toFixed(2)}%`);
    console.log(`   • Win-Rate D+40:  ${win40.toFixed(1)}% | Ø Return: ${avgRet40 >= 0 ? '+' : ''}${avgRet40.toFixed(2)}%`);
    console.log(`   • Max DD 20d:     ${avgDD20.toFixed(2)}% | Max Runup 20d: +${avgRunup20.toFixed(2)}% (Asymmetrie: ${asymmetry20} : 1)`);
    console.log(`   • Max DD 40d:     ${avgDD40.toFixed(2)}% | Max Runup 40d: +${avgRunup40.toFixed(2)}% (Asymmetrie: ${asymmetry40} : 1)\n`);
  };

  console.log('================================================================================');
  console.log('1. STATISTISCHER VERGLEICH DER REBOUND-EFFIZIENZ');
  console.log('================================================================================');
  printStats(cohortA, 'KOHORTE A: SQUEEZE COIL + LIQUIDITÄT OK (ADR-003 KATAPULT)');
  printStats(cohortB, 'KOHORTE B: NORMALE OPEX OHNE SQUEEZE COIL');
  printStats(cohortC, 'KOHORTE C: SQUEEZE COIL UNTER LIQUIDITÄTS-CRITICAL');

  // 3. Detail-Chronologie aller Squeeze-Coil Events (Kohorte A)
  console.log('================================================================================');
  console.log('2. DETAIL-CHRONOLOGIE ALLER SQUEEZE-COIL EVENTS (KOHORTE A)');
  console.log('================================================================================');

  const detailedList = [];
  for (const e of cohortA) {
    const isWin20 = e.ret20 !== null && e.ret20 > 0;
    const isWin10 = e.ret10 !== null && e.ret10 > 0;
    const tag = (e.ret20 !== null && e.ret20 >= 2.5 && e.maxDD20 > -3.0) ? '✅ VOLLES KATAPULT' : (isWin20 ? '✅ REBOUND ERFOLGREICH' : '❌ FEHLSCHLAG (Bull Trap)');

    detailedList.push({
      date: e.date,
      type: e.type,
      spy: e.spyOpex,
      preShakeout: e.preReturnPct.toFixed(1) + '%',
      ret10: e.ret10 !== null ? ((e.ret10 >= 0 ? '+' : '') + e.ret10.toFixed(2) + '%') : 'N/A',
      ret20: e.ret20 !== null ? ((e.ret20 >= 0 ? '+' : '') + e.ret20.toFixed(2) + '%') : 'N/A',
      maxDD20: e.maxDD20 !== null ? (e.maxDD20.toFixed(2) + '%') : 'N/A',
      maxRunup20: e.maxRunup20 !== null ? ('+' + e.maxRunup20.toFixed(2) + '%') : 'N/A',
      tag
    });

    console.log(`[${e.date}] ${e.type} | SPY: $${e.spyOpex} | Pre-Shakeout: ${e.preReturnPct.toFixed(1)}%`);
    console.log(`   D+10: ${e.ret10 !== null ? ((e.ret10 >= 0 ? '+' : '') + e.ret10.toFixed(2) + '%') : 'N/A'} | D+20: ${e.ret20 !== null ? ((e.ret20 >= 0 ? '+' : '') + e.ret20.toFixed(2) + '%') : 'N/A'} | Max DD 20d: ${e.maxDD20 !== null ? e.maxDD20.toFixed(2) + '%' : 'N/A'} | Max Runup: ${e.maxRunup20 !== null ? '+' + e.maxRunup20.toFixed(2) + '%' : 'N/A'}`);
    console.log(`   👉 ${tag}\n`);
  }

  // 4. Synthese
  console.log('================================================================================');
  console.log('3. ERGEBNIS-SYNTHESE FÜR ADR-003');
  console.log('================================================================================');
  const validCohortA = cohortA.filter(e => e.ret20 !== null);
  const totalCoil = validCohortA.length;
  const wins20 = validCohortA.filter(e => e.ret20 > 0).length;
  const fullKatapult = detailedList.filter(d => d.tag.includes('VOLLES KATAPULT')).length;
  const failures = detailedList.filter(d => d.tag.includes('FEHLSCHLAG')).length;

  console.log(`Gesamtzahl auswertbarer Squeeze-Coil Events (2020 - 2026): ${totalCoil}`);
  console.log(`  ✅ Rebound erfolgreich (D+20 Return > 0%): ${wins20} von ${totalCoil} (${((wins20/totalCoil)*100).toFixed(1)}%)`);
  console.log(`  🚀 Davon volles Katapult (Runup >= 2.5%, DD < -3%): ${fullKatapult} von ${totalCoil} (${((fullKatapult/totalCoil)*100).toFixed(1)}%)`);
  console.log(`  ❌ Fehlschläge (Bull Traps nach Verfall): ${failures} von ${totalCoil} (${((failures/totalCoil)*100).toFixed(1)}%)\n`);

  fs.writeFileSync('data/cache/portfolio_compass/adr003_test_results.json', JSON.stringify({
    totalOpExEvents: opexEvents.length,
    cohortACount: cohortA.length,
    cohortBCount: cohortB.length,
    cohortCCount: cohortC.length,
    totalCoilValid: totalCoil,
    wins20,
    winRate20: ((wins20/totalCoil)*100).toFixed(1),
    fullKatapult,
    failures,
    detailedList
  }, null, 2));

  await expert.close();
}

runSqueezeCoilBacktest().catch(console.error);
