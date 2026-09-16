import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { LiquiditySensorHub } from '../../src/signals/hubs/LiquiditySensorHub.js';

dotenv.config();

// Deterministischer Pseudo-Zufallszahlengenerator (LCG) für reproduzierbares Chaos-Engineering
function createSeededRandom(seed = 42) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 4-Regime-Klassifikation
const LclorRegime = {
  EXCESS_BUFFER: 'REGIME_1_EXCESS_BUFFER',
  MODERATE_SLACK: 'REGIME_2_MODERATE_SLACK',
  LCLOR_DANGER: 'REGIME_3_LCLOR_DANGER',
  ACUTE_CRISIS: 'REGIME_4_ACUTE_CRISIS',
  UNKNOWN: 'REGIME_UNKNOWN'
};

function classifyRegime(dayData) {
  const { wresbal, rrp, gdp, borrow } = dayData;
  if (wresbal === null || wresbal === undefined || rrp === null || rrp === undefined || !gdp || gdp <= 0) {
    return LclorRegime.UNKNOWN;
  }

  const reservesPctGdp = (wresbal / gdp) * 100;

  // Regime 4: Akute Krise / Notstand oder massive Fed-Notfallintervention
  if (reservesPctGdp < 8.0 || borrow >= 50.0) {
    return LclorRegime.ACUTE_CRISIS;
  }

  // Regime 3: LCLOR-Gefahrenzone (These ADR-008: RRP entleert & Bankreserven unter LCLOR-Schwelle 10.5% des BIP)
  if (rrp < 50.0 && reservesPctGdp < 10.5) {
    return LclorRegime.LCLOR_DANGER;
  }

  // Regime 1: Überpufferte Liquidität (Hochelastisch)
  if (rrp >= 500.0 || reservesPctGdp >= 12.0) {
    return LclorRegime.EXCESS_BUFFER;
  }

  // Regime 2: Moderater Puffer
  return LclorRegime.MODERATE_SLACK;
}

function calculateForwardMetrics(timeline, index, horizons = [10, 30, 60, 90]) {
  const day = timeline[index];
  const spy = day.assets?.SPY;
  if (!spy) return null;

  const currentBorrow = day.normBorrow ?? 0;
  const metrics = {};

  for (const h of horizons) {
    const fwdSlice = timeline.slice(index + 1, Math.min(timeline.length, index + 1 + h));
    if (fwdSlice.length === 0) {
      metrics[`t${h}`] = null;
      continue;
    }

    const prices = fwdSlice.map(d => d.assets?.SPY).filter(p => p !== null && p !== undefined && p > 0);
    if (prices.length === 0) {
      metrics[`t${h}`] = null;
      continue;
    }

    const finalP = prices[prices.length - 1];
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);

    const fwdReturn = ((finalP - spy) / spy) * 100;
    const maxDd = ((minP - spy) / spy) * 100;
    const maxRunup = ((maxP - spy) / spy) * 100;

    // Fed Emergency Borrowing Delta im Fenster
    const borrows = fwdSlice.map(d => d.normBorrow).filter(b => b !== null && b !== undefined);
    const maxBorrowInWindow = borrows.length > 0 ? Math.max(...borrows) : currentBorrow;
    const deltaBorrow = maxBorrowInWindow - currentBorrow;
    const hasFedIntervention = deltaBorrow >= 20.0 || maxBorrowInWindow >= 50.0;

    metrics[`t${h}`] = {
      tradingDays: prices.length,
      fwdReturn: Number(fwdReturn.toFixed(2)),
      maxDd: Number(maxDd.toFixed(2)),
      maxRunup: Number(maxRunup.toFixed(2)),
      isDdGe5: maxDd <= -5.0,
      isDdGe8: maxDd <= -8.0,
      isDdGe15: maxDd <= -15.0,
      isBullishNoDd: maxRunup >= 4.0 && maxDd >= -4.0,
      deltaBorrow: Number(deltaBorrow.toFixed(1)),
      hasFedIntervention
    };
  }

  return metrics;
}

