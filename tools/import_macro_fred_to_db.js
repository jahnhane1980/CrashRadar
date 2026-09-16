/**
 * @tools/import_macro_fred_to_db.js
 * @purpose: Import all FRED macro series from data/cache/macro/fred_*.json into econ_fred table
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

const MACRO_DIR = path.join(ROOT_DIR, 'data/cache/macro');
const isDryRun = process.argv.includes('--dry-run');

// Mapping of filename to exact FRED series ID
const SERIES_MAP = {
  'fred_borrow.json': 'BORROW',
  'fred_les1252881600q.json': 'LES1252881600Q',
  'fred_mmmffaq027s.json': 'MMMFAAQ027S',
  'fred_mtso133fms.json': 'MTSO133FMS',
  'fred_psavert.json': 'PSAVERT',
  'fred_rrpontsyd.json': 'RRPONTSYD',
  'fred_sp500.json': 'SP500',
  'fred_totresns.json': 'TOTRESNS',
  'fred_usnum.json': 'USNUM',
  'fred_walcl.json': 'WALCL',
  'fred_wlcfll.json': 'WLCFLL',
  'fred_wresbal.json': 'WRESBAL'
};

async function main() {
  console.log('================================================================');
  console.log(`  STAGE D.1: FRED MACRO CACHE -> DB IMPORTER ${isDryRun ? '[DRY-RUN]' : '[LIVE]'}`);
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  const pool = mysql.createPool({ uri: dbUrl, dateStrings: true });

  const [initialRows] = await pool.query('SELECT COUNT(*) as cnt FROM econ_fred');
  const dbBeforeCount = initialRows[0].cnt;
  console.log(`📊 Aktueller Stand in DB (econ_fred): ${dbBeforeCount} Zeilen\n`);

  const files = fs.readdirSync(MACRO_DIR).filter(f => f.startsWith('fred_') && f.endsWith('.json')).sort();
  console.log(`Gefunden: ${files.length} FRED-Dateien in ${MACRO_DIR}...`);

  const allRecords = [];
  const seriesStats = {};

  for (const f of files) {
    const seriesId = SERIES_MAP[f] || f.replace('fred_', '').replace('.json', '').toUpperCase();
    const filePath = path.join(MACRO_DIR, f);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const obs = data.observations || [];

    let validCount = 0;
    for (const o of obs) {
      if (!o.date || o.value === '.' || o.value === null || o.value === undefined) continue;
      const numVal = parseFloat(o.value);
      if (isNaN(numVal)) continue;

      allRecords.push([seriesId, o.date, numVal]);
      validCount++;
    }

    seriesStats[seriesId] = { totalObs: obs.length, validObs: validCount, file: f };
    console.log(`  • [${seriesId.padEnd(16)}] ${validCount} Beobachtungen aus ${f}`);
  }

  console.log(`\nGesamt zu übertragende FRED-Beobachtungen: ${allRecords.length}`);

  if (!isDryRun) {
    console.log('\nFühre Batch-Upsert in econ_fred durch...');
    const BATCH_SIZE = 2000;
    const query = `
      INSERT INTO econ_fred (series_id, observation_date, value)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        value = VALUES(value);
    `;

    let inserted = 0;
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      await pool.query(query, [batch]);
      inserted += batch.length;
      process.stdout.write(`      Eingespielt: ${inserted} / ${allRecords.length}\r`);
    }

    const [finalRows] = await pool.query('SELECT COUNT(*) as cnt FROM econ_fred');
    const dbAfterCount = finalRows[0].cnt;
    console.log(`\n      ✓ ${inserted} Beobachtungen via Upsert übertragen.`);
    console.log(`📊 Neuer DB-Stand (econ_fred): ${dbAfterCount} Zeilen (+${dbAfterCount - dbBeforeCount} neue Zeilen)!\n`);
  } else {
    console.log('\nDRY-RUN aktiv: Keine Datenbankänderungen vorgenommen.');
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fehler beim FRED-Import:', err);
  process.exit(1);
});
