export class TiingoAdapter {
  getInsertQueryAndValues(task, data) {
    if (!task.ticker || typeof task.ticker !== 'string') throw new Error(`Invalid or missing ticker for task ${task.id}`);
    const symbol = task.ticker;
    const resolution = task.resolution || 'daily';
    
    const query = `
      INSERT INTO market_data_tiingo (symbol, record_date, resolution, open, high, low, close, volume)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), volume = VALUES(volume)
    `;
    const values = data.map(item => [symbol, item.date.split('T')[0], resolution, item.open, item.high, item.low, item.close, item.volume]);
    return { query, values };
  }
}