// Cluster-Erkennung für zusammenhängende Episoden (Anti-Autokorrelation)
function clusterEpisodes(analyzedDays, maxGapTradingDays = 20) {
  const dangerDays = analyzedDays.filter(d => 
    d.regime === LclorRegime.LCLOR_DANGER || d.regime === LclorRegime.ACUTE_CRISIS
  );

  const episodes = [];
  let currentEp = null;

  for (const d of dangerDays) {
    if (!currentEp) {
      currentEp = {
        id: episodes.length + 1,
        startDate: d.date,
        endDate: d.date,
        startIdx: d.index,
        lastIdx: d.index,
        daysCount: 1,
        initialRegime: d.regime,
        initialWresbal: d.wresbal,
        initialRrp: d.rrp,
        initialBorrow: d.normBorrow,
        initialGdp: d.gdp,
        initialReservesPctGdp: d.reservesPctGdp,
        startSpy: d.spy,
        fwdMetrics: d.fwd,
        days: [d]
      };
    } else {
      const gap = d.index - currentEp.lastIdx;
      if (gap <= maxGapTradingDays) {
        currentEp.endDate = d.date;
        currentEp.lastIdx = d.index;
        currentEp.daysCount++;
        currentEp.days.push(d);
      } else {
        episodes.push(finalizeEpisode(currentEp));
        currentEp = {
          id: episodes.length + 1,
          startDate: d.date,
          endDate: d.date,
          startIdx: d.index,
          lastIdx: d.index,
          daysCount: 1,
          initialRegime: d.regime,
          initialWresbal: d.wresbal,
          initialRrp: d.rrp,
          initialBorrow: d.normBorrow,
          initialGdp: d.gdp,
          initialReservesPctGdp: d.reservesPctGdp,
          startSpy: d.spy,
          fwdMetrics: d.fwd,
          days: [d]
        };
      }
    }
  }

  if (currentEp) {
    episodes.push(finalizeEpisode(currentEp));
  }

  return episodes;
}

function finalizeEpisode(ep) {
  const minWresbal = Math.min(...ep.days.map(d => d.wresbal));
  const minRrp = Math.min(...ep.days.map(d => d.rrp));
  const maxBorrow = Math.max(...ep.days.map(d => d.normBorrow));
  const hadAcuteCrisis = ep.days.some(d => d.regime === LclorRegime.ACUTE_CRISIS);

  return {
    id: ep.id,
    startDate: ep.startDate,
    endDate: ep.endDate,
    tradingDaysActive: ep.daysCount,
    spanTradingDays: ep.lastIdx - ep.startIdx + 1,
    initialRegime: ep.initialRegime,
    hadAcuteCrisis,
    startSpy: ep.startSpy,
    initialWresbal: Number(ep.initialWresbal.toFixed(1)),
    minWresbal: Number(minWresbal.toFixed(1)),
    initialRrp: Number(ep.initialRrp.toFixed(1)),
    minRrp: Number(minRrp.toFixed(1)),
    initialReservesPctGdp: Number(ep.initialReservesPctGdp.toFixed(2)),
    initialBorrow: Number(ep.initialBorrow.toFixed(1)),
    maxBorrow: Number(maxBorrow.toFixed(1)),
    fwd60: ep.fwdMetrics?.t60 || null
  };
}

// Aggregation von Kennzahlen für ein Regime
function summarizeCohort(days, label) {
  const validDays = days.filter(d => d.fwd?.t60 !== null);
  if (validDays.length === 0) {
    return { label, count: 0, validCount: 0 };
  }

  const fwd60s = validDays.map(d => d.fwd.t60);
  const avgRet = fwd60s.reduce((s, x) => s + x.fwdReturn, 0) / fwd60s.length;
  const avgMaxDd = fwd60s.reduce((s, x) => s + x.maxDd, 0) / fwd60s.length;
  const avgMaxRunup = fwd60s.reduce((s, x) => s + x.maxRunup, 0) / fwd60s.length;

  const ddGe5Count = fwd60s.filter(x => x.isDdGe5).length;
  const ddGe8Count = fwd60s.filter(x => x.isDdGe8).length;
  const ddGe15Count = fwd60s.filter(x => x.isDdGe15).length;
  const bullishCount = fwd60s.filter(x => x.isBullishNoDd).length;
  const interventionCount = fwd60s.filter(x => x.hasFedIntervention).length;

  // Schock-Definition (Either Drawdown >= 8% OR Fed Emergency Intervention)
  const combinedShockCount = fwd60s.filter(x => x.isDdGe8 || x.hasFedIntervention).length;

  return {
    label,
    totalDays: days.length,
    validDaysCount: validDays.length,
    avgFwdReturn60: Number(avgRet.toFixed(2)),
    avgMaxDd60: Number(avgMaxDd.toFixed(2)),
    avgMaxRunup60: Number(avgMaxRunup.toFixed(2)),
    rateDdGe5: Number(((ddGe5Count / validDays.length) * 100).toFixed(1)),
    rateDdGe8: Number(((ddGe8Count / validDays.length) * 100).toFixed(1)),
    rateDdGe15: Number(((ddGe15Count / validDays.length) * 100).toFixed(1)),
    rateBullishNoDd: Number(((bullishCount / validDays.length) * 100).toFixed(1)),
    rateFedIntervention: Number(((interventionCount / validDays.length) * 100).toFixed(1)),
    rateCombinedShock: Number(((combinedShockCount / validDays.length) * 100).toFixed(1))
  };
}

