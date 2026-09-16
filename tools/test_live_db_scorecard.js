import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { ScenarioChecklistService } from '../src/services/ScenarioChecklistService.js';
import { MacroScorecardRunner } from '../src/runners/MacroScorecardRunner.js';

dotenv.config();

async function runLiveTest() {
  console.log('================================================================');
  console.log('  LIVE-TEST: VOLLSTÄNDIG DB-GESTÜTZTE MAKRO-SCORECARD-ENGINE');
  console.log('================================================================\n');

  const pool = mysql.createPool({ uri: process.env.DATABASE_URL, dateStrings: true });

  // 1. Live-Test ScenarioChecklistService mit echten DB-Daten für September 2026
  console.log('[1/3] Teste ScenarioChecklistService.loadEventsFromDb für September 2026...');
  const serviceSept = new ScenarioChecklistService(null, { pool });
  const septEvents = await serviceSept.loadEventsFromDb(pool, '2026-09-14');
  console.log(`      ✓ ${septEvents.length} Events aus MySQL geladen für September:`);
  for (const ev of septEvents) {
    console.log(`      • [${ev.date}] ${ev.id}: ${ev.title} (${ev.time})`);
  }

  // 2. Live-Test für zukünftigen Monat (Oktober 2026)
  console.log('\n[2/3] Teste ScenarioChecklistService.loadEventsFromDb für Oktober 2026 (Zukunft)...');
  const serviceOct = new ScenarioChecklistService(null, { pool });
  const octEvents = await serviceOct.loadEventsFromDb(pool, '2026-10-02');
  console.log(`      ✓ ${octEvents.length} Events aus MySQL geladen für Oktober:`);
  for (const ev of octEvents) {
    console.log(`      • [${ev.date}] ${ev.id}: ${ev.title} (${ev.time})`);
  }

  // 3. Live-Evaluierung gegen echte Makro-Timeline
  console.log('\n[3/3] Führe Live-Scorecard-Evaluierung durch...');
  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('2015-01-01');
  const evalResult = serviceSept.evaluate('2026-09-14', timeline, { forceNotify: true });

  console.log('\n================== SCORECARD ERGEBNIS ==================');
  console.log(evalResult.message);
  console.log('========================================================');
  console.log(`Ergebnis: ${evalResult.evaluation.passedCount} / ${evalResult.evaluation.totalEvaluated} Kriterien bestanden.`);

  await expert.close();
  await pool.end();
  console.log('\n✓ Live-Test erfolgreich abgeschlossen!');
}

runLiveTest().catch(err => {
  console.error('Fehler beim Live-Test:', err);
  process.exit(1);
});
