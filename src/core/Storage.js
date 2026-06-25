import mysql from 'mysql2/promise';

export class Storage {
  constructor(config = {}) {
    this.databaseUrl = config.databaseUrl || process.env.DATABASE_URL;
    if (!this.databaseUrl) {
      throw new Error("No database URL provided for Storage.");
    }
    
    // Wir nutzen einen Connection-Pool, was für asynchrone Systeme deutlich
    // performanter und sicherer ist.
    this.pool = mysql.createPool(this.databaseUrl);
  }

  async getSyncState(job_id) {
    const [rows] = await this.pool.query('SELECT cursor_data FROM sync_states WHERE job_id = ?', [job_id]);
    return rows.length > 0 ? { cursor_data: rows[0].cursor_data } : undefined;
  }

  async insertDataAndState(task, data, newLastRecord) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Insert Data
      if (task.provider === 'Binance') {
        const query = `
          INSERT INTO market_data_binance (symbol, interval_type, open_time, open, high, low, close, volume, quote_asset_volume, trades, taker_buy_base_asset_volume, close_time)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), volume = VALUES(volume),
            quote_asset_volume = VALUES(quote_asset_volume), trades = VALUES(trades), taker_buy_base_asset_volume = VALUES(taker_buy_base_asset_volume), close_time = VALUES(close_time)
        `;
        const values = data.map(item => [task.params.symbol, task.params.interval, item[0], item[1], item[2], item[3], item[4], item[5], item[7], item[8], item[9], item[6]]);
        await connection.query(query, [values]);
      } else if (task.provider === 'Tiingo') {
         if (!task.dbKey || typeof task.dbKey !== 'string') throw new Error(`Invalid or missing dbKey for task ${task.id}`);
         const parts = task.dbKey.split('.');
         if (parts.length < 2) throw new Error(`Invalid dbKey format for task ${task.id}`);
         const symbol = parts[1].split('_')[0];
         const resolution = task.dbKey.split('_')[1] || 'daily';
         const query = `
           INSERT INTO market_data_tiingo (symbol, record_date, resolution, open, high, low, close, volume)
           VALUES ?
           ON DUPLICATE KEY UPDATE
             open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), volume = VALUES(volume)
         `;
         const values = data.map(item => [symbol, item.date.split('T')[0], resolution, item.open, item.high, item.low, item.close, item.volume]);
         await connection.query(query, [values]);
      } else if (task.provider === 'FRED') {
         if (!task.params || !task.params.series_id) throw new Error(`Missing series_id in params for task ${task.id}`);
         const series_id = task.params.series_id;
         const query = `
           INSERT INTO econ_fred (series_id, observation_date, value)
           VALUES ?
           ON DUPLICATE KEY UPDATE value = VALUES(value)
         `;
         const values = data.map(item => [series_id, item.date, item.value === '.' ? null : item.value]);
         await connection.query(query, [values]);
      } else if (task.provider === 'FiscalData') {
         if (task.id === 'fiscaldata_tga') {
           const query = `
             INSERT INTO fiscal_tga (record_date, open_balance, close_balance)
             VALUES ?
             ON DUPLICATE KEY UPDATE open_balance = VALUES(open_balance), close_balance = VALUES(close_balance)
           `;
           const values = data.filter(item => item.account_type === 'Treasury General Account (TGA) Closing Balance' || item.account_type === 'Federal Reserve Account' || item.account_type === 'Treasury General Account (TGA)')
                              .map(item => [item.record_date, item.open_today_bal, item.close_today_bal]);
           if (values.length > 0) await connection.query(query, [values]);
         } else if (task.id === 'fiscaldata_auctions') {
           const query = `
             INSERT INTO fiscal_auctions (auction_date, cusip, security_type, issue_date, maturity_date, total_accepted, high_yield)
             VALUES ?
             ON DUPLICATE KEY UPDATE
               security_type = VALUES(security_type), issue_date = VALUES(issue_date), maturity_date = VALUES(maturity_date), total_accepted = VALUES(total_accepted), high_yield = VALUES(high_yield)
           `;
           const values = data.map(item => [item.record_date, item.cusip, item.security_type, item.issue_date, item.maturity_date, item.total_accepted, item.high_yield]);
           await connection.query(query, [values]);
         }
      } else if (task.provider === 'YahooFinance') {
        const symbol = task.ticker;
        const query = `
          INSERT INTO market_data_yahoo (symbol, record_date, open, high, low, close, volume)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), volume = VALUES(volume)
        `;
        const values = data.map(item => {
          if (!item.date) throw new Error(`Missing date in YahooFinance data for ${symbol}`);
          let dateStr;
          if (typeof item.date === 'string') {
            dateStr = item.date.substring(0, 10);
          } else {
            const d = item.date instanceof Date ? item.date : new Date(item.date);
            if (isNaN(d.getTime())) throw new Error(`Invalid date in YahooFinance data for ${symbol}: ${item.date}`);
            dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
          }
          return [symbol, dateStr, item.open, item.high, item.low, item.close, item.volume];
        });
        await connection.query(query, [values]);
      }

      // 2. Update State
      const stateQuery = `
        INSERT INTO sync_states (job_id, provider, cursor_data, updated_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          cursor_data = VALUES(cursor_data),
          updated_at = VALUES(updated_at)
      `;
      await connection.query(stateQuery, [task.id, task.provider, JSON.stringify(newLastRecord), new Date().toISOString()]);

      await connection.commit();
      console.log(`[Storage] Inserted/Updated ${data.length} items and state for task '${task.id}'`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
