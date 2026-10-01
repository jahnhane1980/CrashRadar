export class M5StorageAdapter {
  getInsertQueryAndValues(task, data) {
    if (!data || data.length === 0) {
      return { query: null, values: [] };
    }

    const query = `
      INSERT INTO market_data_m5 (symbol, record_time, open, high, low, close, volume)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), volume = VALUES(volume)
    `;

    const values = data.map(item => {
      let record_time;
      if (typeof item.t === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(item.t)) {
        record_time = item.t;
      } else {
        const d = new Date(item.t);
        record_time = d.toISOString().replace('T', ' ').substring(0, 19);
      }

      return [
        task.ticker,
        record_time,
        item.o,
        item.h,
        item.l,
        item.c,
        item.v || 0
      ];
    });

    return { query, values };
  }
}
