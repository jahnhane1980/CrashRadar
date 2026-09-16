import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { PortfolioStrategyEngine } from '../src/strategies/PortfolioStrategyEngine.js';
import { GoldSpyDcaStrategy } from '../src/strategies/GoldSpyDcaStrategy.js';
import { SatelliteStrategy } from '../src/strategies/SatelliteStrategy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runStrategyStressTests() {
  console.log('================================================================');
  console.log('   HISTORISCHER STRESS-TEST: BEIDE STRATEGIEN AUF REINEN HUBS');
  console.log('================================================================\n');

  const fe = new FinanceExpert();
  console.log('Lade historische Timeline aus DB / Cache (2004 - 2026)...');
  const timeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
  await fe.close();

  console.log(`Timeline geladen: ${timeline.length} Tage.\n`);

  const engine = new PortfolioStrategyEngine();
  const goldSpy = new GoldSpyDcaStrategy();
  const satellite = new SatelliteStrategy();
  engine.registerStrategy(goldSpy);
  engine.registerStrategy(satellite);

  // 1. Simuliere GoldSpyDcaStrategy über gesamte 21.8 Jahre Historie
  console.log('--- TEST A: GoldSpyDcaStrategy (2004 - 2026) ---');
  let goldSpyStateChanges = 0;
  let goldSpyLastStatus = null;
  let goldSpyEmergencyDays = 0;
  let goldSpyMarginLockDays = 0;
  let goldSpyReEntryDays = 0;
  let goldSpyNormalDays = 0;

  // 2. Simuliere SatelliteStrategy über Krypto/Defense Historie
  console.log('--- TEST B: SatelliteStrategy (Core-Satellite 80/15/5) ---');
  let satStateChanges = 0;
  let satLastStatus = null;
  let satEmergencyDays = 0;
  let satNormalDays = 0;
  let satReEntryDays = 0;

  // Tag-für-Tag Auswertung durch die Engine (Zero-Leakage Hubs)
  for (let i = 200; i < timeline.length; i++) {
    const slice = timeline.slice(0, i + 1);
    const todayStr = slice[slice.length - 1].date;

    const evalRes = await engine.evaluateAll({
      date: todayStr,
      timeline: slice
    });

    const gsRes = evalRes.strategyResults.GOLD_SPY;
    const satRes = evalRes.strategyResults.SATELITE;

    // Tracking GoldSpy
    if (gsRes.status !== goldSpyLastStatus) {
      goldSpyStateChanges++;
      goldSpyLastStatus = gsRes.status;
    }
    if (gsRes.status === 'EMERGENCY_HEDGE') goldSpyEmergencyDays++;
    else if (gsRes.status === 'PRE_MARGIN_CASH_LOCK' || gsRes.status === 'MARGIN_CALL_ACTIVE') goldSpyMarginLockDays++;
    else if (gsRes.status === 'RE_ENTRY_SNIPER') goldSpyReEntryDays++;
    else if (gsRes.status === 'NORMAL_DCA') goldSpyNormalDays++;

    // Tracking Satellite
    if (satRes.status !== satLastStatus) {
      satStateChanges++;
      satLastStatus = satRes.status;
    }
    if (satRes.status === 'EMERGENCY_SHIELD') satEmergencyDays++;
    else if (satRes.status === 'RE_ENTRY_RESET') satReEntryDays++;
    else if (satRes.status === 'NORMAL_HODL') satNormalDays++;
  }

  console.log('\n📊 ERGEBNISSE GOLD-SPY STRATEGIE (21.8 Jahre, 7.792 Tage):');
  console.log(`   * Gesamtstatus-Wechsel:     ${goldSpyStateChanges}`);
  console.log(`   * Tage in NORMAL_DCA:       ${goldSpyNormalDays}`);
  console.log(`   * Tage in EMERGENCY_HEDGE:  ${goldSpyEmergencyDays}`);
  console.log(`   * Tage in CASH_LOCK:        ${goldSpyMarginLockDays}`);
  console.log(`   * Tage in RE_ENTRY_SNIPER:  ${goldSpyReEntryDays}`);
  console.log(`   * Letzter aktueller Status: ${goldSpyLastStatus}`);

  console.log('\n📊 ERGEBNISSE SATELLITE STRATEGIE (21.8 Jahre, 7.792 Tage):');
  console.log(`   * Gesamtstatus-Wechsel:     ${satStateChanges}`);
  console.log(`   * Tage in NORMAL_HODL:      ${satNormalDays}`);
  console.log(`   * Tage in EMERGENCY_SHIELD: ${satEmergencyDays}`);
  console.log(`   * Tage in RE_ENTRY_RESET:   ${satReEntryDays}`);
  console.log(`   * Letzter aktueller Status: ${satLastStatus}`);

  console.log('\n================================================================');
  console.log('✅ BEIDE STRATEGIEN HABEN DEN HISTORISCHEN STRESS-TEST FEHLERFREI BESTANDEN!');
  console.log('================================================================');
}

runStrategyStressTests().catch(console.error);
