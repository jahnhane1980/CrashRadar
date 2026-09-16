import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { DerivativesCycleService } from '../../src/services/DerivativesCycleService.js';
import { DerivativesSensorHub } from '../../src/signals/hubs/DerivativesSensorHub.js';
import { LiquiditySensorHub } from '../../src/signals/hubs/LiquiditySensorHub.js';
import { SignalStatus, LiquidityRegime } from '../../src/signals/contracts/SignalTypes.js';

dotenv.config();

async function runLiquidityGatekeeperTest() {
  console.log('================================================================================');
  console.log('   STRESSTEST: LIQUIDITY-SENSORHUB ALS VETO-GATEKEEPER FÜR DERIVATE');
  console.log('   KANN LIQUIDITÄTS- & GELDMARKT-STRESS BULL-TRAPS VERHINDERN?');
  console.log('================================================================================\n');

  const fe = new FinanceExpert();
  // Lade Daten ab 2018 für saubere rollierende Lookbacks
  const timeline = await fe.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (Von ${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})\n`);

  const derivHub = new DerivativesSensorHub();
  const liqHub = new LiquiditySensorHub();

  // Finde alle OpEx-Termine ab 2020 bis September 2026
  const opexEvents = [];
  for (let y = 2020; y <= 2026; y++) {
    for (let m = 0; m < 12; m++) {
      if (y === 2026 && m > 8) break;
      const thirdFriday = DerivativesCycleService.getThirdFriday(y, m);
      const dStr = thirdFriday.toISOString().split('T')[0];
      opexEvents.push({
        date: dStr,
        year: y,
        month: m + 1,
        isQuad: DerivativesCycleService.isQuadrupleWitching(m),
        type: DerivativesCycleService.isQuadrupleWitching(m) ? 'HEXENSABBAT' : 'MONATS-OPEX'
      });
    }
  }

  const evaluated = [];

  for (const event of opexEvents) {
    const opexIdx = timeline.findIndex(t => t.date >= event.date);
    if (opexIdx === -1 || opexIdx < 200 || opexIdx + 40 >= timeline.length) continue;

    const opexDay = timeline[opexIdx];
    const pre5Day = timeline[opexIdx - 5];
    const post5Day = timeline[opexIdx + 5];
    const post20Day = timeline[opexIdx + 20];
    const post40Day = timeline[opexIdx + 40];

    const spyOpex = opexDay.assets?.SPY;
    const spyPre = pre5Day?.assets?.SPY;
    const spyPost5 = post5Day?.assets?.SPY;
    const spyPost20 = post20Day?.assets?.SPY;
    const spyPost40 = post40Day?.assets?.SPY;

    if (!spyOpex || !spyPre || !spyPost5 || !spyPost20) continue;

    // SMA 200 des SPY am OpEx-Tag berechnen
    let sma200Sum = 0;
    let sma200Count = 0;
    for (let i = opexIdx - 199; i <= opexIdx; i++) {
      const p = timeline[i].assets?.SPY;
      if (p) {
        sma200Sum += p;
        sma200Count++;
      }
    }
    const sma200 = sma200Count > 0 ? sma200Sum / sma200Count : spyOpex;
    const isAboveSma200 = spyOpex >= sma200;

    // Slice bis zum OpEx-Tag für kausale Inferenz (kein Lookahead-Bias!)
    const sliceUntilOpex = timeline.slice(0, opexIdx + 1);

    const derivRes = derivHub.evaluate(sliceUntilOpex);
    const liqRes = liqHub.evaluate(sliceUntilOpex);

    // Performance nach OpEx
    const post5ReturnPct = ((spyPost5 - spyOpex) / spyOpex) * 100;
    const post20ReturnPct = ((spyPost20 - spyOpex) / spyOpex) * 100;
    const post40ReturnPct = spyPost40 ? ((spyPost40 - spyOpex) / spyOpex) * 100 : null;

    // Max Drawdowns nach OpEx
    let minSpy20 = spyOpex;
    for (let j = opexIdx; j <= opexIdx + 20; j++) {
      const p = timeline[j].assets?.SPY;
      if (p && p < minSpy20) minSpy20 = p;
    }
    const maxDd20 = ((minSpy20 - spyOpex) / spyOpex) * 100;

    let minSpy40 = spyOpex;
    for (let j = opexIdx; j <= Math.min(timeline.length - 1, opexIdx + 40); j++) {
      const p = timeline[j].assets?.SPY;
      if (p && p < minSpy40) minSpy40 = p;
    }
    const maxDd40 = ((minSpy40 - spyOpex) / spyOpex) * 100;

    // Bull Trap Definition:
    // Nach OpEx sieht es erst neutral/bullisch aus (> -1.0% an Tag 5),
    // aber dann bricht der Markt innerhalb 20d um >= 5% oder innerhalb 40d um >= 9% ein.
    const isBullTrap = (post5ReturnPct > -1.0 && maxDd20 <= -5.0) || (maxDd40 <= -9.0);
    const isSuccessfulRebound = post5ReturnPct > 0 && maxDd20 > -3.5 && post20ReturnPct > 0;

    evaluated.push({
      date: event.date,
      type: event.type,
      spyOpex,
      sma200,
      isAboveSma200,
      derivRegime: derivRes.regime,
      derivStatus: derivRes.status,
      liqRegime: liqRes.regime,
      liqStatus: liqRes.status,
      liquidSlackB: liqRes.liquidSlackBillion,
      effectiveSlackB: liqRes.effectiveSlackBillion,
      ttcDays: liqRes.ttcDays,
      catalystStatus: liqRes.catalystStatus,
      dualMacroStress: liqRes.diagnostics?.dualMacroStress ?? 0,
      liquidityStress: liqRes.diagnostics?.liquidityStress ?? 0,
      rateValuationStress: liqRes.diagnostics?.rateValuationStress ?? 0,
      post5ReturnPct,
      post20ReturnPct,
      post40ReturnPct,
      maxDd20,
      maxDd40,
      isBullTrap,
      isSuccessfulRebound
    });
  }

  console.log(`Analysierte OpEx-Events (2020 - 2026): ${evaluated.length}\n`);

  const allTraps = evaluated.filter(e => e.isBullTrap);
  const allRebounds = evaluated.filter(e => e.isSuccessfulRebound);

  console.log('--------------------------------------------------------------------------------');
  console.log('1. AUSGANGSLAGE OHNE FILTER (Derivate allein):');
  console.log('--------------------------------------------------------------------------------');
  console.log(`  - Alle Events:                     ${evaluated.length}`);
  console.log(`  - Bull Traps (Gefallene Rebounds): ${allTraps.length} (${((allTraps.length / evaluated.length) * 100).toFixed(1)} %)`);
  console.log(`  - Erfolgreiche Rebounds:           ${allRebounds.length} (${((allRebounds.length / evaluated.length) * 100).toFixed(1)} %)\n`);

  // ---------------------------------------------------------------------------
  // FILTER 1: HARD VETO (Status !== OK -> Block)
  // ---------------------------------------------------------------------------
  const isHardBlock = e => e.liqStatus === SignalStatus.WARNING || e.liqStatus === SignalStatus.CRITICAL;
  const hardPassed = evaluated.filter(e => !isHardBlock(e));
  const hardPassedTraps = hardPassed.filter(e => e.isBullTrap);
  const hardPassedRebounds = hardPassed.filter(e => e.isSuccessfulRebound);
  const hardBlocked = evaluated.filter(e => isHardBlock(e));
  const hardBlockedTraps = hardBlocked.filter(e => e.isBullTrap);
  const hardBlockedRebounds = hardBlocked.filter(e => e.isSuccessfulRebound);

  console.log('--------------------------------------------------------------------------------');
  console.log('2. FILTER 1: HARTER LIQUIDITÄTS-FILTER (Status != OK [WARNING & CRITICAL] -> BLOCK)');
  console.log('--------------------------------------------------------------------------------');
  console.log(`  - Freigegebene Trades (PASS):      ${hardPassed.length} von ${evaluated.length} (${((hardPassed.length / evaluated.length) * 100).toFixed(1)} %)`);
  console.log(`  - Verbliebene Bull Traps:          ${hardPassedTraps.length} (${((hardPassedTraps.length / (hardPassed.length || 1)) * 100).toFixed(1)} %)`);
  console.log(`  - Erfolgreiche Rebounds im Pass:   ${hardPassedRebounds.length} (${((hardPassedRebounds.length / (hardPassed.length || 1)) * 100).toFixed(1)} %)`);
  console.log(`  - VERHINDERTE BULL TRAPS (Saved):  ${hardBlockedTraps.length} von ${allTraps.length} (${((hardBlockedTraps.length / allTraps.length) * 100).toFixed(1)} %)`);
  console.log(`  - Verpasste Rebounds (Kosten):     ${hardBlockedRebounds.length} von ${allRebounds.length} (${((hardBlockedRebounds.length / allRebounds.length) * 100).toFixed(1)} % Opportunitätskosten)\n`);

  // ---------------------------------------------------------------------------
  // FILTER 2: NUR CRITICAL (Status === CRITICAL -> Block)
  // ---------------------------------------------------------------------------
  const isCriticalBlock = e => e.liqStatus === SignalStatus.CRITICAL;
  const critPassed = evaluated.filter(e => !isCriticalBlock(e));
  const critPassedTraps = critPassed.filter(e => e.isBullTrap);
  const critPassedRebounds = critPassed.filter(e => e.isSuccessfulRebound);
  const critBlocked = evaluated.filter(e => isCriticalBlock(e));
  const critBlockedTraps = critBlocked.filter(e => e.isBullTrap);
  const critBlockedRebounds = critBlocked.filter(e => e.isSuccessfulRebound);

  console.log('--------------------------------------------------------------------------------');
  console.log('3. FILTER 2: NUR CRITICAL VETO (Status === CRITICAL [dualMacroStress >= 75] -> BLOCK)');
  console.log('--------------------------------------------------------------------------------');
  console.log(`  - Freigegebene Trades (PASS):      ${critPassed.length} von ${evaluated.length} (${((critPassed.length / evaluated.length) * 100).toFixed(1)} %)`);
  console.log(`  - Verbliebene Bull Traps:          ${critPassedTraps.length} (${((critPassedTraps.length / (critPassed.length || 1)) * 100).toFixed(1)} %)`);
  console.log(`  - Erfolgreiche Rebounds im Pass:   ${critPassedRebounds.length} (${((critPassedRebounds.length / (critPassed.length || 1)) * 100).toFixed(1)} %)`);
  console.log(`  - VERHINDERTE BULL TRAPS (Saved):  ${critBlockedTraps.length} von ${allTraps.length} (${((critBlockedTraps.length / allTraps.length) * 100).toFixed(1)} %)`);
  console.log(`  - Verpasste Rebounds (Kosten):     ${critBlockedRebounds.length} von ${allRebounds.length} (${((critBlockedRebounds.length / allRebounds.length) * 100).toFixed(1)} %)\n`);

  // ---------------------------------------------------------------------------
  // FILTER 3: TTC COLLISION & IMMINENT DRAIN (Zeitliche Kollision)
  // Block nur wenn Time-To-Collision < 30 Tage ODER IMMINENT_DRAIN
  // ---------------------------------------------------------------------------
  const isTtcBlock = e => (e.ttcDays !== null && e.ttcDays < 30) || e.catalystStatus === 'IMMINENT_DRAIN';
  const ttcPassed = evaluated.filter(e => !isTtcBlock(e));
  const ttcPassedTraps = ttcPassed.filter(e => e.isBullTrap);
  const ttcPassedRebounds = ttcPassed.filter(e => e.isSuccessfulRebound);
  const ttcBlocked = evaluated.filter(e => isTtcBlock(e));
  const ttcBlockedTraps = ttcBlocked.filter(e => e.isBullTrap);
  const ttcBlockedRebounds = ttcBlocked.filter(e => e.isSuccessfulRebound);

  console.log('--------------------------------------------------------------------------------');
  console.log('4. FILTER 3: TTC COLLISION FILTER (TTC < 30 Tage oder IMMINENT_DRAIN -> BLOCK)');
  console.log('--------------------------------------------------------------------------------');
  console.log(`  - Freigegebene Trades (PASS):      ${ttcPassed.length} von ${evaluated.length} (${((ttcPassed.length / evaluated.length) * 100).toFixed(1)} %)`);
  console.log(`  - Verbliebene Bull Traps:          ${ttcPassedTraps.length} (${((ttcPassedTraps.length / (ttcPassed.length || 1)) * 100).toFixed(1)} %)`);
  console.log(`  - Erfolgreiche Rebounds im Pass:   ${ttcPassedRebounds.length} (${((ttcPassedRebounds.length / (ttcPassed.length || 1)) * 100).toFixed(1)} %)`);
  console.log(`  - VERHINDERTE BULL TRAPS (Saved):  ${ttcBlockedTraps.length} von ${allTraps.length} (${((ttcBlockedTraps.length / allTraps.length) * 100).toFixed(1)} %)`);
  console.log(`  - Verpasste Rebounds (Kosten):     ${ttcBlockedRebounds.length} von ${allRebounds.length} (${((ttcBlockedRebounds.length / allRebounds.length) * 100).toFixed(1)} %)\n`);

  // ---------------------------------------------------------------------------
  // FILTER 4: DUAL-REGIME: LIQUIDITY DRAIN + SPY < SMA 200
  // (Nur blocken, wenn Geldmarkt im Stress IST UND der Markt im Abwärtstrend unter SMA 200 notiert)
  // ---------------------------------------------------------------------------
  const isSmartLiqBlock = e => isHardBlock(e) && !e.isAboveSma200;
  const smartLiqPassed = evaluated.filter(e => !isSmartLiqBlock(e));
  const smartLiqPassedTraps = smartLiqPassed.filter(e => e.isBullTrap);
  const smartLiqPassedRebounds = smartLiqPassed.filter(e => e.isSuccessfulRebound);
  const smartLiqBlocked = evaluated.filter(e => isSmartLiqBlock(e));
  const smartLiqBlockedTraps = smartLiqBlocked.filter(e => e.isBullTrap);
  const smartLiqBlockedRebounds = smartLiqBlocked.filter(e => e.isSuccessfulRebound);

  console.log('--------------------------------------------------------------------------------');
  console.log('5. FILTER 4: SMART DUAL-FILTER (LIQUIDITY WARNING/CRITICAL & SPY < SMA 200 -> BLOCK)');
  console.log('   (Erlaubt Rebounds im Bullenmarkt, blockt Rebounds im liquiditätsgestressten Bärenmarkt)');
  console.log('--------------------------------------------------------------------------------');
  console.log(`  - Freigegebene Trades (PASS):      ${smartLiqPassed.length} von ${evaluated.length} (${((smartLiqPassed.length / evaluated.length) * 100).toFixed(1)} %)`);
  console.log(`  - Verbliebene Bull Traps:          ${smartLiqPassedTraps.length} (${((smartLiqPassedTraps.length / (smartLiqPassed.length || 1)) * 100).toFixed(1)} %)`);
  console.log(`  - Erfolgreiche Rebounds im Pass:   ${smartLiqPassedRebounds.length} (${((smartLiqPassedRebounds.length / (smartLiqPassed.length || 1)) * 100).toFixed(1)} %)`);
  console.log(`  - VERHINDERTE BULL TRAPS (Saved):  ${smartLiqBlockedTraps.length} von ${allTraps.length} (${((smartLiqBlockedTraps.length / allTraps.length) * 100).toFixed(1)} %)`);
  console.log(`  - Verpasste Rebounds (Kosten):     ${smartLiqBlockedRebounds.length} von ${allRebounds.length} (${((smartLiqBlockedRebounds.length / allRebounds.length) * 100).toFixed(1)} %)\n`);

  // ---------------------------------------------------------------------------
  // DETAIL-ANALYSE DER 5 HISTORISCHEN BULL TRAPS
  // ---------------------------------------------------------------------------
  console.log('================================================================================');
  console.log('6. DIE HISTORISCHEN BULL TRAPS IM DETAIL: WAS SAH DER LIQUIDITY-SENSORHUB?');
  console.log('================================================================================');
  const trapTable = allTraps.map(t => ({
    Datum: t.date,
    Typ: t.type,
    'SPY > SMA200': t.isAboveSma200 ? 'JA (Bull)' : 'NEIN (Bear)',
    'Liq Status': t.liqStatus,
    'Liq Regime': t.liqRegime,
    'Dual Stress': t.dualMacroStress.toFixed(1),
    'TTC Days': t.ttcDays !== null ? t.ttcDays : 'N/A',
    'Catalyst': t.catalystStatus,
    'Hard Veto?': isHardBlock(t) ? '✅ GEBLOCKT' : '❌ VERPASST',
    'Smart Veto?': isSmartLiqBlock(t) ? '✅ GEBLOCKT' : '❌ VERPASST',
    'Max DD 20d': `${t.maxDd20.toFixed(1)}%`,
    'Max DD 40d': `${t.maxDd40.toFixed(1)}%`
  }));
  console.table(trapTable);

  // ---------------------------------------------------------------------------
  // DETAIL-ANALYSE DER GEBLOCKTEN REBOUNDS (OPPORTUNITÄTSKOSTEN)
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('7. GEFAHRENZONE DER OPPORTUNITÄTSKOSTEN: WELCHE TOP-REBOUNDS WÄREN VERLOREN GEGANGEN?');
  console.log('================================================================================');
  const topBlockedRebounds = hardBlockedRebounds
    .sort((a, b) => b.post20ReturnPct - a.post20ReturnPct)
    .slice(0, 10)
    .map(r => ({
      Datum: r.date,
      Typ: r.type,
      'SPY > SMA200': r.isAboveSma200 ? 'JA' : 'NEIN',
      'Liq Status': r.liqStatus,
      'Dual Stress': r.dualMacroStress.toFixed(1),
      'TTC': r.ttcDays !== null ? r.ttcDays : 'N/A',
      'Return 5d': `+${r.post5ReturnPct.toFixed(1)}%`,
      'Return 20d': `+${r.post20ReturnPct.toFixed(1)}%`,
      'Smart Veto?': isSmartLiqBlock(r) ? 'GEBLOCKT' : 'DURCHGELASSEN ✅'
    }));
  console.table(topBlockedRebounds);
}

runLiquidityGatekeeperTest().catch(console.error);
