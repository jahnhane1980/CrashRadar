import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { LiquiditySensorHub } from '../../src/signals/hubs/LiquiditySensorHub.js';
import { SignalStatus } from '../../src/signals/contracts/SignalTypes.js';

dotenv.config();

async function runBacktest() {
  console.log('================================================================================');
  console.log('   GROSSER HÄRTETEST ADR-001: GELDMARKT-AIRBAG-THESE (2020 - 2026)');
  console.log('   KANN DER LIQUIDITY-SENSORHUB VIX-PANIK IN DIP-KAUF VS. CRASH UNTERSCHEIDEN?');
  console.log('================================================================================\n');

  const expert = new FinanceExpert();
  // Lade ab 2018 für warme Indikatoren
  const timeline = await expert.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})`);

  const startIdx = timeline.findIndex(t => t.date >= '2020-01-01');
  const endIdx = timeline.findLastIndex(t => t.date <= '2026-09-14');

  console.log(`Analysiere Testfenster: ${timeline[startIdx].date} bis ${timeline[endIdx].date} (${endIdx - startIdx + 1} Tage)\n`);

  const liqHub = new LiquiditySensorHub();

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

      const dayResult = {
        date: day.date,
        index: i,
        spy,
        vix,
        liqStatus: liqRes.status,
        liqRegime: liqRes.regime,
        dualStress: liqRes.diagnostics?.dualMacroStress ?? 0,
        isToxicTrap: Boolean(liqRes.diagnostics?.isToxicTrap),
        ttcDays: liqRes.ttcDays,
        isBuffered: Boolean(liqRes.diagnostics?.isBuffered),
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
  console.log(`  • Tage mit VIX >= 25.0:       ${allVixDays.length} Handelstage`);
  console.log(`  • Abgegrenzte Panik-Episoden: ${panicEpisodes.length} Episoden`);
  console.log(`--------------------------------------------------------------------------------\n`);

  // 1. Auswertung auf Einzeltag-Ebene
  const okDays = allVixDays.filter(d => d.liqStatus === SignalStatus.OK);
  const warnDays = allVixDays.filter(d => d.liqStatus === SignalStatus.WARNING);
  const critDays = allVixDays.filter(d => d.liqStatus === SignalStatus.CRITICAL);

  const calcStats = (days, label) => {
    if (!days.length) return;
    const n = days.length;
    const avgDD20 = days.reduce((acc, d) => acc + d.fwd20.minReturn, 0) / n;
    const avgDD60 = days.reduce((acc, d) => acc + d.fwd60.minReturn, 0) / n;
    const avgRet20 = days.reduce((acc, d) => acc + d.fwd20.finalReturn, 0) / n;
    const avgRet60 = days.reduce((acc, d) => acc + d.fwd60.finalReturn, 0) / n;
    const win20 = (days.filter(d => d.fwd20.finalReturn > 0).length / n) * 100;
    const win60 = (days.filter(d => d.fwd60.finalReturn > 0).length / n) * 100;
    const crashes20 = days.filter(d => d.fwd20.minReturn <= -10.0).length;
    const crashes60 = days.filter(d => d.fwd60.minReturn <= -15.0).length;

    console.log(`📈 ${label} (${n} Tage):`);
    console.log(`   • Win-Rate 20d:       ${win20.toFixed(1)}% | Ø Return 20d: ${avgRet20 >= 0 ? '+' : ''}${avgRet20.toFixed(2)}% (Ø Max DD: ${avgDD20.toFixed(2)}%)`);
    console.log(`   • Win-Rate 60d:       ${win60.toFixed(1)}% | Ø Return 60d: ${avgRet60 >= 0 ? '+' : ''}${avgRet60.toFixed(2)}% (Ø Max DD: ${avgDD60.toFixed(2)}%)`);
    console.log(`   • Crash-Quote (DD > 10% in 20d): ${crashes20} von ${n} (${((crashes20 / n) * 100).toFixed(1)}%)`);
    console.log(`   • Crash-Quote (DD > 15% in 60d): ${crashes60} von ${n} (${((crashes60 / n) * 100).toFixed(1)}%)\n`);
  };

  console.log('================================================================================');
  console.log('1. STATISTISCHE AUSWERTUNG NACH LIQUIDITÄTS-STATUS (ALLE VIX >= 25 TAGE)');
  console.log('================================================================================');
  calcStats(okDays, 'KOHORTE A: LIQUIDITÄT OK (BUFFERED / EXPANSION)');
  calcStats(warnDays, 'KOHORTE B: LIQUIDITÄT WARNING (DRAIN WARNING)');
  calcStats(critDays, 'KOHORTE C: LIQUIDITÄT CRITICAL (CRITICAL DRAIN / TOXISCHE FALLE)');

  // 2. Episoden-Analyse
  console.log('================================================================================');
  console.log('2. DETAIL-ANALYSE DER HISTORISCHEN PANIK-EPISODEN (2020 - 2026)');
  console.log('================================================================================');

  const episodeDetails = [];

  for (const ep of panicEpisodes) {
    const firstDay = ep.days[0];
    const peakVixDay = ep.days.reduce((max, d) => d.vix > max.vix ? d : max, firstDay);
    
    // Hat die Episode einen Crash ausgelöst? (Max Drawdown im Folgefenster > -10%)
    const maxEpisodeDD20 = Math.min(...ep.days.map(d => d.fwd20.minReturn));
    const maxEpisodeDD60 = Math.min(...ep.days.map(d => d.fwd60.minReturn));
    const finalRet60 = ep.days[ep.days.length - 1].fwd60.finalReturn;

    // Was hat der LiquidityHub signalisiert?
    const hasCritical = ep.days.some(d => d.liqStatus === SignalStatus.CRITICAL);
    const hasWarning = ep.days.some(d => d.liqStatus === SignalStatus.WARNING);
    const dominantStatus = hasCritical ? 'CRITICAL' : (hasWarning ? 'WARNING' : 'OK');
    const dominantRegime = ep.days[0].liqRegime;

    const isTrueCrash = maxEpisodeDD60 <= -10.0;
    const isMajorCrash = maxEpisodeDD60 <= -15.0;

    let classification = '';
    if (dominantStatus === 'CRITICAL' && isTrueCrash) {
      classification = '✅ PERFEKTER SCHUTZ (Crash korrekt geblockt)';
    } else if (dominantStatus === 'OK' && !isTrueCrash) {
      classification = '✅ PERFEKTER AIRBAG (Dip-Buying erfolgreich, kein Crash)';
    } else if (dominantStatus === 'CRITICAL' && !isTrueCrash) {
      classification = '⚠️ FEHLALARM (Zu vorsichtig geblockt, Markt erholte sich)';
    } else if (dominantStatus === 'OK' && isTrueCrash) {
      classification = '❌ FEHLSCHLAG (Liquidität OK, aber Markt crashte dennoch!)';
    } else {
      classification = '🟡 WARNUNG / ÜBERGANG';
    }

    episodeDetails.push({
      start: ep.startDate,
      end: ep.endDate,
      durationDays: ep.durationDays,
      startSpy: ep.startSpy,
      maxVix: ep.maxVix.toFixed(1),
      dominantStatus,
      dominantRegime,
      maxEpisodeDD60: maxEpisodeDD60.toFixed(1) + '%',
      finalRet60: (finalRet60 >= 0 ? '+' : '') + finalRet60.toFixed(1) + '%',
      classification
    });

    console.log(`[${ep.startDate} bis ${ep.endDate}] (${ep.durationDays} Tage | Max VIX: ${ep.maxVix.toFixed(1)})`);
    console.log(`  • Start SPY: $${ep.startSpy} | Max Folge-DD (60d): ${maxEpisodeDD60.toFixed(1)}% | Return D+60: ${finalRet60.toFixed(1)}%`);
    console.log(`  • Liquidity Status: ${dominantStatus} (${dominantRegime})`);
    console.log(`  👉 Urteil: ${classification}\n`);
  }

  // 3. Matrix-Zusammenfassung der Hypothese
  console.log('================================================================================');
  console.log('3. ERGEBNIS-SYNTHESE FÜR ADR-001 (HYPOTHESEN-BEWEIS)');
  console.log('================================================================================');
  
  const totalEpisodes = episodeDetails.length;
  const perfectAirbag = episodeDetails.filter(e => e.classification.includes('PERFEKTER AIRBAG')).length;
  const perfectProtection = episodeDetails.filter(e => e.classification.includes('PERFEKTER SCHUTZ')).length;
  const falseAlarm = episodeDetails.filter(e => e.classification.includes('FEHLALARM')).length;
  const fatalMiss = episodeDetails.filter(e => e.classification.includes('FEHLSCHLAG')).length;
  const warningTransition = episodeDetails.filter(e => e.classification.includes('WARNUNG')).length;

  console.log(`Gesamtzahl Panik-Episoden (VIX >= 25): ${totalEpisodes}`);
  console.log(`  ✅ Korrekt geschützt (Crash bei CRITICAL):         ${perfectProtection} (${((perfectProtection/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  ✅ Korrekt gekauft (Airbag intakt, Dip bei OK):    ${perfectAirbag} (${((perfectAirbag/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  ⚠️ Fehlalarm (CRITICAL gemeldet, aber kein Crash): ${falseAlarm} (${((falseAlarm/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  ❌ Fehlschlag (OK gemeldet, aber Crash passiert):  ${fatalMiss} (${((fatalMiss/totalEpisodes)*100).toFixed(1)}%)`);
  console.log(`  🟡 Warnung / Übergang:                             ${warningTransition} (${((warningTransition/totalEpisodes)*100).toFixed(1)}%)\n`);

  fs.writeFileSync('data/cache/portfolio_compass/adr001_test_results.json', JSON.stringify({
    allVixDaysCount: allVixDays.length,
    totalEpisodes,
    perfectAirbag,
    perfectProtection,
    falseAlarm,
    fatalMiss,
    warningTransition,
    episodeDetails
  }, null, 2));

  await expert.close();
}

runBacktest().catch(console.error);
