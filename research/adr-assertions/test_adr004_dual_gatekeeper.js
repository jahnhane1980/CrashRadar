import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { LiquiditySensorHub } from '../../src/signals/hubs/LiquiditySensorHub.js';
import { GoldilocksSensorHub } from '../../src/signals/hubs/GoldilocksSensorHub.js';
import { SignalStatus, GoldilocksRegime } from '../../src/signals/contracts/SignalTypes.js';

dotenv.config();

async function runDualGatekeeperBacktest() {
  console.log('================================================================================');
  console.log('   GROSSER HÄRTETEST ADR-004: DUAL-GATEKEEPER-THESE (2020 - 2026)');
  console.log('   GELDMARKT-AIRBAG + GOLDILOCKS-VETO: BESEITIGUNG DER 2022ER BÄRENMARKT-FALLEN');
  console.log('================================================================================\n');

  const expert = new FinanceExpert();
  // Lade ab 2018 für warme Indikatoren und SMA200
  const timeline = await expert.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})`);

  const startIdx = timeline.findIndex(t => t.date >= '2020-01-01');
  const endIdx = timeline.findLastIndex(t => t.date <= '2026-09-14');

  console.log(`Analysiere Testfenster: ${timeline[startIdx].date} bis ${timeline[endIdx].date} (${endIdx - startIdx + 1} Tage)\n`);

  const liqHub = new LiquiditySensorHub();
  const goldiHub = new GoldilocksSensorHub();

  const allVixDays = [];
  const panicEpisodes = [];

  let currentEpisode = null;

  for (let i = startIdx; i <= endIdx; i++) {
    const day = timeline[i];
    const spy = day.assets?.SPY;
    const vix = day.assets?.VIX;

    if (!spy || vix === undefined || vix === null) continue;

    const isPanic = vix >= 25.0;

    if (isPanic) {
      const slice = timeline.slice(0, i + 1);
      const liqRes = liqHub.evaluate(slice);
      const goldiRes = goldiHub.evaluate(slice);

      // Forward-Performance berechnen (bis zu 60 Tage vorwärts)
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

      const isLiqOk = liqRes.status === SignalStatus.OK;
      const isGoldiOk = goldiRes.status === SignalStatus.OK;
      const isDualOk = isLiqOk && isGoldiOk;
      const isDualGateWithTrend = isLiqOk && (isGoldiOk || goldiRes.isAboveSma200);

      const dayResult = {
        date: day.date,
        index: i,
        spy,
        vix,
        liqStatus: liqRes.status,
        liqRegime: liqRes.regime,
        goldiStatus: goldiRes.status,
        goldiRegime: goldiRes.regime,
        goldiScore: goldiRes.score,
        isAboveSma200: Boolean(goldiRes.isAboveSma200),
        isDualOk,
        isDualGateWithTrend,
        fwd20,
        fwd60
      };

      allVixDays.push(dayResult);

      if (!currentEpisode) {
        currentEpisode = {
          startDate: day.date,
          startSpy: spy,
          startVix: vix,
          maxVix: vix,
          days: [dayResult]
        };
      } else {
        if (vix > currentEpisode.maxVix) currentEpisode.maxVix = vix;
        currentEpisode.days.push(dayResult);
      }
    } else {
      if (currentEpisode) {
        currentEpisode.endDate = timeline[i - 1]?.date;
        currentEpisode.durationDays = currentEpisode.days.length;
        panicEpisodes.push(currentEpisode);
        currentEpisode = null;
      }
    }
  }

  if (currentEpisode) {
    currentEpisode.endDate = timeline[endIdx]?.date;
    currentEpisode.durationDays = currentEpisode.days.length;
    panicEpisodes.push(currentEpisode);
  }

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`📊 DATEN-EXTRAKTION:`);
  console.log(`  • VIX >= 25.0 Tage:           ${allVixDays.length} Handelstage`);
  console.log(`  • Abgegrenzte Panik-Episoden: ${panicEpisodes.length} Episoden`);
  console.log(`--------------------------------------------------------------------------------\n`);

  // 1. Kohorten-Vergleich auf Tages-Ebene
  const cohortNaiveAirbag = allVixDays.filter(d => d.liqStatus === SignalStatus.OK);
  const cohortStrictDual = allVixDays.filter(d => d.liqStatus === SignalStatus.OK && d.goldiStatus === SignalStatus.OK);
  const cohortDualWithTrend = allVixDays.filter(d => d.liqStatus === SignalStatus.OK && (d.goldiStatus === SignalStatus.OK || d.isAboveSma200));
  const cohortConflictTrap = allVixDays.filter(d => d.liqStatus === SignalStatus.OK && d.goldiStatus !== SignalStatus.OK && !d.isAboveSma200);
  const cohortLiqCritical = allVixDays.filter(d => d.liqStatus === SignalStatus.CRITICAL);

  const calcCohortStats = (days, label) => {
    if (!days.length) {
      console.log(`📈 ${label}: Keine Tage gefunden.\n`);
      return null;
    }
    const n = days.length;
    const avgDD20 = days.reduce((acc, d) => acc + d.fwd20.minReturn, 0) / n;
    const avgDD60 = days.reduce((acc, d) => acc + d.fwd60.minReturn, 0) / n;
    const avgRet20 = days.reduce((acc, d) => acc + d.fwd20.finalReturn, 0) / n;
    const avgRet60 = days.reduce((acc, d) => acc + d.fwd60.finalReturn, 0) / n;
    const win20 = (days.filter(d => d.fwd20.finalReturn > 0).length / n) * 100;
    const win60 = (days.filter(d => d.fwd60.finalReturn > 0).length / n) * 100;
    const crashes10_20 = days.filter(d => d.fwd20.minReturn <= -10.0).length;
    const crashes15_60 = days.filter(d => d.fwd60.minReturn <= -15.0).length;

    console.log(`📈 ${label} (${n} Tage):`);
    console.log(`   • Win-Rate 20d:       ${win20.toFixed(1)}% | Ø Return 20d: ${avgRet20 >= 0 ? '+' : ''}${avgRet20.toFixed(2)}% (Ø Max DD: ${avgDD20.toFixed(2)}%)`);
    console.log(`   • Win-Rate 60d:       ${win60.toFixed(1)}% | Ø Return 60d: ${avgRet60 >= 0 ? '+' : ''}${avgRet60.toFixed(2)}% (Ø Max DD: ${avgDD60.toFixed(2)}%)`);
    console.log(`   • Scharfer Drawdown (DD <= -10% in 20d): ${crashes10_20} von ${n} (${((crashes10_20 / n) * 100).toFixed(1)}%)`);
    console.log(`   • Crash-Quote       (DD <= -15% in 60d): ${crashes15_60} von ${n} (${((crashes15_60 / n) * 100).toFixed(1)}%)\n`);

    return {
      n,
      win20: Number(win20.toFixed(1)),
      win60: Number(win60.toFixed(1)),
      avgRet20: Number(avgRet20.toFixed(2)),
      avgRet60: Number(avgRet60.toFixed(2)),
      avgDD20: Number(avgDD20.toFixed(2)),
      avgDD60: Number(avgDD60.toFixed(2)),
      crashes10_20,
      crashes15_60
    };
  };

  console.log('================================================================================');
  console.log('1. STATISTISCHE TAGES-AUSWERTUNG NACH GATEKEEPER-KOHORTEN');
  console.log('================================================================================');
  const statsNaive = calcCohortStats(cohortNaiveAirbag, 'KOHORTE 1: NAIVER AIRBAG (Nur Liquidität OK, ADR-001 Basis)');
  const statsStrictDual = calcCohortStats(cohortStrictDual, 'KOHORTE 2: STRIKTER DUAL-GATEKEEPER (Liquidität OK UND Goldilocks OK)');
  const statsDualWithTrend = calcCohortStats(cohortDualWithTrend, 'KOHORTE 3: DUAL-GATEKEEPER + TREND (Liquidität OK UND [Goldilocks OK ODER SPY > SMA200])');
  const statsConflict = calcCohortStats(cohortConflictTrap, 'KOHORTE 4: ZINS- & MULTIPLE-FALLE (Liquidität OK, ABER Goldilocks WARNUNG & SPY < SMA200)');
  const statsCrit = calcCohortStats(cohortLiqCritical, 'KOHORTE 5: LIQUIDITÄTS-KOLLAPS (Liquidität CRITICAL)');

  // 2. Episoden-Analyse
  console.log('================================================================================');
  console.log('2. DETAIL-ANALYSE DER HISTORISCHEN PANIK-EPISODEN (2020 - 2026)');
  console.log('================================================================================');

  const episodeDetails = [];

  for (const ep of panicEpisodes) {
    const firstDay = ep.days[0];
    const peakVixDay = ep.days.reduce((max, d) => d.vix > max.vix ? d : max, firstDay);
    
    const maxEpisodeDD20 = Math.min(...ep.days.map(d => d.fwd20.minReturn));
    const maxEpisodeDD60 = Math.min(...ep.days.map(d => d.fwd60.minReturn));
    const finalRet60 = ep.days[ep.days.length - 1].fwd60.finalReturn;

    // Signale der beiden Hubs
    const hasLiqCritical = ep.days.some(d => d.liqStatus === SignalStatus.CRITICAL);
    const hasLiqWarning = ep.days.some(d => d.liqStatus === SignalStatus.WARNING);
    const dominantLiqStatus = hasLiqCritical ? 'CRITICAL' : (hasLiqWarning ? 'WARNING' : 'OK');
    const dominantLiqRegime = ep.days[0].liqRegime;

    // Goldilocks Analyse
    const hasGoldiOk = ep.days.some(d => d.goldiStatus === SignalStatus.OK);
    const hasAboveSma = ep.days.some(d => d.isAboveSma200);
    const goldiRegimes = [...new Set(ep.days.map(d => d.goldiRegime))].join(', ');
    const dominantGoldiStatus = ep.days.filter(d => d.goldiStatus === SignalStatus.OK).length >= (ep.days.length / 2) ? 'OK' : 'WARNING';

    // Dual Gatekeeper Entscheidung für die Episode:
    // Erlaubt Dip-Buying, wenn Liquidität OK UND (Goldilocks OK ODER SPY > SMA200)
    const isApprovedByDualGate = dominantLiqStatus === 'OK' && (hasGoldiOk || hasAboveSma);
    const isVetoedByGoldi = dominantLiqStatus === 'OK' && (!hasGoldiOk && !hasAboveSma);

    const isSevereDrawdown = maxEpisodeDD60 <= -10.0; // Drawdown > 10%
    const isTrueCrash = maxEpisodeDD60 <= -15.0;     // Drawdown > 15%

    let verdict = '';
    if (dominantLiqStatus === 'CRITICAL') {
      if (isSevereDrawdown || isTrueCrash) {
        verdict = '✅ LIQUIDITÄTS-CRASH KORREKT GEBLOCKT';
      } else {
        verdict = '⚠️ LIQUIDITÄTS-FEHLALARM';
      }
    } else if (dominantLiqStatus === 'OK') {
      if (isApprovedByDualGate) {
        if (!isSevereDrawdown) {
          verdict = '🟢 DUAL-GATEKEEPER PERFEKT GEKAUFT (Airbag + Makro intakt)';
        } else {
          verdict = '❌ DUAL-GATEKEEPER FEHLSCHLAG (Unerwarteter Drawdown)';
        }
      } else if (isVetoedByGoldi) {
        if (isSevereDrawdown) {
          verdict = '🛡️ GOLDILOCKS-VETO ERFOLGREICH (2022er Bärenmarkt-Falle verhindert!)';
        } else {
          verdict = '🟡 ZU VORSICHTIGES VETO (Markt erholte sich trotzdem)';
        }
      }
    } else {
      verdict = '🟡 ÜBERGANG / WARNUNG';
    }

    episodeDetails.push({
      start: ep.startDate,
      end: ep.endDate,
      durationDays: ep.durationDays,
      startSpy: ep.startSpy,
      maxVix: ep.maxVix.toFixed(1),
      dominantLiqStatus,
      dominantLiqRegime,
      goldiRegimes,
      hasAboveSma,
      isApprovedByDualGate,
      isVetoedByGoldi,
      maxEpisodeDD60: maxEpisodeDD60.toFixed(1) + '%',
      finalRet60: (finalRet60 >= 0 ? '+' : '') + finalRet60.toFixed(1) + '%',
      verdict
    });

    console.log(`[${ep.startDate} bis ${ep.endDate}] (${ep.durationDays} Tage | Max VIX: ${ep.maxVix.toFixed(1)})`);
    console.log(`  • Start SPY: $${ep.startSpy} | Max Folge-DD (60d): ${maxEpisodeDD60.toFixed(1)}% | Return D+60: ${finalRet60.toFixed(1)}%`);
    console.log(`  • Liquidität: ${dominantLiqStatus} (${dominantLiqRegime}) | Goldilocks: [${goldiRegimes}] (Über SMA200: ${hasAboveSma})`);
    console.log(`  • DualGate: Erlaubt? ${isApprovedByDualGate} | Vetoed? ${isVetoedByGoldi}`);
    console.log(`  👉 Urteil: ${verdict}\n`);
  }

  // 3. Synthese & Zählung
  console.log('================================================================================');
  console.log('3. ERGEBNIS-SYNTHESE FÜR ADR-004 (BEWEIS DER DUAL-GATEKEEPER-THESE)');
  console.log('================================================================================');
  
  const totalEpisodes = episodeDetails.length;
  const perfectBuys = episodeDetails.filter(e => e.verdict.includes('DUAL-GATEKEEPER PERFEKT GEKAUFT')).length;
  const perfectVetoes = episodeDetails.filter(e => e.verdict.includes('GOLDILOCKS-VETO ERFOLGREICH')).length;
  const falseVetoes = episodeDetails.filter(e => e.verdict.includes('ZU VORSICHTIGES VETO')).length;
  const dualFailures = episodeDetails.filter(e => e.verdict.includes('DUAL-GATEKEEPER FEHLSCHLAG')).length;
  const liqProtected = episodeDetails.filter(e => e.verdict.includes('LIQUIDITÄTS-CRASH KORREKT GEBLOCKT')).length;
  const liqFalseAlarms = episodeDetails.filter(e => e.verdict.includes('LIQUIDITÄTS-FEHLALARM')).length;
  const warnings = episodeDetails.filter(e => e.verdict.includes('ÜBERGANG / WARNUNG')).length;

  console.log(`Gesamtzahl Panik-Episoden (VIX >= 25): ${totalEpisodes}`);
  console.log(`  🟢 Dual-Gatekeeper Perfekt gekauft (Airbag + Goldi intakt): ${perfectBuys} (${((perfectBuys/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  🛡️ Goldilocks-Veto Erfolgreich (Bärenmarkt-Falle verhindert): ${perfectVetoes} (${((perfectVetoes/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  🟡 Goldilocks-Veto Zu vorsichtig (Chancen verpasst):         ${falseVetoes} (${((falseVetoes/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  ❌ Dual-Gatekeeper Echter Fehlschlag:                        ${dualFailures} (${((dualFailures/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  ✅ Liquiditäts-Hub Schutz vor echtem Crash (Corona 2020):    ${liqProtected} (${((liqProtected/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  ⚠️ Liquiditäts-Hub Fehlalarme (April/Okt 2025):              ${liqFalseAlarms} (${((liqFalseAlarms/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  🟡 Warnung / Übergangsphasen:                                ${warnings} (${((warnings/totalEpisodes)*100).toFixed(1)}%)\n`);

  fs.writeFileSync('data/cache/portfolio_compass/adr004_test_results.json', JSON.stringify({
    allVixDaysCount: allVixDays.length,
    cohorts: {
      naive: statsNaive,
      strictDual: statsStrictDual,
      dualWithTrend: statsDualWithTrend,
      conflictTrap: statsConflict,
      liqCritical: statsCrit
    },
    totalEpisodes,
    perfectBuys,
    perfectVetoes,
    falseVetoes,
    dualFailures,
    liqProtected,
    liqFalseAlarms,
    warnings,
    episodeDetails
  }, null, 2));

  console.log('✅ Ergebnisse erfolgreich in data/cache/portfolio_compass/adr004_test_results.json gespeichert!');

  await expert.close();
}

runDualGatekeeperBacktest().catch(console.error);
