/**
 * @tools/import_dalio_cycles_to_fred.js
 * @purpose: Import all 17 historical macro series from data/cache/dalio_cycles/*.json into econ_fred table
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

const DALIO_DIR = path.join(ROOT_DIR, 'data/cache/dalio_cycles');
const isDryRun = process.argv.includes('--dry-run');

// Mapping of filename to exact FRED series ID
const SERIES_MAP = {
  'bank_reserves_totresns.json': 'TOTRESNS',
  'commercial_loans.json': 'BUSLOANS',
  'credit_spread_baa10y.json': 'BAA10Y',
  'fed_funds_rate.json': 'FEDFUNDS',
  'gov_interest_payments.json': 'A091RC1Q027SBEA',
  'gov_net_interest_gdp.json': 'FYOIGDA188S',
  'gov_tax_receipts.json': 'W006RC1Q027SBEA',
  'household_credit_1945_2026.json': 'CMDEBT',
  'money_supply_m2.json': 'M2SL',
  'real_gdp.json': 'GDPC1',
  'recession_usrec.json': 'USREC',
  'sp500_daily_1970_2026.json': 'SP500',
  'tdsp_household_debt.json': 'TDSP',
  'us_public_debt_gdp.json': 'GFDEGDQ188S',
  'yield_curve_10y_3m.json': 'T10Y3M',
  'yield_curve_gs10.json': 'GS10',
  'yield_curve_tb3ms.json': 'TB3MS'
};

async function main() {
  console.log(`[Import] Starte Import aus ${DALIO_DIR}... ${isDryRun ? '(DRY RUN)' : ''}`);

  if (!fs.existsSync(DALIO_DIR)) {
    console.error(`[Error] Verzeichnis existiert nicht: ${DALIO_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(DALIO_DIR).filter(f => f.endsWith('.json'));
  console.log(`[Import] ${files.length} JSON-Dateien in dalio_cycles gefunden.`);

  const pool = isDryRun ? null : mysql.createPool(process.env.DATABASE_URL);

  let totalImported = 0;

  for (const file of files) {
    const seriesId = SERIES_MAP[file];
    if (!seriesId) {
      console.warn(`[Skip] Unbekannte Datei ohne Serien-Mapping: ${file}`);
      continue;
    }

    const filePath = path.join(DALIO_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const rows = [];
    for (const item of content) {
      const val = item.value ?? item.close;
      if (item.date && typeof val === 'number' && !isNaN(val)) {
        rows.push([seriesId, item.date, val]);
      }
    }

    if (rows.length === 0) {
      console.warn(`[Skip] ${file}: Keine gültigen Zeilen gefunden.`);
      continue;
    }

    const minDate = rows[0][1];
    const maxDate = rows[rows.length - 1][1];
    console.log(`[Series] ${seriesId.padEnd(16)} aus ${file.padEnd(32)} -> ${String(rows.length).padStart(6)} Zeilen (${minDate} bis ${maxDate})`);

    if (!isDryRun && pool) {
      const BATCH_SIZE = 2000;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const query = `
          INSERT INTO econ_fred (series_id, observation_date, value)
          VALUES ?
          ON DUPLICATE KEY UPDATE value = VALUES(value)
        `;
        await pool.query(query, [batch]);
      }
    }

    totalImported += rows.length;
  }

  if (pool) {
    await pool.end();
  }

  console.log('\n----------------------------------------');
  console.log(`[Fertig] Gesamt importierte / aktualisierte Zeilen: ${totalImported}`);
  console.log('----------------------------------------');
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
