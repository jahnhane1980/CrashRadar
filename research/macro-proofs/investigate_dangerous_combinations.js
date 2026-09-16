import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { DerivativesSensorHub } from '../../src/signals/hubs/DerivativesSensorHub.js';
import { LiquiditySensorHub } from '../../src/signals/hubs/LiquiditySensorHub.js';
import { GoldilocksSensorHub } from '../../src/signals/hubs/GoldilocksSensorHub.js';

dotenv.config();

async function analyzeDangerCombinations() {
  console.log('================================================================================');
  console.log('   EMPIRISCHE ANALYSE: WELCHE KOMBINATIONEN SIND WIRKLICH GEFÄHRLICH?');
  console.log('   UNTERSUCHUNG ALLER SPY-KORREKTUREN & CRASHES (> 5% DD) 2018 - 2026');
  console.log('================================================================================\n');

  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });

  const derivHub = new DerivativesSensorHub();
  const liqHub = new LiquiditySensorHub();
  const goldiHub = new GoldilocksSensorHub();

  // Finde alle Tage, an denen der Markt in den folgenden 20 Tagen um mehr als 5% einbrach
  // und vergleiche sie mit Tagen, an denen ein Rücksetzer sofort gekauft wurde (V-Shape Rebound)
  const events = [];

  for (let i = 200; i < timeline.length - 20; i++) {
    const day = timeline[i];
    const spy = day.assets?.SPY;
    if (!spy) continue;

    // Vorherige 5-Tage Performance (ist der Markt bereits im Dip?)
    const spyPrev5 = timeline[i - 5]?.assets?.SPY;
    const dip5d = spyPrev5 ? ((spy - spyPrev5) / spyPrev5) * 100 : 0;

    // Vorherige 200 SMA
    let sma200Sum = 0;
    for (let k = i - 199; k <= i; k++) sma200Sum += (timeline[k].assets?.SPY || spy);
    const sma200 = sma200Sum / 200;
    const isAboveSma200 = spy >= sma200;

    // Vorwärts-Drawdown in den nächsten 20 Tagen
    let minForward = spy;
    for (let j = i; j <= i + 20; j++) {
      const p = timeline[j].assets?.SPY;
      if (p && p < minForward) minForward = p;
    }
    const forwardDd20 = ((minForward - spy) / spy) * 100;
    const forwardRet20 = ((timeline[i + 20].assets?.SPY - spy) / spy) * 100;

    // Nur Tage betrachten, wo entweder:
    // A) Akute Gefahr bestand (forwardDd20 <= -6.0% -> CRASH / DEEP DROP)
    // B) Oder ein Dip vorlag (dip5d <= -1.5%), der sich als hervorragender V-Rebound erwies (forwardRet20 > +3.0% und forwardDd20 > -2.5%)
    const isCrashTrap = forwardDd20 <= -6.0;
    const isGoodDip = dip5d <= -1.5 && forwardRet20 >= +3.0 && forwardDd20 >= -2.5;

    if (!isCrashTrap && !isGoodDip) continue;

    // Auswertung der Sensoren
    const slice = timeline.slice(0, i + 1);
    const derivRes = derivHub.evaluate(slice);
    const liqRes = liqHub.evaluate(slice);
    const goldiRes = goldiHub.evaluate(slice);

    // Makro-Metriken
    const mg = day.macroGroups;
    const nl = mg?.NetLiquidity?.NetLiquidity;
    const prevNl = timeline[Math.max(0, i - 21)]?.macroGroups?.NetLiquidity?.NetLiquidity;
    const nlDelta4w = (nl && prevNl) ? ((nl - prevNl) / prevNl) * 100 : 0;

    const vix = day.assets?.VIX || 15;
    const realYield = mg?.FinancialConditions?.RealYield10y ?? 2.0;
    const prevRealYield = timeline[Math.max(0, i - 42)]?.macroGroups?.FinancialConditions?.RealYield10y ?? realYield;
    const realYieldDelta2m = realYield - prevRealYield;

    const creditHyg = day.assets?.HYG;
    const prevHyg = timeline[Math.max(0, i - 21)]?.assets?.HYG;
    const hygDelta4w = (creditHyg && prevHyg) ? ((creditHyg - prevHyg) / prevHyg) * 100 : 0;

    events.push({
      date: day.date,
      type: isCrashTrap ? 'CRASH_TRAP' : 'GOLDEN_DIP',
      spy,
      isAboveSma200,
      dip5d,
      forwardDd20,
      forwardRet20,
      vix,
      derivRegime: derivRes.regime,
      derivStatus: derivRes.status,
      liqStatus: liqRes.status,
      liqRegime: liqRes.regime,
      liquidSlackB: liqRes.liquidSlackBillion,
      ttcDays: liqRes.ttcDays,
      catalystStatus: liqRes.catalystStatus,
      dualMacroStress: liqRes.diagnostics?.dualMacroStress ?? 0,
      nlDelta4w,
      realYield,
      realYieldDelta2m,
      hygDelta4w
    });
  }

  console.log(`Gefundene Signaltage: ${events.length}`);
  const crashes = events.filter(e => e.type === 'CRASH_TRAP');
  const goodDips = events.filter(e => e.type === 'GOLDEN_DIP');
  console.log(`- Echte Absturz-Fallen (Forward DD <= -6%): ${crashes.length}`);
  console.log(`- Perfekte Buy-the-Dip Tage (Rebound > +3%): ${goodDips.length}\n`);

  // Cluster-Analyse der gefährlichsten Kombinationen
  console.log('--------------------------------------------------------------------------------');
  console.log('CLUSTER-TEST DER KOMBINATIONEN: TRENNUNG ZWISCHEN CRASH-FALLE & BUY-THE-DIP');
  console.log('--------------------------------------------------------------------------------');

  const combinations = [
    {
      name: 'Kombi 1: Akuter Geldmarkt-Drain (TTC < 30d ODER IMMINENT_DRAIN)',
      filter: e => (e.ttcDays !== null && e.ttcDays < 30) || e.catalystStatus === 'IMMINENT_DRAIN'
    },
    {
      name: 'Kombi 2: Liquiditätsentzug (NL 4w-Delta < -2.5%) UND SPY unter SMA200',
      filter: e => e.nlDelta4w < -2.5 && !e.isAboveSma200
    },
    {
      name: 'Kombi 3: Zins-Schock (Realzins-Anstieg > +0.30% in 2 Monaten) UND Kredit-Stress (HYG -2%)',
      filter: e => e.realYieldDelta2m > 0.30 && e.hygDelta4w < -2.0
    },
    {
      name: 'Kombi 4: Dualer Makrostress hoch (DualStress >= 55) & VIX > 25',
      filter: e => e.dualMacroStress >= 55 && e.vix > 25
    },
    {
      name: 'Kombi 5: "Puffer-Phase" (Slack < 50, aber TTC >= 90d & TGA-Cushion aktiv)',
      filter: e => e.liquidSlackB < 50 && (e.ttcDays === null || e.ttcDays >= 90)
    }
  ];

  for (const c of combinations) {
    const hitsCrash = crashes.filter(c.filter).length;
    const hitsDips = goodDips.filter(c.filter).length;
    const precisionCrash = hitsCrash + hitsDips > 0 ? ((hitsCrash / (hitsCrash + hitsDips)) * 100).toFixed(1) : 'N/A';
    console.log(`• ${c.name}:`);
    console.log(`  -> Schlägt an bei Crashes:  ${hitsCrash} von ${crashes.length} (${((hitsCrash / crashes.length) * 100).toFixed(1)} %)`);
    console.log(`  -> Schlägt an bei guten Dips: ${hitsDips} von ${goodDips.length} (${((hitsDips / goodDips.length) * 100).toFixed(1)} %)`);
    console.log(`  -> Crash-Präzision (Alarm-Glaubwürdigkeit): ${precisionCrash} %\n`);
  }

  // Zeitraum-Historie der schwersten Crashes
  console.log('================================================================================');
  console.log('DIE GROSSEN HISTORISCHEN ABSTURZ-PHASEN: WAS WAR DER TREIBER?');
  console.log('================================================================================');
  const distinctCrashPeriods = [
    { name: 'Corona Crash (Feb/März 2020)', date: '2020-02-24' },
    { name: 'Fed Zins-Schock 1 (Januar 2022)', date: '2022-01-14' },
    { name: 'Fed QT & Zins-Welle 2 (April 2022)', date: '2022-04-18' },
    { name: 'Jackson Hole Powell Crash (August 2022)', date: '2022-08-22' },
    { name: 'Silicon Valley Bank (März 2023)', date: '2023-03-08' },
    { name: 'Zinsgipfel-Angst (September 2023)', date: '2023-09-15' },
    { name: 'Yen Carry Crash (August 2024)', date: '2024-08-02' },
    { name: 'Zoll- & Refill-Rücksetzer (Feb/März 2025)', date: '2025-02-24' }
  ];

  for (const p of distinctCrashPeriods) {
    const idx = timeline.findIndex(t => t.date >= p.date);
    if (idx === -1) continue;
    const slice = timeline.slice(0, idx + 1);
    const day = timeline[idx];
    const liq = liqHub.evaluate(slice);
    const goldi = goldiHub.evaluate(slice);
    const deriv = derivHub.evaluate(slice);

    const realY = day.macroGroups?.FinancialConditions?.RealYield10y;
    const pastRealY = timeline[Math.max(0, idx - 42)]?.macroGroups?.FinancialConditions?.RealYield10y || realY;
    const deltaRy = realY - pastRealY;

    const hyg = day.assets?.HYG;
    const pastHyg = timeline[Math.max(0, idx - 21)]?.assets?.HYG || hyg;
    const deltaHyg = ((hyg - pastHyg) / pastHyg) * 100;

    console.log(`\n📌 ${p.name} [${day.date}] | SPY: ${day.assets?.SPY}$`);
    console.log(`   - Liquidität Status/Regime: ${liq.status} / ${liq.regime} (Slack: $${liq.liquidSlackBillion}B | TTC: ${liq.ttcDays}d | Catalyst: ${liq.catalystStatus})`);
    console.log(`   - Zins- & Makro-Dynamik:    Realzins: ${realY?.toFixed(2)}% (2m-Delta: ${deltaRy >= 0 ? '+' : ''}${deltaRy.toFixed(2)}%) | HYG-Kredit: ${deltaHyg.toFixed(1)}%`);
    const pcrVal = day.assets?.TotalPCR != null ? Number(day.assets.TotalPCR).toFixed(2) : 'N/A';
    console.log(`   - Derivate-Zustand:         ${deriv.regime} (VIX: ${day.assets?.VIX?.toFixed(1) || 'N/A'} | PCR: ${pcrVal})`);
  }

  process.exit(0);
}

analyzeDangerCombinations().catch(err => {
  console.error(err);
  process.exit(1);
});
