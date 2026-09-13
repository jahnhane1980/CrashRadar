import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { PortfolioStrategyEngine } from '../../../src/strategies/PortfolioStrategyEngine.js';
import { GoldSpyDcaStrategy } from '../../../src/strategies/GoldSpyDcaStrategy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * GoldSpyDailyStressTest
 * 
 * Empirischer 21,8 Jahre Daily-Stresstest der CrashRadar SignalEngine:
 * - Füttert JEDEN einzelnen Handelstag (2004 - 2026) in PortfolioStrategyEngine & GoldSpyDcaStrategy.
 * - Testet das Zusammenspiel aus:
 *   1. 3-Säulen-Katastrophen-Matrix (Chart-Bruch + Makro-Türsteher)
 *   2. Gold-Sniper State Machine (75/25 Gold/Cash Sweet Spot, -18%/-19% Pre-Margin Cash-Lock)
 *   3. Generationen-Boden Re-Entry
 * - Vergleicht die Strategie mit:
 *   Benchmark A: Reiner S&P 500 Buy & Hold DCA (100% SPY)
 *   Benchmark B: Reiner Gold Buy & Hold DCA (100% GLD)
 */
async function runDailyStressTest() {
  console.log('='.repeat(90));
  console.log('   CRASHRADAR: EMPIRISCHER 21.8 JAHRE DAILY-STRESSTEST FÜR GOLD-SPY (2004 - 2026)');
  console.log('   Füttert die echte SignalEngine (PortfolioStrategyEngine + GoldSpyDcaStrategy) Tag für Tag');
  console.log('='.repeat(90));

  // 1. Daten laden via FinanceExpert
  console.log('\n[1/4] Lade historische Timeline via FinanceExpert ab November 2004...');
  const fe = new FinanceExpert();
  const rawTimeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
  await fe.close();

  if (!rawTimeline || rawTimeline.length < 200) {
    throw new Error(`Zu wenige Timeline-Daten geladen (${rawTimeline?.length || 0} Tage).`);
  }

  // 2. FX-Daten für EUR-Depotwert laden (falls vorhanden)
  const cacheDir = path.resolve(__dirname, '../../trash/cache');
  const fxPath = path.join(cacheDir, 'EURUSD_X_2004-11-18_2026-09-08.json');
  const fxMap = {};
  if (fs.existsSync(fxPath)) {
    try {
      const fxData = JSON.parse(fs.readFileSync(fxPath, 'utf8'));
      fxData.forEach(q => {
        const d = (q.date || '').substring(0, 10);
        if (d && q.close) fxMap[d] = Number(q.close);
      });
      console.log(`  • FX-Raten geladen: ${Object.keys(fxMap).length} Tage.`);
    } catch (e) {
      console.warn('  • Konnte FX-Cache nicht laden:', e.message);
    }
  }

  // Harmonisierung: Gold / GLD Alias sicherstellen
  let validDays = 0;
  rawTimeline.forEach(t => {
    if (t.assets) {
      if (t.assets.Gold && !t.assets.GLD) t.assets.GLD = Number(t.assets.Gold);
      if (t.assets.GLD && !t.assets.Gold) t.assets.Gold = Number(t.assets.GLD);
      if (t.assets.SPY) validDays++;
    }
  });

  console.log(`  • Gesamt-Timeline: ${rawTimeline.length} Tage (SPY Handelstage: ${validDays}).`);
  console.log(`  • Startdatum: ${rawTimeline[0].date} | Enddatum: ${rawTimeline[rawTimeline.length - 1].date}`);

  // 3. Engine initialisieren & KatastrophenMatrix mit Memoization-Cache beschleunigen
  console.log('\n[2/4] Initialisiere PortfolioStrategyEngine & GoldSpyDcaStrategy...');
  const engine = new PortfolioStrategyEngine();
  const km = engine.katastrophenMatrix;

  // Deterministischer Memoization-Cache für historische Tage
  const kmCache = new Map();
  const origKmEval = km.evaluate.bind(km);
  km.evaluate = (tl) => {
    const last = tl[tl.length - 1];
    const k = last?.date ? `${last.date}_${tl.length}` : null;
    if (k && kmCache.has(k)) return kmCache.get(k);
    const res = origKmEval(tl);
    if (k) kmCache.set(k, res);
    return res;
  };

  const pc = engine.panicCapitulation;
  const pcCache = new Map();
  const origPcEval = pc.evaluate.bind(pc);
  pc.evaluate = (tl) => {
    const last = tl[tl.length - 1];
    const k = last?.date ? `${last.date}_${tl.length}` : null;
    if (k && pcCache.has(k)) return pcCache.get(k);
    const res = origPcEval(tl);
    if (k) pcCache.set(k, res);
    return res;
  };

  const goldSpyStrategy = new GoldSpyDcaStrategy();
  engine.registerStrategy(goldSpyStrategy);

  // 4. Simulations-Parameter (10.000 € Startkapital + 150 €/Monat Sparplan)
  const START_CAPITAL_EUR = 10000;
  const MONTHLY_DCA_EUR = 150;

  // Benchmark 1: 100% SPY Buy & Hold DCA
  let b1SpyShares = 0;
  let b1InvestedEUR = START_CAPITAL_EUR;
  let b1PeakEUR = 0;
  let b1MaxDdPct = 0;
  let b1MaxDdDate = '';

  // Benchmark 2: 100% Gold Buy & Hold DCA
  let b2GldShares = 0;
  let b2InvestedEUR = START_CAPITAL_EUR;
  let b2PeakEUR = 0;
  let b2MaxDdPct = 0;
  let b2MaxDdDate = '';

  // Strategie Depot: Gold-SPY Dynamic DCA (durch SignalEngine gesteuert)
  let stratSpyShares = 0;
  let stratGldShares = 0;
  let stratCashUSD = 0;
  let stratInvestedEUR = START_CAPITAL_EUR;
  let stratPeakEUR = 0;
  let stratMaxDdPct = 0;
  let stratMaxDdDate = '';

  // Tracking der Notfall-Episoden
  let currentEpisode = null;
  const completedEpisodes = [];
  let lastEvaluatedMonth = '';

  // Starttag (ab Index 200, da 200 Tage Warmup für SMA 200 benötigt werden)
  const startDayIdx = 200;
  const startDay = rawTimeline[startDayIdx];
  const startFx = fxMap[startDay.date] || 1.25;
  const startSpy = Number(startDay.assets.SPY);
  const startGld = Number(startDay.assets.GLD || startDay.assets.Gold);

  // Initiales Investment am Starttag
  b1SpyShares = (START_CAPITAL_EUR * startFx) / startSpy;
  b2GldShares = (START_CAPITAL_EUR * startFx) / startGld;
  stratSpyShares = (START_CAPITAL_EUR * startFx) / startSpy;

  console.log(`\n[3/4] Starte tägliche Simulation ab ${startDay.date} (${rawTimeline.length - startDayIdx} Handelstage)...`);
  const t0 = Date.now();

  let daysCount = 0;
  for (let i = startDayIdx; i < rawTimeline.length; i++) {
    const currentDay = rawTimeline[i];
    const dateStr = currentDay.date;
    const spyPrice = Number(currentDay.assets?.SPY);
    const gldPrice = Number(currentDay.assets?.GLD || currentDay.assets?.Gold);
    const fxRate = fxMap[dateStr] || startFx; // EUR/USD

    if (!spyPrice || isNaN(spyPrice) || !gldPrice || isNaN(gldPrice)) {
      continue;
    }
    daysCount++;

    const monthStr = dateStr.substring(0, 7);
    const isNewMonth = monthStr !== lastEvaluatedMonth;
    lastEvaluatedMonth = monthStr;

    // -------------------------------------------------------------
    // A. SIGNALENGINE AUSWERTUNG FÜR DEN HEUTIGEN TAG
    // -------------------------------------------------------------
    const sliceUntilToday = rawTimeline.slice(0, i + 1);
    const evalResult = await engine.evaluateAll({
      date: dateStr,
      timeline: sliceUntilToday
    });

    const stratRes = evalResult.strategyResults.GOLD_SPY;
    const macroCtx = evalResult.macroSignalContext;
    const currentStatus = stratRes?.status || 'NORMAL_DCA';
    const targetAlloc = stratRes?.targetAllocationPct || { SPY: 100, GLD: 0, CASH: 0 };

    // -------------------------------------------------------------
    // B. MONATLICHER SPARPLAN (DCA 150 €)
    // -------------------------------------------------------------
    if (isNewMonth && daysCount > 1) {
      const dcaUSD = MONTHLY_DCA_EUR * fxRate;

      // Benchmark 1: Sturer SPY-Kauf
      b1SpyShares += dcaUSD / spyPrice;
      b1InvestedEUR += MONTHLY_DCA_EUR;

      // Benchmark 2: Sturer Gold-Kauf
      b2GldShares += dcaUSD / gldPrice;
      b2InvestedEUR += MONTHLY_DCA_EUR;

      // Strategie: Sparplan fließt in die von der SignalEngine vorgegebene Ziel-Allokation
      stratInvestedEUR += MONTHLY_DCA_EUR;
      const spyAllocationUSD = dcaUSD * ((targetAlloc.SPY || 0) / 100);
      const gldAllocationUSD = dcaUSD * ((targetAlloc.GLD || 0) / 100);
      const cashAllocationUSD = dcaUSD * ((targetAlloc.CASH || 0) / 100);

      if (spyAllocationUSD > 0) stratSpyShares += spyAllocationUSD / spyPrice;
      if (gldAllocationUSD > 0) stratGldShares += gldAllocationUSD / gldPrice;
      if (cashAllocationUSD > 0) stratCashUSD += cashAllocationUSD;
    }

    // -------------------------------------------------------------
    // C. STRATEGIE TRANSAKTIONEN (REALLOKATION)
    // -------------------------------------------------------------
    const isHedgeActive = (currentStatus === 'EMERGENCY_HEDGE' || currentStatus === 'PRE_MARGIN_CASH_LOCK' || currentStatus === 'MARGIN_CALL_ACTIVE');

    if (isHedgeActive) {
      // Notfall aktiv!
      if (!currentEpisode) {
        // EPISODEN-START: Neuer Ausstieg aus SPY
        const currentDepotUSD = (stratSpyShares * spyPrice) + (stratGldShares * gldPrice) + stratCashUSD;

        currentEpisode = {
          episodeNumber: completedEpisodes.length + 1,
          startDate: dateStr,
          startSpyPrice: spyPrice,
          startGldPrice: gldPrice,
          startDepotUSD: currentDepotUSD,
          startDepotEUR: currentDepotUSD / fxRate,
          initialStatus: currentStatus,
          statusHistory: [currentStatus],
          reasons: [stratRes?.reason || 'Katastrophen-Matrix aktiv'],
          activePillars: macroCtx.katastrophenMatrix?.activePillars || [],
          reachedPreMarginLock: false,
          reachedMarginCall: false,
          tradingDays: 1
        };

        // Sofortige Evakuierung in Zielallokation (z.B. 75% Gold / 25% Cash)
        stratSpyShares = 0;
        const targetGoldUSD = currentDepotUSD * ((targetAlloc.GLD || 75) / 100);
        const targetCashUSD = currentDepotUSD * ((targetAlloc.CASH || 25) / 100);
        stratGldShares = targetGoldUSD / gldPrice;
        stratCashUSD = targetCashUSD;
      } else {
        // Fortlaufende Episode
        currentEpisode.tradingDays++;
        if (!currentEpisode.statusHistory.includes(currentStatus)) {
          currentEpisode.statusHistory.push(currentStatus);
        }

        // Dynamische Anpassung innerhalb der Episode:
        // z.B. Wechsel von EMERGENCY_HEDGE (75/25) zu PRE_MARGIN_CASH_LOCK (100% Cash)
        if (currentStatus === 'PRE_MARGIN_CASH_LOCK' || currentStatus === 'MARGIN_CALL_ACTIVE') {
          if (stratGldShares > 0) {
            // Gold glattstellen und in 100% Cash wechseln
            const goldProceedsUSD = stratGldShares * gldPrice;
            stratCashUSD += goldProceedsUSD;
            stratGldShares = 0;
            currentEpisode.reachedPreMarginLock = true;
            if (currentStatus === 'MARGIN_CALL_ACTIVE') currentEpisode.reachedMarginCall = true;
          }
        }
      }
    } else {
      // Kein Notfall (NORMAL_DCA oder RE_ENTRY_SNIPER)
      if (currentEpisode) {
        // EPISODEN-ENDE: Re-Entry zurück in SPY!
        const finalDepotUSD = (stratSpyShares * spyPrice) + (stratGldShares * gldPrice) + stratCashUSD;
        const finalDepotEUR = finalDepotUSD / fxRate;

        currentEpisode.endDate = dateStr;
        currentEpisode.endSpyPrice = spyPrice;
        currentEpisode.endGldPrice = gldPrice;
        currentEpisode.endDepotUSD = finalDepotUSD;
        currentEpisode.endDepotEUR = finalDepotEUR;

        // Renditen während der Evakuierungsphase
        const spyReturnPct = ((spyPrice - currentEpisode.startSpyPrice) / currentEpisode.startSpyPrice) * 100;
        const gldReturnPct = ((gldPrice - currentEpisode.startGldPrice) / currentEpisode.startGldPrice) * 100;
        const depotReturnPct = ((finalDepotUSD - currentEpisode.startDepotUSD) / currentEpisode.startDepotUSD) * 100;
        const alphaPct = depotReturnPct - spyReturnPct;

        currentEpisode.spyReturnPct = spyReturnPct;
        currentEpisode.gldReturnPct = gldReturnPct;
        currentEpisode.depotReturnPct = depotReturnPct;
        currentEpisode.alphaPct = alphaPct;
        currentEpisode.reEntryReason = stratRes?.reason || 'Re-Entry Signal';

        completedEpisodes.push(currentEpisode);
        currentEpisode = null;

        // 100% Reinvestition aller Cash- und Gold-Reserven in SPY
        stratSpyShares = finalDepotUSD / spyPrice;
        stratGldShares = 0;
        stratCashUSD = 0;
      }
    }

    // -------------------------------------------------------------
    // D. TÄGLICHE BEWERTUNG & DRAWDOWN-TRACKING (IN EUR)
    // -------------------------------------------------------------
    // Benchmark 1
    const b1ValEUR = (b1SpyShares * spyPrice) / fxRate;
    if (b1ValEUR > b1PeakEUR) b1PeakEUR = b1ValEUR;
    const b1Dd = ((b1ValEUR - b1PeakEUR) / b1PeakEUR) * 100;
    if (b1Dd < b1MaxDdPct) {
      b1MaxDdPct = b1Dd;
      b1MaxDdDate = dateStr;
    }

    // Benchmark 2
    const b2ValEUR = (b2GldShares * gldPrice) / fxRate;
    if (b2ValEUR > b2PeakEUR) b2PeakEUR = b2ValEUR;
    const b2Dd = ((b2ValEUR - b2PeakEUR) / b2PeakEUR) * 100;
    if (b2Dd < b2MaxDdPct) {
      b2MaxDdPct = b2Dd;
      b2MaxDdDate = dateStr;
    }

    // Strategie
    const stratValUSD = (stratSpyShares * spyPrice) + (stratGldShares * gldPrice) + stratCashUSD;
    const stratValEUR = stratValUSD / fxRate;
    if (stratValEUR > stratPeakEUR) stratPeakEUR = stratValEUR;
    const stratDd = ((stratValEUR - stratPeakEUR) / stratPeakEUR) * 100;
    if (stratDd < stratMaxDdPct) {
      stratMaxDdPct = stratDd;
      stratMaxDdDate = dateStr;
    }

    // Fortschritts-Anzeige alle 1000 Tage
    if (daysCount % 1000 === 0) {
      console.log(`  • Tag ${daysCount}/${rawTimeline.length - startDayIdx} (${dateStr}) durchlaufen...`);
    }
  }

  const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n  • Simulation in ${durationSec}s erfolgreich abgeschlossen! (${daysCount} Handelstage)\n`);

  // Falls Simulation im Hedge endet
  if (currentEpisode) {
    const lastDay = rawTimeline[rawTimeline.length - 1];
    const fxRate = fxMap[lastDay.date] || 1.10;
    const finalDepotUSD = (stratSpyShares * Number(lastDay.assets.SPY)) + (stratGldShares * Number(lastDay.assets.GLD || lastDay.assets.Gold)) + stratCashUSD;
    currentEpisode.endDate = lastDay.date;
    currentEpisode.endSpyPrice = Number(lastDay.assets.SPY);
    currentEpisode.endGldPrice = Number(lastDay.assets.GLD || lastDay.assets.Gold);
    currentEpisode.endDepotUSD = finalDepotUSD;
    currentEpisode.endDepotEUR = finalDepotUSD / fxRate;
    currentEpisode.spyReturnPct = ((currentEpisode.endSpyPrice - currentEpisode.startSpyPrice) / currentEpisode.startSpyPrice) * 100;
    currentEpisode.gldReturnPct = ((currentEpisode.endGldPrice - currentEpisode.startGldPrice) / currentEpisode.startGldPrice) * 100;
    currentEpisode.depotReturnPct = ((finalDepotUSD - currentEpisode.startDepotUSD) / currentEpisode.startDepotUSD) * 100;
    currentEpisode.alphaPct = currentEpisode.depotReturnPct - currentEpisode.spyReturnPct;
    completedEpisodes.push(currentEpisode);
  }

  // -------------------------------------------------------------
  // E. FINALE ERGEBNISSE & AUSWERTUNG
  // -------------------------------------------------------------
  const lastDay = rawTimeline[rawTimeline.length - 1];
  const lastSpy = Number(lastDay.assets.SPY);
  const lastGld = Number(lastDay.assets.GLD || lastDay.assets.Gold);
  const lastFx = fxMap[lastDay.date] || 1.10;

  const b1FinalEUR = (b1SpyShares * lastSpy) / lastFx;
  const b1ProfitEUR = b1FinalEUR - b1InvestedEUR;
  const b1ReturnPct = (b1ProfitEUR / b1InvestedEUR) * 100;

  const b2FinalEUR = (b2GldShares * lastGld) / lastFx;
  const b2ProfitEUR = b2FinalEUR - b2InvestedEUR;
  const b2ReturnPct = (b2ProfitEUR / b2InvestedEUR) * 100;

  const stratFinalUSD = (stratSpyShares * lastSpy) + (stratGldShares * lastGld) + stratCashUSD;
  const stratFinalEUR = stratFinalUSD / lastFx;
  const stratProfitEUR = stratFinalEUR - stratInvestedEUR;
  const stratReturnPct = (stratProfitEUR / stratInvestedEUR) * 100;

  const deltaVsB1EUR = stratFinalEUR - b1FinalEUR;
  const deltaReturnPct = stratReturnPct - b1ReturnPct;

  console.log('='.repeat(90));
  console.log('   ERGEBNIS-ÜBERSICHT: PERFORMANCE VS. STURES DCA (2004 - 2026)');
  console.log('='.repeat(90));
  console.log(`Gesamte Einzahlungen:           € ${stratInvestedEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (10.000 € Start + 150 €/Monat)`);
  console.log(`Simulationszeitraum:            ${startDay.date} bis ${lastDay.date} (${daysCount} Handelstage, ~21,8 Jahre)\n`);

  console.log(`1. S&P 500 Buy & Hold DCA:       € ${b1FinalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} | Gewinn: +€ ${b1ProfitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${b1ReturnPct.toFixed(2)}%) | Max DD: ${b1MaxDdPct.toFixed(2)}% (${b1MaxDdDate})`);
  console.log(`2. Reines Gold Buy & Hold DCA:   € ${b2FinalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} | Gewinn: +€ ${b2ProfitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${b2ReturnPct.toFixed(2)}%) | Max DD: ${b2MaxDdPct.toFixed(2)}% (${b2MaxDdDate})`);
  console.log(`3. CRASHRADAR GOLD-SPY ENGINE:   € ${stratFinalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} | Gewinn: +€ ${stratProfitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${stratReturnPct.toFixed(2)}%) | Max DD: ${stratMaxDdPct.toFixed(2)}% (${stratMaxDdDate})\n`);

  console.log(`Vorteil gegenüber S&P 500 DCA:  +€ ${deltaVsB1EUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} Mehrgewinn (+${deltaReturnPct.toFixed(2)}% Alpha)`);
  console.log(`Risiko-Reduktion Max Drawdown:  ${b1MaxDdPct.toFixed(2)}% --> ${stratMaxDdPct.toFixed(2)}% (${(b1MaxDdPct - stratMaxDdPct).toFixed(2)}% Drawdown-Dämpfung!)`);
  console.log(`Gesamtzahl Notfall-Evakuierungen: ${completedEpisodes.length} Episoden in 21,8 Jahren (~${(completedEpisodes.length / 21.8).toFixed(1)} pro Jahr)\n`);

  // -------------------------------------------------------------
  // F. CHRONIK DER NOTFALL-EPISODEN
  // -------------------------------------------------------------
  console.log('='.repeat(90));
  console.log('   CHRONIK ALLER NOTFALL-EVAKUIERUNGEN (WANN, WIE LANGE, WAS HAT ES GEBRACHT?)');
  console.log('='.repeat(90));
  console.log('| Nr | Startdatum | Enddatum   | Dauer | SPY Rendite | Gold Rendite | Depot Rendite | Alpha / Schutz |');
  console.log('|:--:|:----------:|:----------:|:-----:|:-----------:|:------------:|:-------------:|:--------------:|');

  let totalDaysInHedge = 0;
  let positiveAlphaCount = 0;

  completedEpisodes.forEach(ep => {
    totalDaysInHedge += ep.tradingDays;
    if (ep.alphaPct > 0) positiveAlphaCount++;

    const spyStr = `${ep.spyReturnPct >= 0 ? '+' : ''}${ep.spyReturnPct.toFixed(1)}%`.padStart(11, ' ');
    const gldStr = `${ep.gldReturnPct >= 0 ? '+' : ''}${ep.gldReturnPct.toFixed(1)}%`.padStart(12, ' ');
    const depStr = `${ep.depotReturnPct >= 0 ? '+' : ''}${ep.depotReturnPct.toFixed(1)}%`.padStart(13, ' ');
    const alphaStr = `${ep.alphaPct >= 0 ? '+' : ''}${ep.alphaPct.toFixed(1)}%`.padStart(14, ' ');

    console.log(`| ${String(ep.episodeNumber).padStart(2, ' ')} | ${ep.startDate} | ${ep.endDate || 'offen     '} | ${String(ep.tradingDays).padStart(3, ' ')} d | ${spyStr} | ${gldStr} | ${depStr} | ${alphaStr} |`);
  });

  const pctDaysInHedge = ((totalDaysInHedge / daysCount) * 100).toFixed(1);
  console.log(`\nGesamte Tage im Schutzschild:   ${totalDaysInHedge} von ${daysCount} Tagen (${pctDaysInHedge}% der Zeit im Hedge, 100-${pctDaysInHedge}% = ${(100 - pctDaysInHedge).toFixed(1)}% im SPY-Normalbetrieb)`);
  console.log(`Erfolgsquote der Evakuierungen: ${positiveAlphaCount} von ${completedEpisodes.length} Episoden erzielten positives Alpha (${((positiveAlphaCount / completedEpisodes.length) * 100).toFixed(1)}%)\n`);

  return {
    metrics: {
      daysCount,
      stratInvestedEUR,
      b1FinalEUR,
      b1ProfitEUR,
      b1ReturnPct,
      b1MaxDdPct,
      b1MaxDdDate,
      stratFinalEUR,
      stratProfitEUR,
      stratReturnPct,
      stratMaxDdPct,
      stratMaxDdDate,
      deltaVsB1EUR,
      deltaReturnPct,
      episodesCount: completedEpisodes.length,
      totalDaysInHedge,
      pctDaysInHedge,
      positiveAlphaCount
    },
    episodes: completedEpisodes
  };
}

runDailyStressTest().catch(console.error);
