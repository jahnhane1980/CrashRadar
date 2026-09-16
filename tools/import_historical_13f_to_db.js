/**
 * @tools/import_historical_13f_to_db.js
 * @purpose: Import historical 13F holdings from data/cache/sec_13f and data/cache/strategies/ark_filings into fund_13f_holdings
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

const SEC_13F_DIR = path.join(ROOT_DIR, 'data/cache/sec_13f');
const ARK_FILINGS_DIR = path.join(ROOT_DIR, 'data/cache/strategies/ark_filings');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('================================================================');
  console.log(`  13F CACHE -> DB IMPORTER ${isDryRun ? '[DRY-RUN]' : '[LIVE]'}`);
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  const pool = mysql.createPool({ uri: dbUrl, dateStrings: true });

  const audit = {
    sec_13f: {
      filesProcessed: 0,
      totalRecordsInCache: 0,
      aggregatedRecords: 0
    },
    ark_filings: {
      filesProcessed: 0,
      totalRecordsInCache: 0,
      aggregatedRecords: 0
    },
    skippedNon13F: {
      files: 0,
      records: 0,
      reasons: []
    },
    unmappedFields: new Set(),
    insertedCount: 0,
    dbBeforeCount: 0,
    dbAfterCount: 0
  };

  // 1. Initial DB Count
  const [initialRows] = await pool.query('SELECT COUNT(*) as cnt FROM fund_13f_holdings');
  audit.dbBeforeCount = initialRows[0].cnt;
  console.log(`📊 Aktueller Stand in DB (fund_13f_holdings): ${audit.dbBeforeCount} Zeilen\n`);

  // Map to collect and aggregate by PK: cik_reportDate_cusip_putCall
  const aggregatedMap = new Map();

  function addHolding(record, sourceFile) {
    const { cik, report_date, filing_date, cusip, put_call, issuer_name, shares, value } = record;

    if (!cusip) {
      audit.skippedNon13F.records++;
      return;
    }

    const cleanCik = cik.toString().padStart(10, '0');
    const cleanPutCall = (put_call || 'STOCK').toUpperCase();
    const cleanReportDate = typeof report_date === 'string' ? report_date.substring(0, 10) : report_date;
    const cleanFilingDate = typeof filing_date === 'string' ? filing_date.substring(0, 10) : (filing_date || cleanReportDate);

    const pk = `${cleanCik}|${cleanReportDate}|${cusip}|${cleanPutCall}`;

    if (aggregatedMap.has(pk)) {
      const existing = aggregatedMap.get(pk);
      existing.shares += (parseInt(shares, 10) || 0);
      existing.value += (parseInt(value, 10) || 0);
      if (!existing.issuer_name && issuer_name) {
        existing.issuer_name = issuer_name;
      }
    } else {
      aggregatedMap.set(pk, {
        cik: cleanCik,
        report_date: cleanReportDate,
        filing_date: cleanFilingDate,
        cusip: cusip.trim(),
        put_call: cleanPutCall,
        issuer_name: issuer_name ? issuer_name.trim() : null,
        shares: parseInt(shares, 10) || 0,
        value: parseInt(value, 10) || 0,
        sourceFile
      });
    }
  }

  // 2. Load from data/cache/sec_13f
  console.log('[1/3] Lese Cache-Dateien aus data/cache/sec_13f...');
  if (fs.existsSync(SEC_13F_DIR)) {
    const ciks = fs.readdirSync(SEC_13F_DIR);
    for (const cik of ciks) {
      const cPath = path.join(SEC_13F_DIR, cik);
      if (!fs.statSync(cPath).isDirectory()) continue;

      const files = fs.readdirSync(cPath).filter(f => f.endsWith('.json'));
      audit.sec_13f.filesProcessed += files.length;

      for (const f of files) {
        const filePath = path.join(cPath, f);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(data)) continue;

        for (const row of data) {
          audit.sec_13f.totalRecordsInCache++;
          addHolding(row, `sec_13f/${cik}/${f}`);
        }
      }
    }
  }
  audit.sec_13f.aggregatedRecords = aggregatedMap.size;
  console.log(`      ✓ ${audit.sec_13f.filesProcessed} Dateien, ${audit.sec_13f.totalRecordsInCache} Rohzeilen -> ${audit.sec_13f.aggregatedRecords} aggregierte Positionen`);

  // 3. Load from data/cache/strategies/ark_filings
  console.log('\n[2/3] Lese Cache-Dateien aus data/cache/strategies/ark_filings...');
  const arkBeforeCount = aggregatedMap.size;
  if (fs.existsSync(ARK_FILINGS_DIR)) {
    const files = fs.readdirSync(ARK_FILINGS_DIR).filter(f => f.endsWith('.json'));

    for (const f of files) {
      const filePath = path.join(ARK_FILINGS_DIR, f);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (f.startsWith('trust_')) {
        audit.skippedNon13F.files++;
        const count = (content.holdings || []).length;
        audit.skippedNon13F.records += count;
        audit.skippedNon13F.reasons.push({
          file: f,
          recordCount: count,
          reason: 'N-Q / N-PORT ETF Trust Filing (keine CUSIP-Spalte vorhanden, kein Form 13F-HR)'
        });
        continue;
      }

      audit.ark_filings.filesProcessed++;
      const holdings = content.holdings || [];

      // Track unmapped properties
      Object.keys(content).forEach(k => {
        if (!['cik', 'reportDate', 'filingDate', 'holdings'].includes(k)) {
          audit.unmappedFields.add(`filing_level.${k}`);
        }
      });

      for (const h of holdings) {
        audit.ark_filings.totalRecordsInCache++;

        Object.keys(h).forEach(k => {
          if (!['name', 'cusip', 'shares', 'value_usd', 'value_k', 'putCall'].includes(k)) {
            audit.unmappedFields.add(`holding_level.${k}`);
          }
        });

        // Value: In 13F filings, value in USD
        const val = h.value_usd !== undefined ? h.value_usd : (h.value_k ? h.value_k * 1000 : 0);

        addHolding({
          cik: content.cik || '0001697748',
          report_date: content.reportDate,
          filing_date: content.filingDate,
          cusip: h.cusip,
          put_call: h.putCall || 'STOCK',
          issuer_name: h.name,
          shares: h.shares,
          value: val
        }, `ark_filings/${f}`);
      }
    }
  }
  audit.ark_filings.aggregatedRecords = aggregatedMap.size - arkBeforeCount;
  console.log(`      ✓ ${audit.ark_filings.filesProcessed} 13F-Dateien, ${audit.ark_filings.totalRecordsInCache} Rohzeilen -> ${audit.ark_filings.aggregatedRecords} aggregierte Positionen`);
  console.log(`      ⚠️ ${audit.skippedNon13F.files} Trust-Dateien (${audit.skippedNon13F.records} Positionen) übersprungen (keine CUSIPs / N-Q Trust)`);

  const allRecords = Array.from(aggregatedMap.values());
  console.log(`\nGesamt zu übertragende aggregierte Positionen: ${allRecords.length}`);

  // 4. Insert / Upsert into DB in batches
  if (!isDryRun) {
    console.log('\n[3/3] Führe Batch-Insert in MySQL (fund_13f_holdings) durch...');
    const BATCH_SIZE = 1000;
    const query = `
      INSERT INTO fund_13f_holdings (cik, report_date, filing_date, cusip, put_call, issuer_name, shares, value)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        filing_date = VALUES(filing_date),
        issuer_name = VALUES(issuer_name),
        shares = VALUES(shares),
        value = VALUES(value)
    `;

    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      const values = batch.map(r => [
        r.cik,
        r.report_date,
        r.filing_date,
        r.cusip,
        r.put_call,
        r.issuer_name,
        r.shares,
        r.value
      ]);

      await pool.query(query, [values]);
      audit.insertedCount += batch.length;
      process.stdout.write(`      Eingespielt: ${audit.insertedCount} / ${allRecords.length}\r`);
    }
    console.log(`\n      ✓ ${audit.insertedCount} Positionen erfolgreich via Batch-Upsert übertragen.`);

    const [finalRows] = await pool.query('SELECT COUNT(*) as cnt FROM fund_13f_holdings');
    audit.dbAfterCount = finalRows[0].cnt;
    console.log(`📊 Neuer Stand in DB (fund_13f_holdings): ${audit.dbAfterCount} Zeilen (+${audit.dbAfterCount - audit.dbBeforeCount} neue Zeilen)\n`);
  } else {
    console.log('\n[3/3] DRY-RUN aktiv: Keine Datenbankänderungen vorgenommen.');
  }

  // Save audit log to sandbox
  fs.writeFileSync('sandbox/13f_import_audit.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    isDryRun,
    audit: {
      ...audit,
      unmappedFields: Array.from(audit.unmappedFields)
    }
  }, null, 2), 'utf8');

  console.log('✓ Audit-Log gespeichert in sandbox/13f_import_audit.json');

  await pool.end();
}

main().catch(err => {
  console.error('Fehler beim Import:', err);
  process.exit(1);
});
