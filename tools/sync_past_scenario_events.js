import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { ScenarioChecklistService } from '../src/services/ScenarioChecklistService.js';

dotenv.config();

async function syncPastEvents() {
  console.log('--- Syncing past September 2026 events into macro_calendar_events ---');
  const expert = new FinanceExpert();
  const timeline = await expert.getDailyGroupedData('2015-01-01');
  const service = new ScenarioChecklistService();

  const evalResult = service.evaluate('2026-09-14', timeline, { forceNotify: true });
  console.log(`Evaluated ${evalResult.evaluation.evaluatedEvents.length} events:`);

  const pool = mysql.createPool({ uri: process.env.DATABASE_URL, dateStrings: true });

  for (const ev of evalResult.evaluation.evaluatedEvents) {
    const status = ev.isPending ? 'PENDING_DATA' : (ev.passed ? 'PASSED' : 'FAILED');
    const actualVal = ev.value !== undefined && ev.value !== null ? String(ev.value) : null;
    const detailsJson = ev.details ? JSON.stringify(ev.details) : JSON.stringify({ reason: ev.reason });

    console.log(`- Updating [${ev.date}] ${ev.id}: status=${status}, val=${actualVal}`);

    await pool.query(
      `UPDATE macro_calendar_events 
       SET status = ?, actual_value = ?, details_json = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? OR (event_date = ? AND category = 'MACRO_RELEASE')`,
      [status, actualVal, detailsJson, ev.id, ev.date]
    );
  }

  const [rows] = await pool.query(
    "SELECT id, title, event_date, status, actual_value FROM macro_calendar_events WHERE event_date BETWEEN '2026-09-01' AND '2026-09-15' ORDER BY event_date ASC"
  );
  console.log('\nVerified state in MySQL:');
  for (const r of rows) {
    console.log(`• ${r.event_date} | ${r.id} | status=${r.status} | actual_value=${r.actual_value}`);
  }

  await pool.end();
  await expert.close();
}

syncPastEvents().catch(console.error);
