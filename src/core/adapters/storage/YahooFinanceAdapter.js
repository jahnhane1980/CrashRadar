export class YahooFinanceAdapter {
  getInsertQueryAndValues(task, data) {
    if (!data || data.length === 0) return { query: null, values: [] };

    const symbol = task.ticker;

    if (task.method === 'options') {
      const targetTable = task.targetTable !== undefined ? task.targetTable : 'market_data_options_wall';
      if (!targetTable) {
        return { query: null, values: [] };
      }
      const query = `
        INSERT INTO ${targetTable} (symbol, record_date, call_wall_strike, call_wall_oi, put_wall_strike, put_wall_oi)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          call_wall_strike = VALUES(call_wall_strike),
          call_wall_oi = VALUES(call_wall_oi),
          put_wall_strike = VALUES(put_wall_strike),
          put_wall_oi = VALUES(put_wall_oi)
      `;
      const values = data.map(item => {
        let dateStr;
        const dVal = item.date || item.record_date;
        if (!dVal) throw new Error(`Missing date in YahooFinance options data for ${symbol}`);
        if (typeof dVal === 'string') {
          dateStr = dVal.substring(0, 10);
        } else {
          const d = dVal instanceof Date ? dVal : new Date(dVal);
          if (isNaN(d.getTime())) throw new Error(`Invalid date in YahooFinance options data for ${symbol}: ${dVal}`);
          dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        }
        return [
          item.ticker || symbol,
          dateStr,
          item.call_wall_strike,
          item.call_wall_oi,
          item.put_wall_strike,
          item.put_wall_oi
        ];
      });
      return { query, values };
    }
    
    if (task.method === 'fundamentals') {
      try {
        if (!data || !Array.isArray(data) || data.length === 0) {
          return { query: null, values: [] };
        }

        const keys = Object.keys(data[0]);
        const columns = keys.map(k => (k === 'ticker' ? 'symbol' : k));

        const updateClauses = columns
          .filter(col => !['symbol', 'date', 'period'].includes(col))
          .map(col => `${col} = COALESCE(VALUES(${col}), ${col})`)
          .join(',\n            ');

        const query = `
          INSERT INTO company_fundamentals (${columns.join(', ')})
          VALUES ?
          ON DUPLICATE KEY UPDATE
            ${updateClauses}
        `;

        const values = data.map(item =>
          keys.map(k => {
            const val = item[k];
            if (k === 'ebitda' && (val === 0 || val == null || Number.isNaN(val))) return null;
            if (val === undefined) return null;
            return val;
          })
        );

        return { query, values };
      } catch (error) {
        console.error(`[YahooFinanceAdapter] Mapping-Fehler bei ${task.ticker}: ${error.message}`);
        return { query: null, values: [] };
      }
    }

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
    return { query, values };
  }
}
