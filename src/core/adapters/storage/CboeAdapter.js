export class CboeAdapter {
  getInsertQueryAndValues(task, data) {
    if (!data || data.length === 0) return null;

    if (task.dataset === 'pcr') {
      const query = `
        INSERT INTO market_data_pcr (record_date, total_pcr, equity_pcr, index_pcr)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          total_pcr = VALUES(total_pcr),
          equity_pcr = VALUES(equity_pcr),
          index_pcr = VALUES(index_pcr)
      `;
      const values = data.map(item => [item.record_date, item.total_pcr, item.equity_pcr, item.index_pcr]);
      return { query, values };
    }

    if (!task.ticker || typeof task.ticker !== 'string') throw new Error(`Invalid or missing ticker for task ${task.id}`);
    const symbol = task.ticker;
    
    const query = `
      INSERT INTO market_data_cboe (symbol, record_date, volume)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        volume = VALUES(volume)
    `;
    const values = data.map(item => [symbol, item.record_date, item.volume]);
    return { query, values };
  }
}
