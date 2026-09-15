import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';

dotenv.config();

/**
 * GROSSER HÄRTETEST ADR-009: BULL-STEEPENER-FALLE-THESE (1999 - 2026)
 * 
 * Überprüft empirisch:
 * 1. Teil A (Die Erleichterungs-Bull-Trap): Tritt nach Zinskurven-Entinversion (T10Y2Y > +0.05%)
 *    zunächst eine temporäre Erleichterungs-Rallye auf?
 * 2. Teil B (Der unvermeidliche Bärenmarkt-Lag): Folgt in einem Zeitfenster von 60 bis 250 Handelstagen
 *    ein Bärenmarkt / schwere Korrektur von >= -15.0%?
 * 3. Differenzierung Bull Steepener (Yield2y stürzt ab) vs. Bear Steepener (Yield10y steigt).
 * 4. Chaos-Engineering & Sensitivitäts-Check (Noise Injection & Schwellenwerte).
 */
async function runBullSteepenerTest() {
  console.log('================================================================================');
  console.log('   GROSSER HÄRTETEST ADR-009: BULL-STEEPENER-FALLE-THESE (1999 - 2026)');
  console.log('   ZINSKURVEN-ENTINVERSION (T10Y2Y) VS. REZESSIONS- UND BÄRENMARKT-LAG');
  console.log('================================================================================\n');

  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('1999-12-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})\n`);

  // Extraktions-Helfer für tägliche Messwerte
  function getSpread(day) {
    const s = day?.macroGroups?.YieldCurve?.Spread10y2y ?? day?.macro?.Spread10y2y ?? day?.macro?.T10Y2Y;
    return s !== undefined && s !== null ? Number(s) : null;
  }

  function getYield10(day) {
    const y = day?.macroGroups?.YieldCurve?.Yield10y ?? day?.macro?.Yield10y;
    return y !== undefined && y !== null ? Number(y) : null;
  }

  function getYield2(day) {
    const y = day?.macroGroups?.YieldCurve?.Yield2y ?? day?.macro?.Yield2y;
    return y !== undefined && y !== null ? Number(y) : null;
  }

  function getRealYield(day) {
    const ry = day?.macroGroups?.FinancialConditions?.RealYield10y ?? day?.macro?.RealYield10y ?? day?.macro?.DFII10;
    return ry !== undefined && ry !== null ? Number(ry) : null;
  }

  function getSahm(day) {
    const s = day?.macroGroups?.Leading?.SahmRule ?? day?.macro?.SahmRule;
    return s !== undefined && s !== null ? Number(s) : null;
  }

  function getInitialClaims(day) {
    const c = day?.macroGroups?.Contemporaneous?.InitialClaims ?? day?.macro?.InitialClaims ?? day?.macro?.ICSA;
    return c !== undefined && c !== null ? Number(c) : null;
  }

  // 1. Algorithmus zur Erkennung makroökonomischer Entinversions-Episoden
  function detectDisinversionEpisodes(dataTimeline, minInversionTradingDays = 60, spreadThreshold = 0.05, noiseBps = 0) {
    const episodes = [];
    let inInversionCycle = false;
    let inversionStartIdx = -1;
    let negativeDaysCount = 0;
    let cooldownUntilIdx = -1;

    for (let i = 0; i < dataTimeline.length; i++) {
      if (i < cooldownUntilIdx) continue;

      const day = dataTimeline[i];
      let spread = getSpread(day);
      if (spread === null) continue;

      // Noise Injection für Chaos-Engineering
      if (noiseBps !== 0) {
        // Deterministischer Pseudo-Zufall basierend auf Index
        const pseudoNoise = (Math.sin(i * 12.9898) * (noiseBps / 100));
        spread += pseudoNoise;
      }

      if (spread < 0) {
        if (!inInversionCycle) {
          inInversionCycle = true;
          inversionStartIdx = i;
          negativeDaysCount = 1;
        } else {
          negativeDaysCount++;
        }
      } else if (spread >= spreadThreshold && inInversionCycle) {
        // Prüfen, ob die vorangegangene Inversion substanziell war
        const totalSpan = i - inversionStartIdx;
        if (negativeDaysCount >= minInversionTradingDays && totalSpan >= minInversionTradingDays) {
          // Entinversion bestätigt!
          episodes.push({
            inversionStartDate: dataTimeline[inversionStartIdx].date,
            inversionStartIdx,
            disinversionDate: day.date,
            disinversionIdx: i,
            negativeTradingDays: negativeDaysCount,
            totalCalendarDaysSpan: Math.round((new Date(day.date) - new Date(dataTimeline[inversionStartIdx].date)) / (1000 * 60 * 60 * 24)),
            spreadAtSignal: Number(spread.toFixed(2))
          });

          // Reset und Cooldown von mindestens 200 Handelstagen, um Flackern zu verhindern
          inInversionCycle = false;
          negativeDaysCount = 0;
          cooldownUntilIdx = i + 200;
        } else {
          // Zu kurz für echten Makrozyklus
          inInversionCycle = false;
          negativeDaysCount = 0;
        }
      }
    }

    return episodes;
  }

  // 2. Hauptlauf mit Standard-Parametern: min 60 negative Handelstage (~3-4 Monate), Schwellenwert +0.05%
  const detectedEpisodes = detectDisinversionEpisodes(timeline, 60, 0.05, 0);
  console.log(`Identifizierte historische Makro-Entinversionen: ${detectedEpisodes.length}\n`);

  const evaluatedEpisodes = [];

  for (const ep of detectedEpisodes) {
    const idx0 = ep.disinversionIdx;
    const day0 = timeline[idx0];
    const spy0 = day0.assets?.SPY;

    if (!spy0) continue;

    const y10_0 = getYield10(day0);
    const y2_0 = getYield2(day0);
    const ry0 = getRealYield(day0);
    const sahm0 = getSahm(day0);
    const claims0 = getInitialClaims(day0);

    // Steepener-Typisierung über die ersten 30 Handelstage nach Signal
    const day30 = timeline[Math.min(timeline.length - 1, idx0 + 30)];
    const y10_30 = getYield10(day30);
    const y2_30 = getYield2(day30);
    
    let steepenerType = 'UNKNOWN';
    if (y10_0 !== null && y2_0 !== null && y10_30 !== null && y2_30 !== null) {
      const delta2y = y2_30 - y2_0;
      const delta10y = y10_30 - y10_0;
      if (delta2y < delta10y && delta2y < 0) {
        steepenerType = 'BULL_STEEPENER (2Y stürzt ab / Fed Cuts)';
      } else if (delta10y > delta2y && delta10y > 0) {
        steepenerType = 'BEAR_STEEPENER (10Y steigt / Inflations- & Angebotsschock)';
      } else {
        steepenerType = 'MIXED_STEEPENER';
      }
    }

    // Analyse über 250 Handelstage (~1 Jahr Forward)
    const forwardHorizon = 250;
    const futureSlice = timeline.slice(idx0, Math.min(timeline.length, idx0 + forwardHorizon + 1));
    const isOngoingCycle = futureSlice.length < forwardHorizon;

    let peakSpy = spy0;
    let peakIdx = 0;
    let peakDate = day0.date;

    let troughSpy = spy0;
    let troughIdx = 0;
    let troughDate = day0.date;

    let maxDdFromPeak = 0;
    let troughFromPeakSpy = spy0;
    let troughFromPeakIdx = 0;
    let troughFromPeakDate = day0.date;

    for (let f = 0; f < futureSlice.length; f++) {
      const p = futureSlice[f].assets?.SPY;
      if (!p) continue;

      if (p > peakSpy) {
        peakSpy = p;
        peakIdx = f;
        peakDate = futureSlice[f].date;
      }

      if (p < troughSpy) {
        troughSpy = p;
        troughIdx = f;
        troughDate = futureSlice[f].date;
      }
    }

    // Maximaler Drawdown ab dem erreichten Peak
    for (let f = peakIdx; f < futureSlice.length; f++) {
      const p = futureSlice[f].assets?.SPY;
      if (!p) continue;
      const dd = ((p - peakSpy) / peakSpy) * 100;
      if (dd < maxDdFromPeak) {
        maxDdFromPeak = dd;
        troughFromPeakSpy = p;
        troughFromPeakIdx = f;
        troughFromPeakDate = futureSlice[f].date;
      }
    }

    const runUpPct = Number((((peakSpy - spy0) / spy0) * 100).toFixed(2));
    const maxDDPct = Number((((troughSpy - spy0) / spy0) * 100).toFixed(2));
    const maxDdFromPeakPct = Number(maxDdFromPeak.toFixed(2));

    // Feste Zeithorizonte D+30, D+60, D+120, D+180, D+250
    const getReturnAt = (days) => {
      const targetIdx = Math.min(timeline.length - 1, idx0 + days);
      const targetP = timeline[targetIdx]?.assets?.SPY;
      if (!targetP || targetIdx <= idx0) return null;
      return Number((((targetP - spy0) / spy0) * 100).toFixed(2));
    };

    const ret30 = getReturnAt(30);
    const ret60 = getReturnAt(60);
    const ret120 = getReturnAt(120);
    const ret180 = getReturnAt(180);
    const ret250 = getReturnAt(250);

    // Kriterien-Bewertung:
    // Bärenmarkt-Falle: Wenn nach Erleichterungs-Rallye ein Drawdown von >= -15.0% eintritt
    const isSevereCrash = maxDdFromPeakPct <= -15.0 || maxDDPct <= -15.0;
    const isCorrection = maxDdFromPeakPct <= -10.0 || maxDDPct <= -10.0;

    evaluatedEpisodes.push({
      cycleName: `${ep.disinversionDate.substring(0, 4)} Zyklus`,
      inversionStartDate: ep.inversionStartDate,
      disinversionDate: ep.disinversionDate,
      negativeTradingDays: ep.negativeTradingDays,
      totalCalendarDaysSpan: ep.totalCalendarDaysSpan,
      spreadAtSignal: ep.spreadAtSignal,
      spyAtSignal: Number(spy0.toFixed(2)),
      yield10_at_signal: y10_0,
      yield2_at_signal: y2_0,
      realYield_at_signal: ry0,
      sahmRule_at_signal: sahm0,
      initialClaims_at_signal: claims0,
      steepenerType,
      forwardWindowTradingDays: futureSlice.length - 1,
      isOngoingCycle,
      // Teil A: Erleichterungs-Rallye (Bull Trap)
      runUpPct,
      peakSpy: Number(peakSpy.toFixed(2)),
      peakDate,
      daysToPeak: peakIdx,
      // Teil B: Bärenmarkt / Crash
      maxDDPct,
      maxDdFromPeakPct,
      troughSpy: Number(troughSpy.toFixed(2)),
      troughDate,
      daysToTrough: troughIdx,
      troughFromPeakDate,
      daysFromPeakToTrough: troughFromPeakIdx - peakIdx,
      // Returns
      ret30,
      ret60,
      ret120,
      ret180,
      ret250,
      // Status
      isSevereCrash,
      isCorrection,
      verdict: isSevereCrash ? 'CONFIRMED_BULL_TRAP_CRASH (>= -15% DD)' : (isCorrection ? 'MODERATE_CORRECTION (>= -10% DD)' : (isOngoingCycle ? 'ONGOING_CYCLE' : 'SOFT_LANDING'))
    });
  }

  // 3. Ausgabe der Episoden
  console.log('--------------------------------------------------------------------------------');
  console.log('DETAIL-AUSWERTUNG DER HISTORISCHEN ENTINVERSIONEN:');
  console.log('--------------------------------------------------------------------------------\n');

  for (const ep of evaluatedEpisodes) {
    console.log(`📌 [${ep.disinversionDate}] ${ep.cycleName}`);
    console.log(`   • Vorherige Inversion: ${ep.inversionStartDate} bis ${ep.disinversionDate} (${ep.negativeTradingDays} Inversionstage über ${ep.totalCalendarDaysSpan} Kalendertage)`);
    console.log(`   • Spread am Signal: +${ep.spreadAtSignal}% | SPY: $${ep.spyAtSignal}`);
    console.log(`   • Makro-Umfeld: 10Y: ${ep.yield10_at_signal}% | 2Y: ${ep.yield2_at_signal}% | Realzins: ${ep.realYield_at_signal ?? 'N/A'}% | Sahm: ${ep.sahmRule_at_signal ?? 'N/A'}`);
    console.log(`   • Zinskurven-Dynamik: ${ep.steepenerType}`);
    console.log(`   • Teil A (Erleichterungs-Rallye): Max Run-Up +${ep.runUpPct}% (Peak bei $${ep.peakSpy} am ${ep.peakDate} nach ${ep.daysToPeak} Handelstagen)`);
    console.log(`   • Teil B (Crash/Drawdown): Max Drawdown ${ep.maxDdFromPeakPct}% ab Peak (Tief bei $${ep.troughSpy} am ${ep.troughDate}, Lag: ${ep.daysToTrough} Handelstage ab Signal)`);
    console.log(`   • Forward Returns: D+30: ${ep.ret30}% | D+60: ${ep.ret60}% | D+120: ${ep.ret120}% | D+180: ${ep.ret180}% | D+250: ${ep.ret250 ?? 'N/A'}%`);
    console.log(`   👉 Ergebnis: ${ep.verdict} ${ep.isOngoingCycle ? '⏳ (Zyklus läuft noch)' : ''}\n`);
  }

  // 4. Aggregierte Statistik & Hypothesenprüfung (Abgeschlossene Zyklen)
  const completedCycles = evaluatedEpisodes.filter(e => !e.isOngoingCycle);
  const severeCrashCount = completedCycles.filter(e => e.isSevereCrash).length;
  const correctionCount = completedCycles.filter(e => e.isCorrection).length;
  const severeCrashRate = completedCycles.length ? (severeCrashCount / completedCycles.length) * 100 : 0;
  const avgRunUp = completedCycles.length ? (completedCycles.reduce((s, e) => s + e.runUpPct, 0) / completedCycles.length) : 0;
  const avgDaysToPeak = completedCycles.length ? (completedCycles.reduce((s, e) => s + e.daysToPeak, 0) / completedCycles.length) : 0;
  const avgMaxDDFromPeak = completedCycles.length ? (completedCycles.reduce((s, e) => s + e.maxDdFromPeakPct, 0) / completedCycles.length) : 0;
  const avgDaysToTrough = completedCycles.length ? (completedCycles.reduce((s, e) => s + e.daysToTrough, 0) / completedCycles.length) : 0;

  console.log('================================================================================');
  console.log('   STATISTISCHE HYPOTHESEN-PRÜFUNG ADR-009');
  console.log('================================================================================');
  console.log(`  • Abgeschlossene historische Makro-Zyklen: ${completedCycles.length}`);
  console.log(`  • Schwere Bärenmärkte (Drawdown >= -15% ab Peak): ${severeCrashCount} von ${completedCycles.length} (${severeCrashRate.toFixed(1)}%)`);
  console.log(`  • Signifikante Korrekturen (Drawdown >= -10% ab Peak): ${correctionCount} von ${completedCycles.length} (${((correctionCount/completedCycles.length)*100).toFixed(1)}%)`);
  console.log(`  • Durchschnittliche Erleichterungs-Rallye (Run-Up): +${avgRunUp.toFixed(2)}%`);
  console.log(`  • Durchschnittlicher Lag bis zum Allzeithoch-Peak: ${avgDaysToPeak.toFixed(0)} Handelstage (~${(avgDaysToPeak/21).toFixed(1)} Monate)`);
  console.log(`  • Durchschnittlicher maximaler Drawdown ab Peak: ${avgMaxDDFromPeak.toFixed(2)}%`);
  console.log(`  • Durchschnittlicher Lag bis zum Trough: ${avgDaysToTrough.toFixed(0)} Handelstage (~${(avgDaysToTrough/21).toFixed(1)} Monate)\n`);

  // 5. Chaos-Engineering: Deterministische Sensitivitätsprüfung & Noise-Injection
  console.log('--------------------------------------------------------------------------------');
  console.log('CHAOS-ENGINEERING & SENSITIVITÄTS-MATRIX (ANTI-OVERFITTING):');
  console.log('--------------------------------------------------------------------------------');

  const sensitivityScenarios = [
    { label: 'Standard (Threshold +0.05%, Min 60d Inversion)', thresh: 0.05, minDays: 60, noise: 0 },
    { label: 'Konservativ (Threshold +0.10%, Min 90d Inversion)', thresh: 0.10, minDays: 90, noise: 0 },
    { label: 'Aggressiv (Threshold 0.00%, Min 40d Inversion)', thresh: 0.00, minDays: 40, noise: 0 },
    { label: 'Chaos-Noise (+/- 5 bps synthetisches Rauschen)', thresh: 0.05, minDays: 60, noise: 5 },
    { label: 'Extrem-Noise (+/- 10 bps synthetisches Rauschen)', thresh: 0.05, minDays: 60, noise: 10 }
  ];

  const sensitivityResults = [];

  for (const scen of sensitivityScenarios) {
    const eps = detectDisinversionEpisodes(timeline, scen.minDays, scen.thresh, scen.noise);
    const datesStr = eps.map(e => e.disinversionDate).join(', ');
    console.log(`  • ${scen.label}: ${eps.length} Episoden gefunden [${datesStr}]`);
    sensitivityResults.push({
      scenario: scen.label,
      episodesFound: eps.length,
      dates: eps.map(e => e.disinversionDate)
    });
  }

  // 6. Validierungs-Urteil
  let validationStatus = 'UNDETERMINED';
  if (severeCrashRate >= 75.0) {
    validationStatus = 'VERIFIED_BULL_STEEPENER_TRAP';
    console.log('\n🏆 FAZIT: HYPOTHESE ADR-009 VOLLSTÄNDIG BESTÄTIGT (VERIFIED)!');
    console.log('   Die Zinskurven-Entinversion ist KEINE Entwarnung, sondern markiert deterministisch');
    console.log('   eine Erleichterungs-Rallye gefolgt von einem schweren Bärenmarkt (Quote >= 75%).');
  } else {
    validationStatus = 'FALSIFIED_OR_MIXED';
    console.log('\n⚠️ FAZIT: HYPOTHESE ADR-009 NICHT VERIFIZIERT.');
  }

  // 7. Speichern des Ergebnis-Datensatzes
  const resultsPayload = {
    testDate: new Date().toISOString(),
    totalTimelineDays: timeline.length,
    startDate: timeline[0]?.date,
    endDate: timeline[timeline.length - 1]?.date,
    evaluatedEpisodes,
    summaryCompletedCycles: {
      totalCompleted: completedCycles.length,
      severeCrashCount,
      severeCrashRate: Number(severeCrashRate.toFixed(1)),
      avgRunUpPct: Number(avgRunUp.toFixed(2)),
      avgDaysToPeak: Number(avgDaysToPeak.toFixed(0)),
      avgMaxDDFromPeakPct: Number(avgMaxDDFromPeak.toFixed(2)),
      avgDaysToTrough: Number(avgDaysToTrough.toFixed(0))
    },
    sensitivityMatrix: sensitivityResults,
    validationStatus
  };

  fs.writeFileSync(
    'scratch/research/DailyPortfolioCompass/adr009_test_results.json',
    JSON.stringify(resultsPayload, null, 2)
  );

  console.log('\n💾 Ergebnisse gespeichert in scratch/research/DailyPortfolioCompass/adr009_test_results.json');

  await expert.close();
}

runBullSteepenerTest().catch(console.error);
