import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { MacroRegimeEngine } from '../../../src/analysis/MacroRegimeEngine.js';

async function runAllIndicatorsGrandPrix() {
  console.log('================================================================');
  console.log('21-JAHRE INDIKATOREN-GRAND-PRIX (2005 - 2026: ALLE 18 INDIKATOREN)');
  console.log('================================================================\n');

  console.log('[1/4] Lade 21 Jahre aggregierte Makro- & Marktdaten über FinanceExpert...');
  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2005-10-19', { bypassMemoryGuard: true });
  console.log(`- Timeline geladen: ${timeline.length} Handelstage (von ${timeline[0].date} bis ${timeline[timeline.length - 1].date})\n`);

  console.log('[2/4] Initialisiere MacroRegimeEngine mit allen 18 Indikatoren...');
  const engine = new MacroRegimeEngine();
  const indicatorList = engine.indicators;
  console.log(`- ${indicatorList.length} Indikatoren registriert.\n`);

  console.log('[3/4] Führe Walk-Forward Simulation über 5.000+ Handelstage durch...');

  const majorCrises = [
    { name: '2007/08 Große Finanzkrise (GFC)', peakDate: '2007-10-09', crashLowDate: '2009-03-09', type: 'Systemic / Credit / Bank' },
    { name: '2011 US-Rating Downgrade / Euro', peakDate: '2011-04-29', crashLowDate: '2011-10-03', type: 'Fiscal / Debt Ceiling' },
    { name: '2015/16 Rohstoff & Fed Zinswende', peakDate: '2015-05-21', crashLowDate: '2016-02-11', type: 'Rate Shock / Earnings' },
    { name: '2018 Q4 QT-Crash (-20 %)', peakDate: '2018-09-20', crashLowDate: '2018-12-24', type: 'Liquidity / Fed QT' },
    { name: '2019 Sept Repo-Krise (10 %)', peakDate: '2019-09-16', crashLowDate: '2019-10-02', type: 'Geldmarkt / Plumbing' },
    { name: '2020 Feb Covid-Crash (-35 %)', peakDate: '2020-02-19', crashLowDate: '2020-03-23', type: 'Exogenous / Liquidity Drain' },
    { name: '2022 Tech-Bärenmarkt (Zinsschock)', peakDate: '2022-01-04', crashLowDate: '2022-10-12', type: 'Valuation / Yield Shock' },
    { name: '2023 Aug-Okt Kupon-Schock', peakDate: '2023-07-31', crashLowDate: '2023-10-27', type: 'QRA Duration / Term Prem' },
    { name: '2024 Sommer Tech-Dip / Carry', peakDate: '2024-07-16', crashLowDate: '2024-08-05', type: 'Liquidity / Vol Spike' },
    { name: '2025 April Tax-Day Crash', peakDate: '2025-03-25', crashLowDate: '2025-04-08', type: 'Tax Drain / Volatility' }
  ];

  // Sammle für jeden Indikator die täglichen Ergebnisse
  const indResults = new Map();
  indicatorList.forEach(ind => {
    indResults.set(ind.name, {
      name: ind.name,
      category: ind.category,
      totalTriggers: 0,
      triggerDates: [],
      crisesDetected: 0,
      leadTimes: [],
      crisesDetails: []
    });
  });

  // Tägliche Auswertung
  for (let i = 40; i < timeline.length; i++) {
    const curSlice = timeline.slice(0, i + 1);
    const curDay = timeline[i];

    for (const ind of indicatorList) {
      try {
        const res = ind.evaluate(curSlice);
        const status = res?.status || 'UNKNOWN';
        const isAlert = status === 'WARNING' || status === 'CRITICAL' || status === 'RED' || status === 'ALERT' || status === 'PANIC' || status === 'BUY_SETUP' || status === 'DELEVERAGING';

        if (isAlert) {
          const stats = indResults.get(ind.name);
          stats.totalTriggers++;
          stats.triggerDates.push({ date: curDay.date, status, message: res.message });
        }
      } catch (err) {
        // Ignore single evaluation errors
      }
    }
  }

  // Krisen-Abdeckung pro Indikator prüfen
  indicatorList.forEach(ind => {
    const stats = indResults.get(ind.name);

    majorCrises.forEach(c => {
      const peakIdx = timeline.findIndex(d => d.date >= c.peakDate);
      if (peakIdx === -1) return;

      // Suche im 90-Tage-Fenster vor dem Peak
      let firstHit = null;
      for (let w = Math.max(0, peakIdx - 90); w <= peakIdx; w++) {
        const dStr = timeline[w].date;
        const hit = stats.triggerDates.find(t => t.date === dStr);
        if (hit) {
          firstHit = hit;
          break;
        }
      }

      if (firstHit) {
        const d1 = new Date(firstHit.date);
        const d2 = new Date(c.peakDate);
        const leadDays = Math.round((d2 - d1) / (1000 * 3600 * 24));
        stats.crisesDetected++;
        stats.leadTimes.push(leadDays);
        stats.crisesDetails.push({
          crisis: c.name,
          firstDate: firstHit.date,
          status: firstHit.status,
          leadDays
        });
      } else {
        stats.crisesDetails.push({
          crisis: c.name,
          firstDate: null,
          status: 'MISSED',
          leadDays: 0
        });
      }
    });
  });

  console.log('[4/4] Aggregiere Ergebnisse der Indikatoren-Rangliste...\n');

  const summary = Array.from(indResults.values()).map(s => {
    const avgLead = s.leadTimes.length > 0 ? (s.leadTimes.reduce((a,b) => a + b, 0) / s.leadTimes.length).toFixed(0) : '0';
    return {
      name: s.name,
      category: s.category || 'MISC',
      totalTriggerDays: s.totalTriggers,
      triggerSharePct: (s.totalTriggers / timeline.length * 100).toFixed(1),
      crisesCaught: `${s.crisesDetected} / 10`,
      hitRatePct: (s.crisesDetected / 10 * 100).toFixed(0) + '%',
      avgLeadDays: `${avgLead} Tage`
    };
  }).sort((a,b) => parseInt(b.hitRatePct) - parseInt(a.hitRatePct));

  console.log('======================================================================================================');
  console.log('INDIKATOREN-RANGLISTE (21 JAHRE: 2005 - 2026)');
  console.log('======================================================================================================');
  console.log(`Indikator-Name                                 | Kategorie        | Treffer (10 Krisen) | Ø Vorlauf | Alarm-Tage (%)`);
  console.log(`----------------------------------------------------------------------------------------------------------------------`);
  summary.forEach(s => {
    console.log(`${s.name.padEnd(46)} | ${s.category.padEnd(16)} | ${s.crisesCaught.padEnd(19)} | ${s.avgLeadDays.padEnd(9)} | ${s.totalTriggerDays} (${s.triggerSharePct}%)`);
  });
  console.log('----------------------------------------------------------------------------------------------------------------------\n');

  // Speichere detaillierte Ergebnisse
  fs.writeFileSync(
    path.resolve(process.cwd(), 'scratch/grand_prix_all_indicators_results.json'),
    JSON.stringify({ summary, details: Array.from(indResults.values()) }, null, 2),
    'utf8'
  );

  console.log('[Erfolg] Alle Ergebnisse in scratch/grand_prix_all_indicators_results.json gespeichert.');
  await fe.close();
}

runAllIndicatorsGrandPrix().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
