import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Storage } from '../src/core/Storage.js';
import { RequestManager } from '../src/core/RequestManager.js';
import { ErrorRegistry } from '../src/core/ErrorRegistry.js';
import { TimeSeriesFetcher } from '../src/services/TimeSeriesFetcher.js';
import { FiscalCalendarService } from '../src/services/FiscalCalendarService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCalendarFetch() {
  const configPath = path.resolve(__dirname, '../config/Database-Fetcher-Config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const storage = new Storage({ databaseUrl: process.env.DATABASE_URL });
  const requestManager = new RequestManager(config);
  const errorRegistry = new ErrorRegistry();

  const fetcher = new TimeSeriesFetcher(config, storage, requestManager, errorRegistry);

  console.log('--- Triggering task macro_calendar_events ---');
  await fetcher.runTasksByIds(['macro_calendar_events']);

  console.log('--- Verifying macro_calendar_events from DB ---');
  const [rows] = await storage.pool.query('SELECT id, category, subcategory, title, event_date, status, criticality FROM macro_calendar_events ORDER BY event_date ASC');
  console.log(`Found ${rows.length} records in macro_calendar_events:`);
  for (const r of rows) {
    const dStr = r.event_date instanceof Date ? r.event_date.toISOString().split('T')[0] : r.event_date;
    console.log(`• [${r.category}/${r.subcategory}] ${dStr} - ${r.title} (Status: ${r.status}, Criticality: ${r.criticality})`);
  }

  console.log('\n--- Verifying FiscalCalendarService.loadFromDb() ---');
  const service = new FiscalCalendarService(null, { pool: storage.pool });
  await service.loadFromDb();
  const status = service.getFiscalStatus('2026-09-14');
  console.log('Fiscal Status as of 2026-09-14:', status);

  const upcoming = await service.getUpcomingEvents('2026-09-14', { limit: 5 });
  console.log('\nUpcoming Events from DB:');
  for (const u of upcoming) {
    console.log(`- ${u.date}: ${u.title} [${u.category}] (Status: ${u.status})`);
  }

  await storage.close();
}

runCalendarFetch().catch(err => {
  console.error('Execution failed:', err);
  process.exit(1);
});
