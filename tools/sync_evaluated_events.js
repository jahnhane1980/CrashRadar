import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { ScenarioChecklistService } from '../src/services/ScenarioChecklistService.js';

dotenv.config();

async function syncEvaluatedEvents() {
  const pool = mysql.createPool({ uri: process.env.DATABASE_URL, dateStrings: true });
  const scenarioService = new ScenarioChecklistService(null, { pool });
  await scenarioService.loadEventsFromDb(pool, '2026-09-14');

  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('2015-01-01');

  const evalResult = scenarioService.evaluate('2026-09-14', timeline, { forceNotify: true });
  console.log('Evaluation result for 2026-09-14:');
  console.log(evalResult.message);

  if (evalResult.evaluation && Array.isArray(evalResult.evaluation.evaluatedEvents)) {
    for (const ev of evalResult.evaluation.evaluatedEvents) {
      const status = ev.isPending ? 'PENDING_DATA' : (ev.passed ? 'PASSED' : 'FAILED');
      const actualVal = ev.value !== undefined && ev.value !== null 
        ? String(ev.value) 
        : (ev.details && ev.details.length > 0 && ev.details[0].value !== undefined ? String(ev.details[0].value) : null);
      const detailsJson = ev.details ? JSON.stringify(ev.details) : JSON.stringify({ reason: ev.reason });

      await pool.query(
        `UPDATE macro_calendar_events 
         SET status = ?, actual_value = ?, details_json = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? OR (event_date = ? AND category = 'MACRO_RELEASE')`,
        [status, actualVal, detailsJson, ev.id, ev.date]
      );
    }
  }

  const [rows] = await pool.query("SELECT id, title, event_date, status, actual_value, details_json FROM macro_calendar_events WHERE event_date LIKE '2026-09%' ORDER BY event_date ASC");
  console.log('\n--- Final September 2026 macro_calendar_events in DB ---');
  for (const r of rows) {
    console.log(`• [${r.event_date}] ${r.id}: Status=${r.status} | Actual=${r.actual_value} | Title=${r.title}`);
  }

  await expert.close();
  await pool.end();
}

syncEvaluatedEvents().catch(console.error);
