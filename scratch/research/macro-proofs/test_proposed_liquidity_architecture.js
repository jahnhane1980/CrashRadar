import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { DerivativesSensorHub } from '../../../src/signals/hubs/DerivativesSensorHub.js';
import { LiquiditySensorHub } from '../../../src/signals/hubs/LiquiditySensorHub.js';
import { SignalStatus } from '../../../src/signals/contracts/SignalTypes.js';

dotenv.config();

async function testProposedLogic() {
  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  const liqHub = new LiquiditySensorHub();
  const derivHub = new DerivativesSensorHub();

  console.log('================================================================================');
  console.log('TEST DER NEUEN LOGIK: BUFFERED_CUSHION + TOXIC_TRAP + TTC < 30');
  console.log('================================================================================');

  // Evaluiere die neue Logik über die gesamte Timeline (2020 - 2026)
  let bufferedDays = 0;
  let toxicTrapDays = 0;
  let ttcCollisionDays = 0;
  let normalExpansionDays = 0;

  for (let i = 200; i < timeline.length; i++) {
    const slice = timeline.slice(0, i + 1);
    const day = timeline[i];
    const liqRes = liqHub.evaluate(slice);
    const vix = day.assets?.VIX ?? 15;

    const dualStress = liqRes.diagnostics?.dualMacroStress ?? 0;
    const ttc = liqRes.ttcDays;
    const isBuffered = liqRes.diagnostics?.tgaCushionB > 50 && (liqRes.diagnostics?.monthlyBuybacksBillion >= 5.0);
    const slack = liqRes.liquidSlackBillion;
    const isAcuteDrain = liqRes.catalystStatus === 'IMMINENT_DRAIN' || (ttc !== null && ttc < 30);

    // Neue Klassifizierung:
    let newRegime = 'EXPANSION';
    let newStatus = SignalStatus.OK;

    const isToxicTrap = dualStress >= 55 && vix > 25;

    if (isToxicTrap || isAcuteDrain || dualStress >= 75) {
      newRegime = isToxicTrap ? 'TOXIC_LIQUIDITY_TRAP' : 'CRITICAL_DRAIN';
      newStatus = SignalStatus.CRITICAL;
      if (isToxicTrap) toxicTrapDays++;
      if (isAcuteDrain) ttcCollisionDays++;
    } else if (dualStress >= 55) {
      newRegime = 'DRAIN_WARNING';
      newStatus = SignalStatus.WARNING;
    } else if (slack < 50 && isBuffered) {
      newRegime = 'BUFFERED_CUSHION';
      newStatus = SignalStatus.OK; // Puffer ist OK! Kein Alarm!
      bufferedDays++;
    } else {
      normalExpansionDays++;
    }
  }

  console.log(`Verteilung der neuen Zustände (2020 - 2026):`);
  console.log(`- BUFFERED_CUSHION (Entwarnung / Puffer): ${bufferedDays} Tage`);
  console.log(`- EXPANSION (Normal grün):              ${normalExpansionDays} Tage`);
  console.log(`- TOXIC_LIQUIDITY_TRAP (Makrostress & VIX > 25): ${toxicTrapDays} Tage`);
  console.log(`- TTC_COLLISION / IMMINENT_DRAIN:       ${ttcCollisionDays} Tage`);
  console.log('--------------------------------------------------------------------------------\n');

  // Prüfe den OpEx-Stresstest mit dieser neuen Logik:
  // Finde alle 79 OpEx Events
  const { DerivativesCycleService } = await import('../../../src/services/DerivativesCycleService.js');
  const opexEvents = [];
  for (let y = 2020; y <= 2026; y++) {
    for (let m = 0; m < 12; m++) {
      if (y === 2026 && m > 8) break;
      const thirdFriday = DerivativesCycleService.getThirdFriday(y, m);
      opexEvents.push({ date: thirdFriday.toISOString().split('T')[0] });
    }
  }

  let totalOpex = 0;
  let opexPass = 0;
  let opexBlock = 0;
  let trapsBlocked = 0;
  let trapsPassed = 0;
  let reboundsPassed = 0;
  let reboundsBlocked = 0;

  for (const ev of opexEvents) {
    const idx = timeline.findIndex(t => t.date >= ev.date);
    if (idx === -1 || idx < 200 || idx + 40 >= timeline.length) continue;

    const opexDay = timeline[idx];
    const post5 = timeline[idx + 5]?.assets?.SPY;
    const post20 = timeline[idx + 20]?.assets?.SPY;
    const spyOpex = opexDay.assets?.SPY;

    let min20 = spyOpex;
    for (let j = idx; j <= idx + 20; j++) {
      const p = timeline[j].assets?.SPY;
      if (p && p < min20) min20 = p;
    }
    const maxDd20 = ((min20 - spyOpex) / spyOpex) * 100;
    const ret5 = ((post5 - spyOpex) / spyOpex) * 100;
    const ret20 = ((post20 - spyOpex) / spyOpex) * 100;

    const isBullTrap = (ret5 > -1.0 && maxDd20 <= -5.0);
    const isGoodRebound = ret5 > 0 && maxDd20 > -3.5 && ret20 > 0;

    const slice = timeline.slice(0, idx + 1);
    const liqRes = liqHub.evaluate(slice);
    const vix = opexDay.assets?.VIX ?? 15;
    const dualStress = liqRes.diagnostics?.dualMacroStress ?? 0;
    const ttc = liqRes.ttcDays;
    const isAcuteDrain = liqRes.catalystStatus === 'IMMINENT_DRAIN' || (ttc !== null && ttc < 30);
    const isToxicTrap = dualStress >= 55 && vix > 25;

    // Nur ECHTE Gefahren blocken:
    const isBlock = isToxicTrap || isAcuteDrain;

    totalOpex++;
    if (isBlock) {
      opexBlock++;
      if (isBullTrap) trapsBlocked++;
      if (isGoodRebound) reboundsBlocked++;
    } else {
      opexPass++;
      if (isBullTrap) trapsPassed++;
      if (isGoodRebound) reboundsPassed++;
    }
  }

  console.log('OPEX-BILANZ MIT DER NEUEN LOGIK (Nur ToxicTrap & TTC < 30 blocken):');
  console.log(`- Freigegebene Trades: ${opexPass} von ${totalOpex} (${((opexPass/totalOpex)*100).toFixed(1)} %)`);
  console.log(`- Verhinderte Bull Traps: ${trapsBlocked} geblockt!`);
  console.log(`- Verbliebene Bull Traps: ${trapsPassed}`);
  console.log(`- Verpasste gute Rebounds: nur ${reboundsBlocked} von ${reboundsPassed + reboundsBlocked} (${((reboundsBlocked/(reboundsPassed + reboundsBlocked))*100).toFixed(1)} % Opportunitätskosten statt vorher 18-49%!)`);

  process.exit(0);
}

testProposedLogic().catch(console.error);
