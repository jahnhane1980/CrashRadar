/**
 * @tools/import_ark_trust_holdings_to_db.js
 * @purpose: Create fund_trust_holdings table and import 2014-2017 ARK ETF Trust holdings (N-Q/N-CSR)
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

const ARK_FILINGS_DIR = path.join(ROOT_DIR, 'data/cache/strategies/ark_filings');

async function main() {
  console.log('================================================================');
  console.log('  ARK TRUST HOLDINGS (N-Q / N-CSR) -> DB IMPORTER');
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  const pool = mysql.createPool({ uri: dbUrl, dateStrings: true });

  // 1. Create table fund_trust_holdings
  console.log('[1/3] Erstelle Tabelle fund_trust_holdings falls nicht vorhanden...');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS \`fund_trust_holdings\` (
      \`cik\` varchar(20) NOT NULL,
      \`report_date\` date NOT NULL,
      \`filing_date\` date NOT NULL,
      \`source\` varchar(20) NOT NULL DEFAULT 'N-Q',
      \`accession_number\` varchar(30) DEFAULT NULL,
      \`issuer_name\` varchar(255) NOT NULL,
      \`shares\` bigint NOT NULL,
      \`value_usd\` bigint NOT NULL,
      PRIMARY KEY (\`cik\`, \`report_date\`, \`issuer_name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
  `;
  await pool.query(createTableQuery);
  console.log('      ✓ Tabelle fund_trust_holdings existiert / wurde erstellt.');

  // 2. Read trust_*.json files
  console.log('\n[2/3] Lese trust_*.json Dateien aus data/cache/strategies/ark_filings...');
  const files = fs.readdirSync(ARK_FILINGS_DIR)
    .filter(f => f.startsWith('trust_') && f.endsWith('.json'))
    .sort();

  console.log(`      ✓ Gefunden: ${files.length} Trust-Dateien`);

  const allRecords = [];
  for (const f of files) {
    const filePath = path.join(ARK_FILINGS_DIR, f);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const cik = (content.cik || '1579982').toString().padStart(10, '0');
    const reportDate = content.reportDate;
    const filingDate = content.filingDate || reportDate;
    const source = content.source || 'N-Q';
    const accessionNumber = content.accessionNumber || null;
    const holdings = content.holdings || [];

    for (const h of holdings) {
      allRecords.push([
        cik,
        reportDate,
        filingDate,
        source,
        accessionNumber,
        h.name.trim(),
        parseInt(h.shares, 10) || 0,
        parseInt(h.value_usd, 10) || 0
      ]);
    }
  }

  console.log(`      ✓ ${allRecords.length} Datensätze aus ${files.length} Dateien extrahiert.`);

  // 3. Batch-Insert
  console.log('\n[3/3] Führe Batch-Insert in fund_trust_holdings durch...');
  const insertQuery = `
    INSERT INTO \`fund_trust_holdings\` 
      (cik, report_date, filing_date, source, accession_number, issuer_name, shares, value_usd)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      filing_date = VALUES(filing_date),
      source = VALUES(source),
      accession_number = VALUES(accession_number),
      shares = VALUES(shares),
      value_usd = VALUES(value_usd);
  `;

  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE);
    await pool.query(insertQuery, [batch]);
    inserted += batch.length;
  }

  const [countRes] = await pool.query('SELECT COUNT(*) as cnt FROM fund_trust_holdings');
  console.log(`      ✓ ${inserted} Datensätze eingespielt.`);
  console.log(`📊 DB-Bestand (fund_trust_holdings): ${countRes[0].cnt} Zeilen über ${files.length} Quartale (2014–2017).\n`);

  await pool.end();
}

main().catch(err => {
  console.error('Fehler beim Trust-Import:', err);
  process.exit(1);
});
