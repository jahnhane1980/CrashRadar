import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { GoldilocksSensorHub } from '../../src/signals/hubs/GoldilocksSensorHub.js';
import { LiquiditySensorHub } from '../../src/signals/hubs/LiquiditySensorHub.js';
import { SignalStatus } from '../../src/signals/contracts/SignalTypes.js';

dotenv.config();

async function runOilYieldClampBacktest() {
  console.log('================================================================================');
  console.log('   GROSSER HÄRTETEST ADR-006: ÖL-ZINS-ZANGEN-THESE (2020 - 2026)');
  console.log('   ANGEBOTS-SCHOCK VS. REALE BEWERTUNGS-KOMPRESSION: WANN BRICHT ÖL DEN MARKT?');
  console.log('================================================================================\n');

  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})`);

  const startIdx = timeline.findIndex(t => t.date >= '2020-01-01');
  const endIdx = timeline.findLastIndex(t => t.date <= '2026-09-14');

  console.log(`Analysiere Testfenster: ${timeline[startIdx].date} bis ${timeline[endIdx].date} (${endIdx - startIdx + 1} Tage)\n`);

  const goldiHub = new GoldilocksSensorHub();
  const liqHub = new LiquiditySensorHub();

  const allHighOilDays = [];
  const normalOilDays = [];
  const oilEpisodes = [];

  let currentEpisode = null;
  let runningAth = 0;

  for (let i = startIdx; i <= endIdx; i++) {
    const day = timeline[i];
    const spy = day.assets?.SPY;
    const oil = day.assets?.Oil;
    const vix = day.assets?.VIX;
    const ry = day.macroGroups?.FinancialConditions?.RealYield10y ?? day.macro?.RealYield10y;

    if (!spy) continue;
    if (spy > runningAth) runningAth = spy;

    const distAthPct = Number((((spy - runningAth) / runningAth) * 100).toFixed(2));

    // Forward Performance Helper (20d & 60d)
    const getForwardStats = (days) => {
      const slice = timeline.slice(i + 1, Math.min(timeline.length, i + 1 + days));
      if (!slice.length) return { ret: 0, min: 0, max: 0 };
      const prices = slice.map(d => d.assets?.SPY).filter(p => p !== null && p !== undefined);
      if (!prices.length) return { ret: 0, min: 0, max: 0 };
      const finalP = prices[prices.length - 1];
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      return {
        ret: Number((((finalP - spy) / spy) * 100).toFixed(2)),
        min: Number((((minP - spy) / spy) * 100).toFixed(2)),
        max: Number((((maxP - spy) / spy) * 100).toFixed(2))
      };
    };

    const fwd20 = getForwardStats(20);
    const fwd60 = getForwardStats(60);

    const isHighOil = oil !== undefined && oil !== null && oil >= 85.0;

    const dayObj = {
      date: day.date,
      index: i,
      spy,
      oil: oil !== null && oil !== undefined ? Number(oil.toFixed(2)) : null,
      realYield: ry !== null && ry !== undefined ? Number(Number(ry).toFixed(2)) : null,
      vix: vix !== null && vix !== undefined ? Number(Number(vix).toFixed(2)) : null,
      distAthPct,
      fwd20,
      fwd60
    };

    if (isHighOil) {
      allHighOilDays.push(dayObj);

      if (!currentEpisode) {
        currentEpisode = {
          startDate: day.date,
          startSpy: spy,
          startAth: runningAth,
          maxOil: oil,
          days: [dayObj]
        };
      } else {
        if (oil > currentEpisode.maxOil) currentEpisode.maxOil = oil;
        currentEpisode.days.push(dayObj);
      }
    } else {
      if (oil !== null && oil !== undefined && oil < 80.0) {
        normalOilDays.push(dayObj);
      }
      if (currentEpisode) {
        currentEpisode.endDate = timeline[i - 1]?.date;
        currentEpisode.durationDays = currentEpisode.days.length;
        oilEpisodes.push(currentEpisode);
        currentEpisode = null;
      }
    }
  }

  if (currentEpisode) {
    currentEpisode.endDate = timeline[endIdx]?.date;
    currentEpisode.durationDays = currentEpisode.days.length;
    oilEpisodes.push(currentEpisode);
  }

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`📊 DATEN-EXTRAKTION:`);
  console.log(`  • Handelstage mit Öl >= $85.0: ${allHighOilDays.length} Tage`);
  console.log(`  • Abgegrenzte Öl-Stress-Episoden: ${oilEpisodes.length} Episoden`);
  console.log(`  • Referenztage mit normalem Öl (< $80): ${normalOilDays.length} Tage`);
  console.log(`--------------------------------------------------------------------------------\n`);

  // 1. Kohorten-Klassifikation auf Tages-Ebene
  // Kohorte A: Öl >= 85 & RealYield <= 2.0% (Entkoppelter Angebotsschock)
  const cohortA = allHighOilDays.filter(d => d.realYield !== null && d.realYield <= 2.00);
  // Kohorte B: Öl >= 85 & RealYield > 2.20% (Stagflations-Zange)
  const cohortB = allHighOilDays.filter(d => d.realYield !== null && d.realYield > 2.20);
  // Kohorte B_Extreme: Öl >= 95 & RealYield > 2.40% (Diskretes Hub-Regime STAGFLATION_PRESSURE)
  const cohortBExtreme = allHighOilDays.filter(d => d.oil >= 95.0 && d.realYield !== null && d.realYield > 2.40);
  // Kohorte B_ATH: Stagflations-Zange direkt am Allzeithoch (SPY >= -3.0% von ATH)
  const cohortB_ATH = cohortB.filter(d => d.distAthPct >= -3.0);
  // Kohorte B_Dip: Stagflations-Zange nach Korrektur (SPY < -5.0% von ATH)
  const cohortB_Dip = cohortB.filter(d => d.distAthPct < -5.0);

  const calcStats = (days, label) => {
    const n = days.length;
    if (!n) {
      console.log(`📈 ${label}: Keine Daten.\n`);
      return null;
    }
    const win20 = (days.filter(d => d.fwd20.ret > 0).length / n) * 100;
    const win60 = (days.filter(d => d.fwd60.ret > 0).length / n) * 100;
    const avgRet20 = days.reduce((acc, d) => acc + d.fwd20.ret, 0) / n;
    const avgRet60 = days.reduce((acc, d) => acc + d.fwd60.ret, 0) / n;
    const avgDD20 = days.reduce((acc, d) => acc + d.fwd20.min, 0) / n;
    const avgDD60 = days.reduce((acc, d) => acc + d.fwd60.min, 0) / n;
    const avgRunup20 = days.reduce((acc, d) => acc + d.fwd20.max, 0) / n;
    const avgRunup60 = days.reduce((acc, d) => acc + d.fwd60.max, 0) / n;

    const crash20 = (days.filter(d => d.fwd20.min <= -5.0).length / n) * 100;
    const crash60 = (days.filter(d => d.fwd60.min <= -10.0).length / n) * 100;
    const asymmetry20 = avgDD20 !== 0 ? (avgRunup20 / Math.abs(avgDD20)) : 99;

    console.log(`📈 ${label} (${n} Handelstage):`);
    console.log(`   • Win-Rate 20d: ${win20.toFixed(1)}% | Ø Return 20d: ${avgRet20 >= 0 ? '+' : ''}${avgRet20.toFixed(2)}% (Ø Max DD: ${avgDD20.toFixed(2)}%)`);
    console.log(`   • Win-Rate 60d: ${win60.toFixed(1)}% | Ø Return 60d: ${avgRet60 >= 0 ? '+' : ''}${avgRet60.toFixed(2)}% (Ø Max DD: ${avgDD60.toFixed(2)}%)`);
    console.log(`   • Drawdown-Gefahr (DD <= -5% in 20d):  ${crash20.toFixed(1)}%`);
    console.log(`   • Scharfe Korrektur (DD <= -10% in 60d): ${crash60.toFixed(1)}%`);
    console.log(`   • Asymmetrie 20d (Runup / DD): ${asymmetry20.toFixed(2)} : 1\n`);

    return {
      n,
      win20: Number(win20.toFixed(1)),
      win60: Number(win60.toFixed(1)),
      avgRet20: Number(avgRet20.toFixed(2)),
      avgRet60: Number(avgRet60.toFixed(2)),
      avgDD20: Number(avgDD20.toFixed(2)),
      avgDD60: Number(avgDD60.toFixed(2)),
      crash20: Number(crash20.toFixed(1)),
      crash60: Number(crash60.toFixed(1)),
      asymmetry20: Number(asymmetry20.toFixed(2))
    };
  };

  console.log('================================================================================');
  console.log('1. STATISTISCHE TAGES-AUSWERTUNG NACH ÖL- & ZINS-KOHORTEN');
  console.log('================================================================================');

  const statsA = calcStats(cohortA, '🟢 KOHORTE A: ÖL >= $85 & REALZINS <= 2.0% (Entkoppelter Angebotsschock / Frühjahrs-Typ)');
  const statsB = calcStats(cohortB, '🔴 KOHORTE B: ÖL >= $85 & REALZINS > 2.2% (Toxische Stagflations-Zange / Herbst-Typ)');
  const statsBExtreme = calcStats(cohortBExtreme, '🔴 KOHORTE B_EXTREME: ÖL >= $95 & REALZINS > 2.4% (Diskretes Hub-Regime STAGFLATION_PRESSURE)');
  const statsB_ATH = calcStats(cohortB_ATH, '⛔ SUB-KOHORTE B1: STAGFLATIONS-ZANGE AM ALLZEITHOCH (SPY <= 3% von ATH)');
  const statsB_Dip = calcStats(cohortB_Dip, '🎯 SUB-KOHORTE B2: STAGFLATIONS-ZANGE NACH KORREKTUR (SPY > 5% unter ATH)');
  const statsNormal = calcStats(normalOilDays, '⚪ REFERENZ: NORMALER ÖLPREIS (< $80)');

  // 2. Historische Episoden-Analyse
  console.log('================================================================================');
  console.log('2. DETAIL-ANALYSE DER HISTORISCHEN ÖL-EPISODEN (2020 - 2026)');
  console.log('================================================================================');

  const episodeDetails = [];

  for (const ep of oilEpisodes) {
    const nDays = ep.days.length;
    if (nDays < 3) continue; // Nur signifikante Episoden >= 3 Tage

    const avgOil = ep.days.reduce((s, d) => s + d.oil, 0) / nDays;
    const validRy = ep.days.filter(d => d.realYield !== null);
    const avgRy = validRy.length ? (validRy.reduce((s, d) => s + d.realYield, 0) / validRy.length) : 0;
    
    const firstSpy = ep.days[0].spy;
    const lastSpy = ep.days[ep.days.length - 1].spy;
    const spyDuringDelta = ((lastSpy - firstSpy) / firstSpy) * 100;

    const maxDD60 = Math.min(...ep.days.map(d => d.fwd60.min));
    const finalRet60 = ep.days[ep.days.length - 1].fwd60.ret;

    const isClamp = avgRy > 2.15;
    const isMild = avgRy <= 2.0;

    let verdict = '';
    if (isClamp) {
      if (spyDuringDelta < -3.0 || maxDD60 < -8.0) {
        verdict = '🔴 TOXISCHE STAGFLATIONS-ZANGE (Markt drastisch korrigiert / Multiple Compression)';
      } else {
        verdict = '⚠️ ZÄHE STAGNATION AM HOCH (Ausbruch erfolgreich abgewürgt)';
      }
    } else if (isMild) {
      if (finalRet60 > 5.0 || spyDuringDelta > 0) {
        verdict = '🟢 ENTBRANNTER REBOUND (Öl-Schock voll absorbiert / Dip-Buying hochprofitabel)';
      } else {
        verdict = '🟡 REGULÄRE KORREKTUR';
      }
    } else {
      verdict = '🟡 TRANSITIONALES REGIME';
    }

    episodeDetails.push({
      start: ep.startDate,
      end: ep.endDate,
      durationDays: nDays,
      avgOil: Number(avgOil.toFixed(1)),
      maxOil: Number(ep.maxOil.toFixed(1)),
      avgRy: Number(avgRy.toFixed(2)),
      spyStart: firstSpy,
      spyEnd: lastSpy,
      spyDuringDelta: (spyDuringDelta >= 0 ? '+' : '') + spyDuringDelta.toFixed(1) + '%',
      maxDD60: maxDD60.toFixed(1) + '%',
      finalRet60: (finalRet60 >= 0 ? '+' : '') + finalRet60.toFixed(1) + '%',
      verdict
    });

    console.log(`[${ep.startDate} bis ${ep.endDate}] (${nDays} Tage)`);
    console.log(`  • Öl: Ø $${avgOil.toFixed(1)} (Peak: $${ep.maxOil.toFixed(1)}) | Realzins: Ø ${avgRy.toFixed(2)}%`);
    console.log(`  • SPY während Episode: $${firstSpy} -> $${lastSpy} (${(spyDuringDelta >= 0 ? '+' : '') + spyDuringDelta.toFixed(1)}%)`);
    console.log(`  • 60-Tage-Folgefenster: Max DD: ${maxDD60.toFixed(1)}% | Return D+60: ${(finalRet60 >= 0 ? '+' : '') + finalRet60.toFixed(1)}%`);
    console.log(`  👉 Urteil: ${verdict}\n`);
  }

  // 3. Speichern der Ergebnisse
  fs.writeFileSync('data/cache/portfolio_compass/adr006_test_results.json', JSON.stringify({
    totalHighOilDays: allHighOilDays.length,
    cohorts: {
      cohortA_MildYield: statsA,
      cohortB_StagflationClamp: statsB,
      cohortB_ExtremeClamp: statsBExtreme,
      cohortB_ATH_Cap: statsB_ATH,
      cohortB_Dip_Climax: statsB_Dip,
      referenceNormalOil: statsNormal
    },
    episodeCount: episodeDetails.length,
    episodes: episodeDetails
  }, null, 2));

  console.log('✅ Ergebnisse erfolgreich in data/cache/portfolio_compass/adr006_test_results.json gespeichert!');

  await expert.close();
}

runOilYieldClampBacktest().catch(console.error);
