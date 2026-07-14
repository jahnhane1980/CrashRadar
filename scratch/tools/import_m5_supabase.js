import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';

const MAPPING = {
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
  console.log('=== START M5 IMPORT: SUPABASE -> CRASHRADAR ===');

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
    console.log('[Setup] Creating market_data_m5 table if not exists...');
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

    const tickerIds = Object.keys(MAPPING).map(Number);
    console.log(`[Fetch] Querying Supabase for ticker IDs: ${tickerIds.join(', ')}...`);

    let allData = [];
    let page = 0;
    const limit = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('market_m5_candles')
        .select('*')
        .in('ticker', tickerIds)
        .range(page * limit, (page + 1) * limit - 1);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!data || data.length === 0) {
        break;
      }

      allData.push(...data);
      console.log(`  -> Fetched ${allData.length} records so far...`);
      if (data.length < limit) break;
      page++;
    }

    console.log(`[Transform] Transforming ${allData.length} records...`);
    const valuesToInsert = allData.map(row => {
      const symbol = MAPPING[row.ticker];
      
      // If timestamp is like 1781205900, it's seconds. If it's 1781205900000, it's ms.
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
      console.log(`[Insert] Writing to MySQL table market_data_m5...`);
      const chunkSize = 2000;
      for (let i = 0; i < valuesToInsert.length; i += chunkSize) {
        const chunk = valuesToInsert.slice(i, i + chunkSize);
        await pool.query(`
          INSERT IGNORE INTO market_data_m5 (symbol, record_time, open, high, low, close, volume)
          VALUES ?
        `, [chunk]);
        console.log(`  -> Inserted batch ${i / chunkSize + 1} of ${Math.ceil(valuesToInsert.length/chunkSize)}`);
      }
      console.log(`[Success] Inserted total of ${valuesToInsert.length} records.`);
    } else {
      console.log('[Warning] No records found to insert.');
    }

  } catch (err) {
    console.error('[Fatal]', err);
  } finally {
    await pool.end();
  }
}

run();
