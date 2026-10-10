export class ShortInterestAdapter {
  getInsertQueryAndValues(task, data) {
    if (!data || data.length === 0) return { query: null, values: [] };

    const query = `
      INSERT INTO market_data_short_interest (symbol, date, short_interest_pct_float, days_to_cover)
      VALUES ?
      ON DUPLICATE KEY UPDATE 
          short_interest_pct_float = VALUES(short_interest_pct_float),
          days_to_cover = VALUES(days_to_cover)
    `;

    const values = data.map(item => [
        item.symbol,
        item.date,
        item.short_interest_pct_float,
        item.days_to_cover
    ]);

    return { query, values };
  }
}
