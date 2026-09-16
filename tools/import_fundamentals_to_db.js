/**
 * @tools/import_fundamentals_to_db.js
 * @purpose: Extend company_fundamentals schema and import all fundamental cache datasets (strategies/fundamentals, fundamentals_master, turnaround master)
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

const STRAT_MASTER_PATH = path.join(ROOT_DIR, 'data/cache/strategies/fundamentals_master.json');
const STRAT_FUND_DIR = path.join(ROOT_DIR, 'data/cache/strategies/fundamentals');
const TURNAROUND_MASTER_PATH = path.join(ROOT_DIR, 'data/cache/turnarounds/parsed_fundamentals_master.json');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('================================================================');
  console.log(`  FUNDAMENTALS CACHE -> DB IMPORTER ${isDryRun ? '[DRY-RUN]' : '[LIVE]'}`);
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  const pool = mysql.createPool({ uri: dbUrl, dateStrings: true });

  const audit = {
    schemaUpdated: false,
    sources: {
      strategiesMaster: { files: 1, tickers: 0, rawRecords: 0 },
      strategiesSingleFiles: { files: 0, tickers: 0, rawRecords: 0 },
      turnaroundMaster: { files: 1, tickers: 0, rawRecords: 0 }
    },
    mergedPositions: 0,
    uniqueTickers: new Set(),
    dbBeforeCount: 0,
    dbAfterCount: 0
  };

  // 1. Initial count & Schema Check
  const [initialRows] = await pool.query('SELECT COUNT(*) as cnt FROM company_fundamentals');
  audit.dbBeforeCount = initialRows[0].cnt;
  console.log(`📊 Aktueller Stand in DB (company_fundamentals): ${audit.dbBeforeCount} Zeilen`);

  const [cols] = await pool.query('DESCRIBE company_fundamentals');
  const existingColNames = new Set(cols.map(c => c.Field));

  const columnsToAdd = [
    { name: 'filing_date', def: 'DATE NULL' },
    { name: 'yoy_revenue_growth_pct', def: 'DOUBLE NULL' },
    { name: 'gross_profit', def: 'BIGINT NULL' },
    { name: 'operating_cash_flow', def: 'BIGINT NULL' },
    { name: 'eps', def: 'DECIMAL(10,4) NULL' }
  ];

  const missingCols = columnsToAdd.filter(c => !existingColNames.has(c.name));
  if (missingCols.length > 0) {
    console.log(`\n[1/4] Erweitere Schema von company_fundamentals um ${missingCols.length} Spalten: ${missingCols.map(c => c.name).join(', ')}...`);
    if (!isDryRun) {
      for (const col of missingCols) {
        await pool.query(`ALTER TABLE company_fundamentals ADD COLUMN \`${col.name}\` ${col.def}`);
      }
      audit.schemaUpdated = true;
      console.log('      ✓ Schema erfolgreich aktualisiert.');
    } else {
      console.log('      [DRY-RUN] Schema-Änderung übersprungen.');
    }
  } else {
    console.log('      ✓ Alle benötigten Spalten in company_fundamentals bereits vorhanden.');
  }

  // Collection Map: key = `${symbol}|${date}|${period}`
  const mergedMap = new Map();

  function parsePeriod(period, fiscalPeriod, dateStr) {
    if (period && period !== 'Q' && period !== 'undefined') return period.toUpperCase();
    if (fiscalPeriod && fiscalPeriod.includes('-Q')) {
      const q = fiscalPeriod.split('-')[1];
      if (q && q.length >= 2) return q.toUpperCase();
    }
    // Fallback based on month
    if (dateStr) {
      const m = parseInt(dateStr.split('-')[1], 10);
      if (m <= 3) return 'Q1';
      if (m <= 6) return 'Q2';
      if (m <= 9) return 'Q3';
      return 'Q4';
    }
    return 'Q';
  }

  function mergeRecord(symbol, date, period, data) {
    if (!symbol || !date) return;
    const cleanSym = symbol.trim().toUpperCase();
    const cleanDate = date.substring(0, 10);
    const cleanPeriod = parsePeriod(period, data.fiscal_period, cleanDate);

    const pk = `${cleanSym}|${cleanDate}|${cleanPeriod}`;
    audit.uniqueTickers.add(cleanSym);

    if (mergedMap.has(pk)) {
      const existing = mergedMap.get(pk);
      // Merge non-null values
      if (data.filing_date && !existing.filing_date) existing.filing_date = data.filing_date.substring(0, 10);
      if (data.revenue !== undefined && data.revenue !== null) existing.totalRevenue = parseInt(data.revenue, 10);
      if (data.net_income !== undefined && data.net_income !== null) existing.netIncome = parseInt(data.net_income, 10);
      if (data.gross_profit !== undefined && data.gross_profit !== null) existing.gross_profit = parseInt(data.gross_profit, 10);
      if (data.operating_cash_flow !== undefined && data.operating_cash_flow !== null) existing.operating_cash_flow = parseInt(data.operating_cash_flow, 10);
      if (data.fcf !== undefined && data.fcf !== null) existing.freeCashFlow = parseInt(data.fcf, 10);
      if (data.diluted_shares !== undefined && data.diluted_shares !== null) existing.shareIssued = parseInt(data.diluted_shares, 10);
      if (data.eps !== undefined && data.eps !== null) existing.eps = parseFloat(data.eps);
      if (data.yoy_revenue_growth_pct !== undefined && data.yoy_revenue_growth_pct !== null) {
        existing.yoy_revenue_growth_pct = parseFloat(data.yoy_revenue_growth_pct);
      }
    } else {
      mergedMap.set(pk, {
        symbol: cleanSym,
        date: cleanDate,
        period: cleanPeriod,
        filing_date: data.filing_date ? data.filing_date.substring(0, 10) : null,
        totalRevenue: data.revenue !== undefined && data.revenue !== null ? parseInt(data.revenue, 10) : null,
        netIncome: data.net_income !== undefined && data.net_income !== null ? parseInt(data.net_income, 10) : null,
        gross_profit: data.gross_profit !== undefined && data.gross_profit !== null ? parseInt(data.gross_profit, 10) : null,
        operating_cash_flow: data.operating_cash_flow !== undefined && data.operating_cash_flow !== null ? parseInt(data.operating_cash_flow, 10) : null,
        freeCashFlow: data.fcf !== undefined && data.fcf !== null ? parseInt(data.fcf, 10) : null,
        shareIssued: data.diluted_shares !== undefined && data.diluted_shares !== null ? parseInt(data.diluted_shares, 10) : null,
        eps: data.eps !== undefined && data.eps !== null ? parseFloat(data.eps) : null,
        yoy_revenue_growth_pct: data.yoy_revenue_growth_pct !== undefined && data.yoy_revenue_growth_pct !== null ? parseFloat(data.yoy_revenue_growth_pct) : null
      });
    }
  }

  // 2. Load strategies/fundamentals_master.json
  console.log('\n[2/4] Lese data/cache/strategies/fundamentals_master.json...');
  if (fs.existsSync(STRAT_MASTER_PATH)) {
    const stratMaster = JSON.parse(fs.readFileSync(STRAT_MASTER_PATH, 'utf8'));
    const tickers = Object.keys(stratMaster);
    audit.sources.strategiesMaster.tickers = tickers.length;

    for (const sym of tickers) {
      const records = stratMaster[sym] || [];
      audit.sources.strategiesMaster.rawRecords += records.length;
      for (const r of records) {
        mergeRecord(sym, r.period_end_date, r.period, r);
      }
    }
    console.log(`      ✓ ${audit.sources.strategiesMaster.tickers} Ticker, ${audit.sources.strategiesMaster.rawRecords} Rohzeilen eingelesen.`);
  }

  // 3. Load strategies/fundamentals/*.json (Single files with newer/richer metrics)
  console.log('\n[3/4] Lese Einzelfiles aus data/cache/strategies/fundamentals/*.json...');
  if (fs.existsSync(STRAT_FUND_DIR)) {
    const sFiles = fs.readdirSync(STRAT_FUND_DIR).filter(f => f.endsWith('.json'));
    audit.sources.strategiesSingleFiles.files = sFiles.length;
    audit.sources.strategiesSingleFiles.tickers = sFiles.length;

    for (const f of sFiles) {
      const sym = f.replace('.json', '').toUpperCase();
      const content = JSON.parse(fs.readFileSync(path.join(STRAT_FUND_DIR, f), 'utf8'));
      if (!Array.isArray(content)) continue;

      audit.sources.strategiesSingleFiles.rawRecords += content.length;
      for (const r of content) {
        mergeRecord(sym, r.period_end_date, r.period, r);
      }
    }
    console.log(`      ✓ ${audit.sources.strategiesSingleFiles.files} Dateien, ${audit.sources.strategiesSingleFiles.rawRecords} Rohzeilen gemerged.`);
  }

  // 4. Load turnarounds/parsed_fundamentals_master.json
  if (fs.existsSync(TURNAROUND_MASTER_PATH)) {
    console.log('\n[4/4] Lese data/cache/turnarounds/parsed_fundamentals_master.json...');
    const turnaroundMaster = JSON.parse(fs.readFileSync(TURNAROUND_MASTER_PATH, 'utf8'));
    const tTickers = Object.keys(turnaroundMaster);
    audit.sources.turnaroundMaster.tickers = tTickers.length;

    for (const sym of tTickers) {
      const obj = turnaroundMaster[sym];
      const quarters = (obj && Array.isArray(obj.financials)) ? obj.financials : ((obj && Array.isArray(obj.quarterly)) ? obj.quarterly : []);
      audit.sources.turnaroundMaster.rawRecords += quarters.length;

      for (const q of quarters) {
        mergeRecord(sym, q.period_end, null, {
          filing_date: q.filing_date,
          revenue: q.revenue,
          net_income: q.net_income,
          gross_profit: q.gross_profit,
          operating_cash_flow: q.operating_cash_flow,
          fcf: q.fcf,
          diluted_shares: q.diluted_shares,
          yoy_revenue_growth_pct: q.yoy_rev_growth_pct
        });
      }
    }
    console.log(`      ✓ ${audit.sources.turnaroundMaster.tickers} Ticker, ${audit.sources.turnaroundMaster.rawRecords} Rohzeilen gemerged.`);
  }

  const allRecords = Array.from(mergedMap.values());
  audit.mergedPositions = allRecords.length;
  console.log(`\n================================================================`);
  console.log(`  GESAMT: ${audit.mergedPositions} konsolidierte Quartalsberichte für ${audit.uniqueTickers.size} Ticker`);
  console.log(`  Ticker: ${Array.from(audit.uniqueTickers).sort().join(', ')}`);
  console.log(`================================================================\n`);

  // 5. Batch Insert into DB
  if (!isDryRun) {
    console.log('Führe Batch-Insert in company_fundamentals durch...');
    const BATCH_SIZE = 500;
    const query = `
      INSERT INTO company_fundamentals 
        (symbol, date, period, filing_date, totalRevenue, netIncome, gross_profit, operating_cash_flow, freeCashFlow, shareIssued, eps, yoy_revenue_growth_pct)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        filing_date = COALESCE(VALUES(filing_date), filing_date),
        totalRevenue = COALESCE(VALUES(totalRevenue), totalRevenue),
        netIncome = COALESCE(VALUES(netIncome), netIncome),
        gross_profit = COALESCE(VALUES(gross_profit), gross_profit),
        operating_cash_flow = COALESCE(VALUES(operating_cash_flow), operating_cash_flow),
        freeCashFlow = COALESCE(VALUES(freeCashFlow), freeCashFlow),
        shareIssued = COALESCE(VALUES(shareIssued), shareIssued),
        eps = COALESCE(VALUES(eps), eps),
        yoy_revenue_growth_pct = COALESCE(VALUES(yoy_revenue_growth_pct), yoy_revenue_growth_pct);
    `;

    let inserted = 0;
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      const values = batch.map(r => [
        r.symbol,
        r.date,
        r.period,
        r.filing_date,
        r.totalRevenue,
        r.netIncome,
        r.gross_profit,
        r.operating_cash_flow,
        r.freeCashFlow,
        r.shareIssued,
        r.eps,
        r.yoy_revenue_growth_pct
      ]);

      await pool.query(query, [values]);
      inserted += batch.length;
      process.stdout.write(`      Eingespielt: ${inserted} / ${allRecords.length}\r`);
    }

    const [finalRows] = await pool.query('SELECT COUNT(*) as cnt FROM company_fundamentals');
    audit.dbAfterCount = finalRows[0].cnt;
    console.log(`\n      ✓ ${inserted} Datensätze via Upsert übertragen.`);
    console.log(`📊 Neuer DB-Stand (company_fundamentals): ${audit.dbAfterCount} Zeilen (+${audit.dbAfterCount - audit.dbBeforeCount} neue Zeilen)!\n`);
  } else {
    console.log('DRY-RUN aktiv: Keine Datenbankänderungen vorgenommen.');
  }

  // Save audit log to sandbox
  fs.writeFileSync('sandbox/fundamentals_import_audit.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    isDryRun,
    audit: {
      ...audit,
      uniqueTickers: Array.from(audit.uniqueTickers).sort()
    }
  }, null, 2), 'utf8');

  console.log('✓ Audit-Log gespeichert in sandbox/fundamentals_import_audit.json');

  await pool.end();
}

main().catch(err => {
  console.error('Fehler beim Fundamentaldaten-Import:', err);
  process.exit(1);
});
