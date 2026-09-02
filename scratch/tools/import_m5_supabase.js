import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';

const MAPPING = {
  1: 'IBRX',
  12: 'SOFI',
  13: 'SPY',
  27: 'SPY',
  28: 'QQQ',
  26: 'PLTR',
  25: 'NVTS',
  2: 'S',
  4: 'SOUN',
  6: 'IGV',
  5: 'CIBR'
};

async function run() {
  console.log('=== START INCREMENTAL M5 IMPORT: SUPABASE -> CRASHRADAR ===');

  const supabaseUrl = `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const dbUrl = process.env.DATABASE_URL;

  if (!supabaseKey || !dbUrl) {
    console.error('Missing ENV variables for Supabase or Database!');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const pool = mysql.createPool(dbUrl);

  try {
    console.log('[Setup] Ensuring market_data_m5 table exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS market_data_m5 (
        symbol VARCHAR(10) NOT NULL,
        record_time DATETIME NOT NULL,
        open DECIMAL(10, 4),
        high DECIMAL(10, 4),
        low DECIMAL(10, 4),
        close DECIMAL(10, 4),
        volume BIGINT,
        PRIMARY KEY (symbol, record_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 1. Hole aktuellen Max-Stand je Symbol aus MySQL
    const [latestRows] = await pool.query(`
      SELECT symbol, MAX(record_time) as max_time
      FROM market_data_m5
      GROUP BY symbol
    `);

    const latestBySymbol = {};
    for (const r of latestRows) {
      if (r.max_time) {
        latestBySymbol[r.symbol] = new Date(r.max_time);
      }
    }

    console.log('[Status] Aktuelle Stände in MySQL:');
    for (const [sym, dt] of Object.entries(latestBySymbol)) {
      console.log(`  ${sym.padEnd(6)}: ${dt.toISOString()}`);
    }

    let totalInserted = 0;

    // 2. Diff für jeden Ticker aus Supabase abrufen
    for (const [tickerIdStr, symbol] of Object.entries(MAPPING)) {
      const tickerId = Number(tickerIdStr);
      const lastDate = latestBySymbol[symbol];
      
      // Start-Timestamp (in Sekunden) mit 1 Stunde Sicherheitspuffer
      let startTimestampSec = 0;
      if (lastDate) {
        startTimestampSec = Math.max(0, Math.floor(lastDate.getTime() / 1000) - 3600);
      }

      console.log(`\n[Fetch] Ticker ${tickerId} (${symbol}) ab ${startTimestampSec > 0 ? new Date(startTimestampSec * 1000).toISOString() : 'Beginn'}...`);

      let page = 0;
      const limit = 1000;
      let tickerRows = 0;

      while (true) {
        let query = supabase
          .from('market_m5_candles')
          .select('*')
          .eq('ticker', tickerId)
          .order('timestamp', { ascending: true })
          .range(page * limit, (page + 1) * limit - 1);

        if (startTimestampSec > 0) {
          query = query.gte('timestamp', startTimestampSec);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`  [Error] Supabase Fehler für Ticker ${tickerId}: ${error.message}`);
          break;
        }

        if (!data || data.length === 0) {
          break;
        }

        const valuesToInsert = data.map(row => {
          const tsMs = row.timestamp > 100000000000 ? row.timestamp : row.timestamp * 1000;
          const d = new Date(tsMs);
          const iso = d.toISOString().replace('T', ' ').substring(0, 19);
          return [
            symbol,
            iso,
            row.open,
            row.high,
            row.low,
            row.close,
            row.volume
          ];
        });

        if (valuesToInsert.length > 0) {
          const [result] = await pool.query(`
            INSERT IGNORE INTO market_data_m5 (symbol, record_time, open, high, low, close, volume)
            VALUES ?
          `, [valuesToInsert]);
          
          tickerRows += result.affectedRows;
          totalInserted += result.affectedRows;
        }

        if (data.length < limit) break;
        page++;
      }

      console.log(`  -> ${tickerRows} neue Datensätze für ${symbol} (Ticker ${tickerId}) eingefügt.`);
    }

    console.log(`\n=== IMPORT ERFOLGREICH: Insgesamt ${totalInserted} neue M5-Kerzen importiert. ===\n`);

    // Finale Überprüfung
    const [finalStats] = await pool.query(`
      SELECT symbol, COUNT(*) as count, MIN(record_time) as min_time, MAX(record_time) as max_time
      FROM market_data_m5
      GROUP BY symbol
      ORDER BY symbol ASC
    `);
    console.log('--- Finale MySQL market_data_m5 Übersicht ---');
    console.table(finalStats);

  } catch (err) {
    console.error('[Fatal]', err);
  } finally {
    await pool.end();
  }
}

run();
