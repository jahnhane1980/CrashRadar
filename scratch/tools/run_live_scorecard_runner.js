import dotenv from 'dotenv';
import { MacroScorecardRunner } from '../../src/runners/MacroScorecardRunner.js';
import mysql from 'mysql2/promise';

dotenv.config();

async function runLiveScorecard() {
  const runner = new MacroScorecardRunner();
  await runner.run();

  const pool = mysql.createPool({ uri: process.env.DATABASE_URL, dateStrings: true });
  const [rows] = await pool.query("SELECT id, title, event_date, status, actual_value, details_json FROM macro_calendar_events WHERE event_date <= '2026-09-14' AND category = 'MACRO_RELEASE' ORDER BY event_date ASC");
  console.log('\n--- Updated DB rows after MacroScorecardRunner ---');
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}

runLiveScorecard().catch(console.error);
