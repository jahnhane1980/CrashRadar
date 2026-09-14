import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { MacroLiquiditySensorHub, MacroLiquidityRegime } from '../../../src/signals/hubs/MacroLiquiditySensorHub.js';
import { SignalStatus } from '../../../src/signals/contracts/SignalTypes.js';

dotenv.config();

/**
 * TestGeopoliticalOilLiquidityStress
 * 
 * Empirischer Stresstest: Wie verhalten sich der S&P 500 (SPY), Renditen (10Y, 2Y)
 * und High-Beta Werte in den folgenden 30, 60 und 90 Tagen, wenn ein geopolitischer
 * Öl-Schock auf ein kippendes oder fragiles Liquiditäts-Umfeld trifft?
 */
async function runStresstest() {
  console.log('================================================================================');
  console.log('   EMPIRISCHER STRESSTEST: GEOPOLITISCHER ÖL-SCHOCK & LIQUIDITÄTS-STRESS');
  console.log('   Untersuchung von T+30, T+60 und T+90 Tagen am S&P 500 (2000 - 2026)');
  console.log('================================================================================\n');

  const fe = new FinanceExpert();
  console.log('[1/4] Lade Gesamte-Markt-Timeline aus der Datenbank (ab 2004)...');
  const rawTimeline = await fe.getDailyGroupedData('2004-01-01', { bypassMemoryGuard: true });
  console.log(`      ✓ ${rawTimeline.length} Tage erfolgreich geladen (${rawTimeline[0].date} bis ${rawTimeline[rawTimeline.length - 1].date}).`);

  console.log('\n[2/4] Initialisiere MacroLiquiditySensorHub (Master Composite)...');
  const hub = new MacroLiquiditySensorHub();

  console.log('\n[3/4] Führe kontinuierliche historische Auswertung durch...');
  
  const episodes = [];
  let inEpisode = false;
  let currentEpisode = null;

  // Wir werten jeden Handelstag ab Tag 60 aus
  for (let i = 60; i < rawTimeline.length; i++) {
    const sliceUntilToday = rawTimeline.slice(0, i + 1);
    const day = rawTimeline[i];
    const res = hub.evaluate(sliceUntilToday);

    const isStagflationAlert = res.regime === MacroLiquidityRegime.STAGFLATION_LIQUIDITY_TRAP || 
                              res.regime === MacroLiquidityRegime.CRITICAL_COLLISION ||
                              (res.compositeScore >= 60 && res.diagnostics.geopoliticalCost?.status !== SignalStatus.OK);

    if (isStagflationAlert) {
      if (!inEpisode) {
        inEpisode = true;
        currentEpisode = {
          startDate: day.date,
          startIdx: i,
          startSpy: day.assets?.SPY,
          startOil: day.assets?.Oil,
          start10y: day.macroGroups?.YieldCurve?.Yield10y,
          start2y: day.macroGroups?.YieldCurve?.Yield2y,
          startSpread: day.macroGroups?.YieldCurve?.Spread10y2y,
          regime: res.regime,
          maxScore: res.compositeScore,
          daysInAlert: 1
        };
      } else {
        currentEpisode.daysInAlert++;
        if (res.compositeScore > currentEpisode.maxScore) {
          currentEpisode.maxScore = res.compositeScore;
          currentEpisode.regime = res.regime;
        }
      }
    } else {
      if (inEpisode) {
        inEpisode = false;
        currentEpisode.endDate = rawTimeline[i - 1].date;
        currentEpisode.endIdx = i - 1;
        episodes.push(currentEpisode);
        currentEpisode = null;
      }
    }
  }

  if (inEpisode && currentEpisode) {
    currentEpisode.endDate = rawTimeline[rawTimeline.length - 1].date;
    currentEpisode.endIdx = rawTimeline.length - 1;
    episodes.push(currentEpisode);
  }

  console.log(`      ✓ ${episodes.length} signifikante Schock-Episoden im historischen Datensatz identifiziert.`);

  console.log('\n[4/4] Berechne Performance-Forward-Returns (T+30, T+60, T+90)...');

  const detailedResults = [];

  for (const ep of episodes) {
    // Nur Episoden mit mind. 5 Tagen Cluster-Dauer analysieren (Filterung von Rauschen)
    if (ep.daysInAlert < 3 && ep.maxScore < 65) continue;

    const startIdx = ep.startIdx;
    const startSpy = ep.startSpy;
    const startOil = ep.startOil;
    const start10y = ep.start10y;
    const start2y = ep.start2y;

    if (!startSpy) continue;

    const getForwardMetrics = (daysForward) => {
      const targetIdx = Math.min(rawTimeline.length - 1, startIdx + daysForward);
      const targetDay = rawTimeline[targetIdx];
      
      let minSpy = startSpy;
      let maxDrawdown = 0;
      for (let j = startIdx; j <= targetIdx; j++) {
        const p = rawTimeline[j].assets?.SPY;
        if (p) {
          if (p < minSpy) minSpy = p;
          const dd = ((p - startSpy) / startSpy) * 100;
          if (dd < maxDrawdown) maxDrawdown = dd;
        }
      }

      const endSpy = targetDay.assets?.SPY;
      const endOil = targetDay.assets?.Oil;
      const end10y = targetDay.macroGroups?.YieldCurve?.Yield10y;
      const end2y = targetDay.macroGroups?.YieldCurve?.Yield2y;

      return {
        date: targetDay.date,
        spyReturn: endSpy ? ((endSpy - startSpy) / startSpy) * 100 : null,
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        oilReturn: (endOil && startOil) ? ((endOil - startOil) / startOil) * 100 : null,
        delta10y: (end10y !== null && start10y !== null) ? (end10y - start10y) : null,
        delta2y: (end2y !== null && start2y !== null) ? (end2y - start2y) : null
      };
    };

    const f30 = getForwardMetrics(30);
    const f60 = getForwardMetrics(60);
    const f90 = getForwardMetrics(90);

    detailedResults.push({
      startDate: ep.startDate,
      endDate: ep.endDate,
      durationDays: ep.daysInAlert,
      regime: ep.regime,
      maxScore: ep.maxScore,
      oilAtStart: ep.startOil?.toFixed(2) || 'N/A',
      yield10yAtStart: ep.start10y?.toFixed(2) || 'N/A',
      yield2yAtStart: ep.start2y?.toFixed(2) || 'N/A',
      f30,
      f60,
      f90
    });
  }

  console.log('\n================================================================================');
  console.log('   ERGEBNISTABELLE: HISTORISCHE S&P 500 FORWARD-RETURNS NACH SCHOCK-ALERT');
  console.log('================================================================================');

  const summaryTable = detailedResults.map(r => ({
    'Startdatum': r.startDate,
    'Enddatum': r.endDate,
    'Dauer (Tage)': r.durationDays,
    'Regime': r.regime,
    'Score': r.maxScore,
    'Öl (Start)': `$${r.oilAtStart}`,
    '10Y Yield': `${r.yield10yAtStart}%`,
    'SPY Max DD 60d': `${r.f60.maxDrawdown}%`,
    'SPY Return 90d': r.f90.spyReturn !== null ? `${r.f90.spyReturn.toFixed(1)}%` : 'N/A (Laufend)',
    '10Y Delta 90d': r.f90.delta10y !== null ? `${r.f90.delta10y > 0 ? '+' : ''}${r.f90.delta10y.toFixed(2)}%` : 'N/A',
    'Öl Return 90d': r.f90.oilReturn !== null ? `${r.f90.oilReturn > 0 ? '+' : ''}${r.f90.oilReturn.toFixed(1)}%` : 'N/A'
  }));

  console.table(summaryTable);

  // Aggregierte Statistiken
  const valid60 = detailedResults.filter(r => r.f60.spyReturn !== null && r.startDate < '2026-06-01');
  if (valid60.length > 0) {
    const avgDd60 = valid60.reduce((acc, r) => acc + r.f60.maxDrawdown, 0) / valid60.length;
    const avgRet90 = valid60.reduce((acc, r) => acc + (r.f90.spyReturn || 0), 0) / valid60.length;
    const worstCaseDd = Math.min(...valid60.map(r => r.f60.maxDrawdown));

    console.log('\n================================================================================');
    console.log('   STATISTISCHE KERN-ERKENNTNISSE (HISTORISCHE ANALOGIEN)');
    console.log('================================================================================');
    console.log(`• Untersuchte Schock-Episoden (mit vollständigen 90d-Outcomes): ${valid60.length}`);
    console.log(`• Mittlerer maximaler S&P 500 Drawdown binnen 60 Tagen:        ${avgDd60.toFixed(2)} %`);
    console.log(`• Historischer Worst-Case S&P 500 Drawdown binnen 60 Tagen:     ${worstCaseDd.toFixed(2)} %`);
    console.log(`• Mittlerer S&P 500 Netto-Return nach 90 Tagen:                 ${avgRet90.toFixed(2)} %`);
    console.log('================================================================================\n');
  }

  // Spezifische Analyse der aktuellen September 2026 Episode
  const current2026 = detailedResults.find(r => r.startDate.startsWith('2026-09') || r.endDate >= '2026-09-01');
  if (current2026) {
    console.log('>>> STATUS DER AKTUELLEN SEPTEMBER 2026 EPISODE:');
    console.log(`    • Start des Schock-Signals: ${current2026.startDate}`);
    console.log(`    • Aktuelles Regime:         ${current2026.regime} (Composite Score: ${current2026.maxScore}/100)`);
    console.log(`    • Ölpreis bei Alarm:        $${current2026.oilAtStart}`);
    console.log(`    • 10Y Rendite bei Alarm:    ${current2026.yield10yAtStart}%`);
    console.log(`    • Bisheriger Drawdown:      ${current2026.f30.maxDrawdown}%`);
    console.log('--------------------------------------------------------------------------------\n');
  }
}

runStresstest().catch(err => {
  console.error('[Stresstest Error]', err);
});
