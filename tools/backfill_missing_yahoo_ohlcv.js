/**
 * @tools/backfill_missing_yahoo_ohlcv.js
 * @purpose: Backfill 10-year 100% full OHLCV daily data for 56 missing stocks from Yahoo Finance into market_data_yahoo
 * @created: 2026-09-16
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import YahooFinance from 'yahoo-finance2';

dotenv.config();

const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

const TICKERS = [
  'AAPL', 'ADBE', 'ADI', 'AMAT', 'AMD', 'APP', 'AVAV', 'AVGO', 'BABA', 'BYND',
  'CEG', 'CGNX', 'CRM', 'CRWD', 'CVX', 'DASH', 'DDOG', 'DFNS.L', 'ETH-USD', 'ETN',
  'FCX', 'FSLY', 'GEV', 'GOOGL', 'HIMS', 'HOOD', 'INTU', 'JD', 'KTOS', 'LLY',
  'LRCX', 'MA', 'META', 'MSFT', 'MU', 'NET', 'NOW', 'NU', 'OKTA', 'PANW',
  'PDD', 'PTON', 'PYPL', 'SE', 'SNOW', 'SOL-USD', 'SPCE', 'SPOT', 'TER', 'TSM',
  'TXN', 'UBER', 'UNH', 'UPST', 'V', 'WDAY'
];

const START_DATE = '2014-10-01';
const END_DATE = '2026-09-16';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('================================================================');
  console.log('  STAGE C.2: YAHOO FINANCE 100% OHLCV BACKFILL (56 TICKER)');
  console.log(`  Zeitraum: ${START_DATE} bis ${END_DATE}`);
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  const pool = mysql.createPool({ uri: dbUrl, dateStrings: true });

  const [initialRows] = await pool.query('SELECT COUNT(*) as cnt FROM market_data_yahoo');
  const dbBeforeCount = initialRows[0].cnt;
  console.log(`📊 Aktueller Stand in DB (market_data_yahoo): ${dbBeforeCount} Zeilen\n`);

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

  let totalBarsInserted = 0;
  let successfulTickers = 0;
  const failedTickers = [];

  for (let i = 0; i < TICKERS.length; i++) {
    const sym = TICKERS[i];
    process.stdout.write(`[${(i + 1).toString().padStart(2)}/${TICKERS.length}] Lade ${sym.padEnd(8)}... `);

    try {
      const chart = await yf.chart(sym, {
        period1: START_DATE,
        period2: END_DATE,
        interval: '1d'
      });

      const quotes = (chart.quotes || [])
        .filter(q => q.close !== null && q.close !== undefined && q.date)
        .map(q => [
          sym,
          q.date.toISOString().split('T')[0],
          q.open !== null && q.open !== undefined ? parseFloat(q.open) : null,
          q.high !== null && q.high !== undefined ? parseFloat(q.high) : null,
          q.low !== null && q.low !== undefined ? parseFloat(q.low) : null,
          parseFloat(q.adjclose || q.close),
          q.volume !== null && q.volume !== undefined ? parseFloat(q.volume) : 0
        ]);

      if (quotes.length > 0) {
        // Insert in batches of 1000
        const BATCH_SIZE = 1000;
        for (let b = 0; b < quotes.length; b += BATCH_SIZE) {
          const chunk = quotes.slice(b, b + BATCH_SIZE);
          await pool.query(query, [chunk]);
        }
        totalBarsInserted += quotes.length;
        successfulTickers++;
        console.log(`✓ ${quotes.length} Bars (${quotes[0][1]} bis ${quotes[quotes.length - 1][1]})`);
      } else {
        console.log('⚠️ Keine Daten empfangen.');
        failedTickers.push({ sym, reason: 'Empty quotes' });
      }

      await wait(250); // Rate-limiting guard
    } catch (err) {
      console.log(`❌ Fehler: ${err.message}`);
      failedTickers.push({ sym, reason: err.message });
      await wait(500);
    }
  }

  const [finalRows] = await pool.query('SELECT COUNT(*) as cnt FROM market_data_yahoo');
  const dbAfterCount = finalRows[0].cnt;

  console.log('\n================================================================');
  console.log(`  FERTIG! Erfolgreich: ${successfulTickers}/${TICKERS.length} Ticker`);
  console.log(`  Gesamte Bars eingespielt: ${totalBarsInserted}`);
  if (failedTickers.length > 0) {
    console.log(`  Fehlerhafte Ticker (${failedTickers.length}):`, failedTickers);
  }
  console.log(`📊 Neuer DB-Stand (market_data_yahoo): ${dbAfterCount} Zeilen (+${dbAfterCount - dbBeforeCount} neue Zeilen)!`);
  console.log('================================================================\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fataler Fehler beim Backfill:', err);
  process.exit(1);
});
