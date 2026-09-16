/**
 * @tools/import_full_ohlcv_to_db.js
 * @purpose: Import 39 100% complete OHLCV price histories from data/cache/strategies/prices into market_data_yahoo
 * @created: 2026-09-16
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const STRAT_PRICES_DIR = path.join(ROOT_DIR, 'data/cache/strategies/prices');
const isDryRun = process.argv.includes('--dry-run');

// Symbol normalization dictionary
const SYMBOL_MAP = {
  'VIX': '^VIX',
  'EURUSD_X': 'EURUSD=X',
  'BTC_USD': 'BTC-USD'
};

async function main() {
  console.log('================================================================');
  console.log(`  STAGE C.1: 100% OHLCV CACHE -> DB IMPORTER ${isDryRun ? '[DRY-RUN]' : '[LIVE]'}`);
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  const pool = mysql.createPool({ uri: dbUrl, dateStrings: true });

  // 1. Initial count
  const [initialRows] = await pool.query('SELECT COUNT(*) as cnt FROM market_data_yahoo');
  const dbBeforeCount = initialRows[0].cnt;
  console.log(`📊 Aktueller Stand in DB (market_data_yahoo): ${dbBeforeCount} Zeilen\n`);

  // 2. Read all files
  const files = fs.readdirSync(STRAT_PRICES_DIR).filter(f => f.endsWith('.json')).sort();
  console.log(`Lese ${files.length} Dateien aus data/cache/strategies/prices...`);

  const allRecords = [];
  const symbolStats = {};

  for (const f of files) {
    const rawSym = f.split('_')[0];
    const sym = SYMBOL_MAP[rawSym] || rawSym.toUpperCase();
    const filePath = path.join(STRAT_PRICES_DIR, f);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!Array.isArray(data)) continue;

    symbolStats[sym] = { count: data.length, first: data[0]?.date, last: data[data.length - 1]?.date };

    for (const row of data) {
      if (!row.date || row.close === null || row.close === undefined) continue;

      allRecords.push([
        sym,
        row.date.substring(0, 10),
        row.open !== null && row.open !== undefined ? parseFloat(row.open) : null,
        row.high !== null && row.high !== undefined ? parseFloat(row.high) : null,
        row.low !== null && row.low !== undefined ? parseFloat(row.low) : null,
        parseFloat(row.close),
        row.volume !== null && row.volume !== undefined ? parseFloat(row.volume) : 0
      ]);
    }
  }

  console.log(`      ✓ ${allRecords.length} vollständige Tageskerzen für ${Object.keys(symbolStats).length} Symbole extrahiert.`);

  // 3. Batch Insert
  if (!isDryRun) {
    console.log('\nFühre Batch-Upsert in market_data_yahoo durch...');
    const BATCH_SIZE = 2000;
    const query = `
      INSERT INTO market_data_yahoo 
        (symbol, record_date, open, high, low, close, volume)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        open = VALUES(open),
        high = VALUES(high),
        low = VALUES(low),
        close = VALUES(close),
        volume = VALUES(volume);
    `;

    let inserted = 0;
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      await pool.query(query, [batch]);
      inserted += batch.length;
      process.stdout.write(`      Eingespielt: ${inserted} / ${allRecords.length}\r`);
    }

    const [finalRows] = await pool.query('SELECT COUNT(*) as cnt FROM market_data_yahoo');
    const dbAfterCount = finalRows[0].cnt;
    console.log(`\n      ✓ ${inserted} Tageskerzen via Upsert übertragen.`);
    console.log(`📊 Neuer DB-Stand (market_data_yahoo): ${dbAfterCount} Zeilen (+${dbAfterCount - dbBeforeCount} neue Zeilen)!\n`);
  } else {
    console.log('\nDRY-RUN aktiv: Keine Datenbankänderungen vorgenommen.');
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fehler beim Kursdaten-Import:', err);
  process.exit(1);
});
