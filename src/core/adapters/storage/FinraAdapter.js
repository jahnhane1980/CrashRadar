export class FinraAdapter {
  getInsertQueryAndValues(task, data) {
    if (!data || data.length === 0) return null;

    if (task.dataset === 'short_volume') {
      const query = `
        INSERT INTO market_data_short_volume (symbol, record_date, short_volume, total_volume, short_volume_ratio)
        VALUES ?
        ON DUPLICATE KEY UPDATE 
            short_volume = VALUES(short_volume),
            total_volume = VALUES(total_volume),
            short_volume_ratio = VALUES(short_volume_ratio)
      `;
      const values = data.map(item => [
          item.symbol,
          item.record_date,
          item.short_volume,
          item.total_volume,
          item.short_volume_ratio
      ]);
      return { query, values };
    }

    const query = `
        INSERT INTO macro_margin_debt (record_date, margin_debt, free_credit_cash, free_credit_margin)
        VALUES ?
        ON DUPLICATE KEY UPDATE 
            margin_debt = VALUES(margin_debt),
            free_credit_cash = VALUES(free_credit_cash),
            free_credit_margin = VALUES(free_credit_margin)
    `;

    const values = data.map(item => [
        item.record_date,
        item.margin_debt,
        item.free_credit_cash,
        item.free_credit_margin
    ]);

    return { query, values };
  }
}
