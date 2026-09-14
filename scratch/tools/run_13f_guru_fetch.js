import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Storage } from '../../src/core/Storage.js';
import { RequestManager } from '../../src/core/RequestManager.js';
import { TimeSeriesFetcher } from '../../src/services/TimeSeriesFetcher.js';
import { ErrorRegistry } from '../../src/core/ErrorRegistry.js';
import { Logger } from '../../src/core/Logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run13FFetch() {
  console.log("================================================================================");
  console.log("   CRASHRADAR: 13F GURU FETCHER PIPELINE – LIVE TEST");
  console.log("================================================================================\n");

  const configPath = path.resolve(__dirname, '../../config/Database-Fetcher-Config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const storage = new Storage({ databaseUrl: process.env.DATABASE_URL });
  const requestManager = new RequestManager(config);
  const errorRegistry = new ErrorRegistry();

  const fetcher = new TimeSeriesFetcher(config, storage, requestManager, errorRegistry);

  try {
    console.log("--- 1. Starte Task 'sec_13f_holdings' (Erster Import) ---");
    console.time("Erster-Lauf-Dauer");
    await fetcher.runTasksByIds(['sec_13f_holdings']);
    console.timeEnd("Erster-Lauf-Dauer");

    // Prüfe Zeilen in der DB
    const [rows] = await storage.pool.query(`
      SELECT cik, COUNT(*) as holdings_count, MAX(report_date) as latest_report, MAX(filing_date) as latest_filing
      FROM fund_13f_holdings
      GROUP BY cik
    `);
    console.log("\nAktueller Datenbank-Bestand in fund_13f_holdings:");
    console.table(rows);

    const [totalRows] = await storage.pool.query(`SELECT COUNT(*) as total FROM fund_13f_holdings`);
    console.log(`Gesamtanzahl Positionen in DB: ${totalRows[0].total}`);

    console.log("\n--- 2. Zweiter Test-Lauf (Fail-Safe DB-Guard Prüfung) ---");
    console.time("Zweiter-Lauf-Dauer");
    await fetcher.runTasksByIds(['sec_13f_holdings']);
    console.timeEnd("Zweiter-Lauf-Dauer");
    console.log("-> Wenn der Guard funktioniert, wurden 0 neue Downloads getätigt und alles übersprungen.");

  } catch (err) {
    console.error("Fehler im Fetcher:", err);
  } finally {
    await storage.close();
  }
}

run13FFetch().catch(console.error);