async function runLclorBacktest() {
  console.log('================================================================================');
  console.log('   GROSSER HÄRTETEST ADR-008: LCLOR-BANKRESERVEN-THESE (2004 - 2026)');
  console.log('   NOTENBANK-LIQUIDITÄTS-KIPP-PUNKT BEI ENTLEERTEM RRP-PUFFER');
  console.log('================================================================================\n');

  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('2004-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage gesamt: ${timeline.length} (${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})\n`);

  // Vorbereiten & Normieren der Zeitreihe
  for (let i = 0; i < timeline.length; i++) {
    const d = timeline[i];
    const wresRaw = d.macroGroups?.BankingHealth?.BankReserves;
    const rrpRaw = d.macroGroups?.NetLiquidity?.RRPONTSYD;
    const borrowRaw = d.macroGroups?.BankingHealth?.EmergencyBorrowing;
    const gdpRaw = d.macroGroups?.TreasuryCapacity?.GDP;

    d.normWresbal = (wresRaw !== null && wresRaw !== undefined)
      ? (wresRaw / 1000)
      : null;
    d.normRrp = (rrpRaw !== null && rrpRaw !== undefined) ? rrpRaw : null;
    d.normBorrow = (borrowRaw !== null && borrowRaw !== undefined)
      ? (borrowRaw / 1000)
      : 0;
    d.normGdp = (gdpRaw !== null && gdpRaw !== undefined && gdpRaw > 0) ? gdpRaw : 28000;
  }

  // Segmentierung: Ample Reserves Era (ab 2009) vs. Gesamthistorie
  const ampleEraStartIdx = timeline.findIndex(d => d.date >= '2009-01-01');
  console.log(`Ample-Reserves-Fokus: Ab ${timeline[ampleEraStartIdx].date} (${timeline.length - ampleEraStartIdx} Tage)\n`);

  const analyzedDays = [];

  for (let i = ampleEraStartIdx; i < timeline.length; i++) {
    const d = timeline[i];
    const spy = d.assets?.SPY;
    if (!spy) continue;

    const wresbal = d.normWresbal;
    const rrp = d.normRrp;
    const borrow = d.normBorrow;
    const gdp = d.normGdp;
    const reservesPctGdp = gdp > 0 && wresbal !== null ? (wresbal / gdp) * 100 : 0;

    const regime = classifyRegime({ wresbal, rrp, gdp, borrow });
    const fwd = calculateForwardMetrics(timeline, i);

    analyzedDays.push({
      date: d.date,
      index: i,
      spy,
      wresbal,
      rrp,
      borrow: d.normBorrow,
      normBorrow: d.normBorrow,
      gdp,
      reservesPctGdp,
      regime,
      fwd
    });
  }

  // 1. Kohorten-Auswertung
  const r1Days = analyzedDays.filter(d => d.regime === LclorRegime.EXCESS_BUFFER);
  const r2Days = analyzedDays.filter(d => d.regime === LclorRegime.MODERATE_SLACK);
  const r3Days = analyzedDays.filter(d => d.regime === LclorRegime.LCLOR_DANGER);
  const r4Days = analyzedDays.filter(d => d.regime === LclorRegime.ACUTE_CRISIS);
  const r3And4Days = analyzedDays.filter(d => d.regime === LclorRegime.LCLOR_DANGER || d.regime === LclorRegime.ACUTE_CRISIS);

  const cohortR1 = summarizeCohort(r1Days, 'Regime 1: Überpufferte Liquidität (RRP >= 500B | Reserves >= 12% BIP)');
  const cohortR2 = summarizeCohort(r2Days, 'Regime 2: Moderater Puffer (RRP 50-500B & Reserves 10.5-12% BIP)');
  const cohortR3 = summarizeCohort(r3Days, 'Regime 3: LCLOR-Gefahrenzone (RRP < 50B & Reserves < 10.5% BIP / < 3T$)');
  const cohortR4 = summarizeCohort(r4Days, 'Regime 4: Akute Krise / Intervention (Reserves < 8% BIP | BORROW >= 50B)');
  const cohortCombinedDanger = summarizeCohort(r3And4Days, 'Regimes 3 & 4 Kombiniert (Alle LCLOR-Schock- & Krisentage)');

  console.log('================================================================================');
  console.log('1. KOHORTEN-VERGLEICH DER REGIMES (60-TAGE FORWARD DRAWDOWN & PERFORMANCE)');
  console.log('================================================================================\n');

  const printCohort = (c) => {
    console.log(`📊 ${c.label}`);
    console.log(`   • Tage analysiert: ${c.totalDays} (Valide T+60: ${c.validDaysCount})`);
    console.log(`   • SPY 60d Ø Return:   ${c.avgFwdReturn60 >= 0 ? '+' : ''}${c.avgFwdReturn60}% | Ø Max DD: ${c.avgMaxDd60}% | Ø Max Runup: +${c.avgMaxRunup60}%`);
    console.log(`   • Drawdown >= -5.0%:  ${c.rateDdGe5}% | Drawdown >= -8.0%: ${c.rateDdGe8}% | Drawdown >= -15.0%: ${c.rateDdGe15}%`);
    console.log(`   • Fed Emergency Spike:${c.rateFedIntervention}% | Kombinierte Schock-Quote (DD >= 8% ODER Fed-Rettung): ${c.rateCombinedShock}%`);
    console.log(`   • Falsifikations-Runup (Rallye >= +4% ohne DD <= -4%): ${c.rateBullishNoDd}%\n`);
  };

  printCohort(cohortR1);
  printCohort(cohortR2);
  printCohort(cohortR3);
  printCohort(cohortR4);
  printCohort(cohortCombinedDanger);

  // 2. Risk-Ratio & Hypothesenprüfung
  const riskRatioDd8 = cohortR1.rateDdGe8 > 0 ? (cohortR3.rateDdGe8 / cohortR1.rateDdGe8) : 99;
  const riskRatioCombined = cohortR1.rateCombinedShock > 0 ? (cohortCombinedDanger.rateCombinedShock / cohortR1.rateCombinedShock) : 99;

  console.log('================================================================================');
  console.log('2. HYPOTHESEN-PRÜFUNG & STATISTISCHE SIGNIFIKANZ');
  console.log('================================================================================\n');
  console.log(`🎯 Risk-Ratio (Drawdown >= -8.0% in Regime 3 vs. Regime 1): ${riskRatioDd8.toFixed(2)}x`);
  console.log(`🎯 Risk-Ratio (Kombinierter Schock in Regime 3/4 vs. Regime 1): ${riskRatioCombined.toFixed(2)}x`);
  console.log(`   (Kriterium ADR-008: Mindestens 2.0x erhöhtes Risiko erforderlich) -> ${riskRatioDd8 >= 2.0 ? '✅ ERFÜLLT' : '❌ NICHT ERFÜLLT'}\n`);

  // 3. Episoden-Clustering
  const episodes = clusterEpisodes(analyzedDays, 25);
  console.log('================================================================================');
  console.log(`3. DISKRETE HISTORISCHE EPISODEN DER LCLOR-GEFAHRENZONE (${episodes.length} EPISODEN)`);
  console.log('================================================================================\n');

  for (const ep of episodes) {
    const isCrisis = ep.hadAcuteCrisis ? '🚨 AKUTE KRISE / INTERVENTION' : '⚠️ LCLOR-GEFAHRENZONE';
    console.log(`Ep. #${ep.id}: [${ep.startDate} bis ${ep.endDate}] (${ep.tradingDaysActive} aktive Handelstage) - ${isCrisis}`);
    console.log(`   • Reserven-Start: $${ep.initialWresbal}B (${ep.initialReservesPctGdp}% BIP, Min: $${ep.minWresbal}B) | RRP Start: $${ep.initialRrp}B`);
    console.log(`   • Fed Emergency Borrowing: Start $${ep.initialBorrow}B -> Peak $${ep.maxBorrow}B`);
    if (ep.fwd60) {
      console.log(`   • SPY 60d Performance: Return: ${(ep.fwd60.fwdReturn >= 0 ? '+' : '') + ep.fwd60.fwdReturn}% | Max DD: ${ep.fwd60.maxDd}% | Max Runup: +${ep.fwd60.maxRunup}%`);
      console.log(`   • Schock eingetreten:  ${(ep.fwd60.isDdGe8 || ep.fwd60.hasFedIntervention) ? 'JA (DD >= 8% oder Fed-Intervention)' : 'NEIN'}`);
    } else {
      console.log(`   • SPY 60d Performance: [ZUKUNFTS-FENSTER - LÄUFT AKTUELL IN SEPTEMBER/HERBST 2026]`);
    }
    console.log('');
  }

  // Krisen-Trefferquote
  const repo2019Hit = episodes.some(ep => ep.startDate <= '2019-09-30' && ep.endDate >= '2019-09-01');
  const svb2023Hit = episodes.some(ep => ep.startDate <= '2023-03-31' && ep.endDate >= '2023-03-01');
  const current2026Hit = episodes.some(ep => ep.endDate >= '2026-09-01');

  console.log('📌 HISTORISCHE SCHOCK-ERKENNUNG:');
  console.log(`   • September 2019 (Repo-Krise):        ${repo2019Hit ? '✅ ERKANNT' : '❌ VERPASST'}`);
  console.log(`   • März 2023 (SVB / Regionalbanken):   ${svb2023Hit ? '✅ ERKANNT' : '❌ VERPASST'}`);
  console.log(`   • September 2026 (Aktuelle Lage):     ${current2026Hit ? '✅ AKTIV DETEKTIERT' : '❌ NICHT DETEKTIERT'}\n`);

  // 4. Chaos-Engineering & Anti-Overfitting (Kapitel 5)
  console.log('================================================================================');
  console.log('4. CHAOS-ENGINEERING & ANTI-OVERFITTING AUDIT (AGENTS.MD KAPITEL 5)');
  console.log('================================================================================\n');

  // A. Noise-Test (Deterministisches synthetisches Rauschen +/- 5% auf WRESBAL & RRP)
  console.log('A. Deterministischer Noise-Stresstest (Seed 42, ±5% Rauschen auf Reserven & RRP):');
  const rng = createSeededRandom(42);
  let noiseShockCount = 0;
  let noiseTotalCount = 0;

  for (const d of analyzedDays) {
    if (d.fwd?.t60 === null) continue;
    // Rauschen zwischen -5% und +5%
    const noiseW = 1 + (rng() * 0.10 - 0.05);
    const noiseR = 1 + (rng() * 0.10 - 0.05);

    const noisyWres = d.wresbal * noiseW;
    const noisyRrp = d.rrp * noiseR;
    const noisyRegime = classifyRegime({
      wresbal: noisyWres,
      rrp: noisyRrp,
      gdp: d.gdp,
      borrow: d.normBorrow
    });

    if (noisyRegime === LclorRegime.LCLOR_DANGER || noisyRegime === LclorRegime.ACUTE_CRISIS) {
      noiseTotalCount++;
      if (d.fwd.t60.isDdGe8 || d.fwd.t60.hasFedIntervention) {
        noiseShockCount++;
      }
    }
  }

  const noiseShockRate = noiseTotalCount > 0 ? (noiseShockCount / noiseTotalCount) * 100 : 0;
  const originalShockRate = cohortCombinedDanger.rateCombinedShock;
  const noiseDelta = Math.abs(noiseShockRate - originalShockRate);

  console.log(`   • Schock-Rate Original: ${originalShockRate}%`);
  console.log(`   • Schock-Rate mit 5% Noise: ${noiseShockRate.toFixed(1)}% (Delta: ${noiseDelta.toFixed(2)}%P)`);
  console.log(`   • Robustheits-Urteil: ${noiseDelta < 5.0 ? '✅ EXZELLENT ROBUST (Kein Overfitting an exakte Meldebeträge)' : '⚠️ EMPFINDLICH'}\n`);

  // B. Permutationstest (Shuffle der SPY Forward-Returns zur Nullhypothesen-Widerlegung)
  console.log('B. Monte-Carlo Permutationstest (1.000 Shuffles der SPY-Returns gegen Regime 3):');
  const validDangerDays = analyzedDays.filter(d => 
    (d.regime === LclorRegime.LCLOR_DANGER || d.regime === LclorRegime.ACUTE_CRISIS) && d.fwd?.t60 !== null
  );
  const allFwd60Returns = analyzedDays.filter(d => d.fwd?.t60 !== null).map(d => d.fwd.t60);

  let permBeatenCount = 0;
  const numPermutations = 1000;

  for (let p = 0; p < numPermutations; p++) {
    // Ziehe zufällige Tage aus Gesamtkorpus
    let randomShockCount = 0;
    for (let k = 0; k < validDangerDays.length; k++) {
      const randIdx = Math.floor(rng() * allFwd60Returns.length);
      const randMetric = allFwd60Returns[randIdx];
      if (randMetric.isDdGe8 || randMetric.hasFedIntervention) {
        randomShockCount++;
      }
    }
    const randRate = (randomShockCount / validDangerDays.length) * 100;
    if (randRate >= originalShockRate) {
      permBeatenCount++;
    }
  }

  const pValue = permBeatenCount / numPermutations;
  console.log(`   • Empirischer p-Wert: p = ${pValue.toFixed(4)} (${permBeatenCount} von ${numPermutations} Durchläufen erreichten die Rate)`);
  console.log(`   • Urteil Signifikanz: ${pValue < 0.01 ? '✅ HOCHGRADIG SIGNIFIKANT (p < 0.01, H0 statistisch widerlegt!)' : '⚠️ NICHT SIGNIFIKANT'}\n`);

  // C. Singularitäts- & Grenzfall-Check
  console.log('C. Singularitäts- & Grenzfall-Härtung (Crash-Prüfung):');
  const singularityTest1 = classifyRegime({ wresbal: 0, rrp: 0, gdp: 0, borrow: 0 });
  const singularityTest2 = classifyRegime({ wresbal: null, rrp: null, gdp: 28000, borrow: NaN });
  const singularityTest3 = classifyRegime({ wresbal: 1000, rrp: 0, gdp: -500, borrow: 10 });
  console.log(`   • GDP = 0: ${singularityTest1} (Erwartet: UNKNOWN) -> ${singularityTest1 === LclorRegime.UNKNOWN ? '✅ OK' : '❌ FAIL'}`);
  console.log(`   • Null / NaN Inputs: ${singularityTest2} (Erwartet: UNKNOWN) -> ${singularityTest2 === LclorRegime.UNKNOWN ? '✅ OK' : '❌ FAIL'}`);
  console.log(`   • Negatives GDP: ${singularityTest3} (Erwartet: UNKNOWN) -> ${singularityTest3 === LclorRegime.UNKNOWN ? '✅ OK' : '❌ FAIL'}\n`);

  // 5. Speichern der Ergebnisse
  const finalResults = {
    testDate: new Date().toISOString(),
    author: 'CrashRadar Intelligence Engine (Modus Code-Buddy)',
    testedEra: '2009-01-01 bis 2026-09-30 (Ample Reserves Framework)',
    totalDaysAnalyzed: analyzedDays.length,
    cohorts: {
      regime1ExcessBuffer: cohortR1,
      regime2ModerateSlack: cohortR2,
      regime3LclorDanger: cohortR3,
      regime4AcuteCrisis: cohortR4,
      combinedDanger: cohortCombinedDanger
    },
    hypothesisMetrics: {
      riskRatioDd8: Number(riskRatioDd8.toFixed(2)),
      riskRatioCombined: Number(riskRatioCombined.toFixed(2)),
      pValue: Number(pValue.toFixed(4)),
      isHypothesisConfirmed: riskRatioDd8 >= 2.0 && pValue < 0.05
    },
    chaosEngineering: {
      noiseShockRate: Number(noiseShockRate.toFixed(2)),
      originalShockRate: Number(originalShockRate.toFixed(2)),
      noiseDeltaPct: Number(noiseDelta.toFixed(2)),
      isNoiseRobust: noiseDelta < 5.0,
      pValue: Number(pValue.toFixed(4))
    },
    episodes,
    historicalValidation: {
      repo2019Hit,
      svb2023Hit,
      current2026Hit
    }
  };

  const outputPath = 'data/cache/portfolio_compass/adr008_test_results.json';
  fs.writeFileSync(outputPath, JSON.stringify(finalResults, null, 2));
  console.log(`✅ Ergebnisse erfolgreich persistiert in: ${outputPath}`);

  await expert.close();
}

runLclorBacktest().catch(console.error);
