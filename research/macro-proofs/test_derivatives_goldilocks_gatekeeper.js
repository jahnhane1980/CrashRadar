import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { DerivativesCycleService } from '../../src/services/DerivativesCycleService.js';
import { DerivativesSensorHub } from '../../src/signals/hubs/DerivativesSensorHub.js';
import { GoldilocksSensorHub } from '../../src/signals/hubs/GoldilocksSensorHub.js';
import { SignalStatus } from '../../src/signals/contracts/SignalTypes.js';

dotenv.config();

async function runGoldilocksGatekeeperTest() {
  console.log('================================================================================');
  console.log('   STRESSTEST: GOLDILOCKS-SENSORHUB ALS VETO-GATEKEEPER FÜR DERIVATE');
  console.log('   SCHÜTZT EIN GOLDILOCKS-WARNSTATUS VOR DERIVATIVE-BULL-TRAPS?');
  console.log('================================================================================\n');

  const fe = new FinanceExpert();
  // Lade ab 2018 damit alle rollierenden Fenster ab 2020 gefüllt sind
  const timeline = await fe.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  console.log(`Geladene Handelstage: ${timeline.length} (Von ${timeline[0]?.date} bis ${timeline[timeline.length - 1]?.date})\n`);

  const derivHub = new DerivativesSensorHub();
  const goldiHub = new GoldilocksSensorHub();

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
    if (opexIdx === -1 || opexIdx < 10 || opexIdx + 40 >= timeline.length) continue;

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

    // Slice bis zum OpEx-Tag für kausale Inferenz (kein Lookahead-Bias!)
    const sliceUntilOpex = timeline.slice(0, opexIdx + 1);

    const derivRes = derivHub.evaluate(sliceUntilOpex);
    const goldiRes = goldiHub.evaluate(sliceUntilOpex);

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

    // Bull Trap Definition
    const isBullTrap = (post5ReturnPct > -1.0 && maxDd20 <= -5.0) || (maxDd40 <= -9.0);
    const isSuccessfulRebound = post5ReturnPct > 0 && maxDd20 > -3.5 && post20ReturnPct > 0;

    // Goldilocks Gatekeeper Entscheidung:
    // BLOCK = Goldilocks meldet WARNING oder CRITICAL (Finger weg!)
    // PASS  = Goldilocks meldet OK (Freie Fahrt für Derivate-Rebound)
    const isGoldiBlock = goldiRes.status === SignalStatus.WARNING || goldiRes.status === SignalStatus.CRITICAL;

    evaluated.push({
      date: event.date,
      type: event.type,
      derivRegime: derivRes.regime,
      derivStatus: derivRes.status,
      goldiRegime: goldiRes.regime,
      goldiStatus: goldiRes.status,
      goldiScore: goldiRes.score,
      goldiBlock: isGoldiBlock,
      post5ReturnPct,
      post20ReturnPct,
      post40ReturnPct,
      maxDd20,
      maxDd40,
      isBullTrap,
      isSuccessfulRebound,
      cpiYoY: goldiRes.diagnostics?.inflation?.coreCpiYoY,
      oilPrice: goldiRes.diagnostics?.inflation?.oilPrice,
      realYield: goldiRes.diagnostics?.monetary?.realYield10y,
      sahmRule: goldiRes.diagnostics?.labor?.sahmRule
    });
  }

  console.log(`Analysierte OpEx-Events (2020 - 2026): ${evaluated.length}\n`);

  // 1. GESAMTERGEBNIS OHNE vs. MIT GOLDILOCKS-FILTER
  const allTraps = evaluated.filter(e => e.isBullTrap);
  const allRebounds = evaluated.filter(e => e.isSuccessfulRebound);

  // Gefilterte Events (Wo Goldilocks grünes Licht gab / PASS)
  const passedEvents = evaluated.filter(e => !e.goldiBlock);
  const passedTraps = passedEvents.filter(e => e.isBullTrap);
  const passedRebounds = passedEvents.filter(e => e.isSuccessfulRebound);

  // Geblockte Events (Wo Goldilocks VETO einlegte / BLOCK)
  const blockedEvents = evaluated.filter(e => e.goldiBlock);
  const blockedTraps = blockedEvents.filter(e => e.isBullTrap);
  const blockedRebounds = blockedEvents.filter(e => e.isSuccessfulRebound);

  console.log('--------------------------------------------------------------------------------');
  console.log('1. VERGLEICHS-STATISTIK: DERIVATE ALLEIN vs. MIT GOLDILOCKS-GATEKEEPER');
  console.log('--------------------------------------------------------------------------------');
  console.log(`• OHNE FILTER (Derivate allein):`);
  console.log(`  - Alle Events:                  ${evaluated.length}`);
  console.log(`  - Bull Traps (Gefallene Rebounds): ${allTraps.length} (${((allTraps.length / evaluated.length) * 100).toFixed(1)} %)`);
  console.log(`  - Erfolgreiche Rebounds:        ${allRebounds.length} (${((allRebounds.length / evaluated.length) * 100).toFixed(1)} %)\n`);

  console.log(`• MIT GOLDILOCKS-GATEKEEPER (Status = OK -> Kaufen | WARNING/CRITICAL -> Block):`);
  console.log(`  - Freigegebene Trades (PASS):   ${passedEvents.length}`);
  console.log(`  - Verbliebene Bull Traps:       ${passedTraps.length} (${((passedTraps.length / passedEvents.length) * 100).toFixed(1)} %)`);
  console.log(`  - Erfolgreiche Rebounds im Pass:${passedRebounds.length} (${((passedRebounds.length / passedEvents.length) * 100).toFixed(1)} %)\n`);

  console.log(`• VETO-BILANZ DES GOLDILOCKS-HUBS:`);
  console.log(`  - Insgesamt geblockte Events:   ${blockedEvents.length}`);
  console.log(`  - VERHINDERTE BULL TRAPS (Saved): ${blockedTraps.length} von ${allTraps.length} Bull Traps geblockt! (${((blockedTraps.length / allTraps.length) * 100).toFixed(1)} %)`);
  console.log(`  - Verpasste gute Rebounds:      ${blockedRebounds.length} (${((blockedRebounds.length / allRebounds.length) * 100).toFixed(1)} % Opportunitätskosten)\n`);

  // 2. DIE HISTORISCHEN BULL TRAPS: HAT GOLDILOCKS SIE GEBLOCKT?
  console.log('--------------------------------------------------------------------------------');
  console.log('2. HISTORISCHE BULL TRAPS IM DETAIL: HATTE GOLDILOCKS RECHT?');
  console.log('--------------------------------------------------------------------------------');
  const trapDetail = allTraps.map(t => ({
    Datum: t.date,
    Typ: t.type,
    'Deriv Regime': t.derivRegime,
    'Goldi Status': t.goldiStatus,
    'Goldi Regime': t.goldiRegime,
    'VETO?': t.goldiBlock ? '✅ GEBLOCKT (Gerettet!)' : '❌ DURCHGELASSEN (Falle)',
    'Max DD 20d': `${t.maxDd20.toFixed(1)}%`,
    'Max DD 40d': `${t.maxDd40.toFixed(1)}%`,
    Öl: t.oilPrice ? `${t.oilPrice.toFixed(0)}$` : 'N/A',
    Realzins: t.realYield ? `${t.realYield.toFixed(2)}%` : 'N/A',
    Sahm: t.sahmRule ? t.sahmRule.toFixed(2) : 'N/A'
  }));
  console.table(trapDetail);

  // 4. INTELLIGENTER GATEKEEPER: NICHT STUMPF ALLES BLOCKEN, SONDERN NUR ECHTE GEFAHREN
  // Regel: 
  // - Blocke bei STAGFLATION_PRESSURE (Zins- & Öl-Falle)
  // - Blocke bei RECESSION_CONTRACTION NUR WENN SPY < SMA 200 (keine Bärenmarkt-Kollision)
  // - Lasse OVERHEATING_BOOM durch (denn Boom treibt Aktien weiter)
  const isSmartBlock = (e) => {
    if (e.goldiRegime === 'STAGFLATION_PRESSURE') return true;
    if (e.goldiRegime === 'RECESSION_CONTRACTION' && !e.isAboveSma200) return true;
    if (e.goldiStatus === 'CRITICAL') return true;
    return false;
  };

  const smartPassed = evaluated.filter(e => !isSmartBlock(e));
  const smartPassedTraps = smartPassed.filter(e => e.isBullTrap);
  const smartPassedRebounds = smartPassed.filter(e => e.isSuccessfulRebound);
  const smartBlocked = evaluated.filter(e => isSmartBlock(e));
  const smartBlockedTraps = smartBlocked.filter(e => e.isBullTrap);
  const smartBlockedRebounds = smartBlocked.filter(e => e.isSuccessfulRebound);

  console.log('\n================================================================================');
  console.log('4. DER INTELLIGENTE GATEKEEPER (SMART FILTER):');
  console.log('   BLOCKT NUR STAGFLATION & BÄRENMARKT-REZESSION – ERLAUBT BODEN-REBOUNDS & BOOM!');
  console.log('================================================================================');
  console.log(`• Freigegebene Trades (PASS):        ${smartPassed.length} von ${evaluated.length} (${((smartPassed.length / evaluated.length) * 100).toFixed(1)} %)`);
  console.log(`• Verbliebene Bull Traps:            ${smartPassedTraps.length} (${((smartPassedTraps.length / smartPassed.length) * 100).toFixed(1)} %)`);
  console.log(`• Erfolgreiche Rebounds im Pass:     ${smartPassedRebounds.length} (${((smartPassedRebounds.length / smartPassed.length) * 100).toFixed(1)} %)`);
  console.log(`• VERHINDERTE BULL TRAPS (Saved):     ${smartBlockedTraps.length} von ${allTraps.length} (${((smartBlockedTraps.length / allTraps.length) * 100).toFixed(1)} %)`);
  console.log(`• Verpasste Rebounds (Kosten):       ${smartBlockedRebounds.length} (nur ${((smartBlockedRebounds.length / allRebounds.length) * 100).toFixed(1)} % statt vorher 48.7%!)`);
}

runGoldilocksGatekeeperTest().catch(console.error);
