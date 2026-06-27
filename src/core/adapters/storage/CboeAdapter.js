export class CboeAdapter {
  getInsertQueryAndValues(task, data) {
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
