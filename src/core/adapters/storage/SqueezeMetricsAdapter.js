export class SqueezeMetricsAdapter {
  getInsertQueryAndValues(task, data) {
    if (!data || data.length === 0) return null;

    if (task.id === 'squeezemetrics_dix') {
      const query = `
        INSERT INTO market_data_dix (record_date, price, dix, gex)
        VALUES ?
        ON DUPLICATE KEY UPDATE 
            price = VALUES(price),
            dix = VALUES(dix),
            gex = VALUES(gex)
      `;
      const values = data.map(item => [
          item.record_date,
          item.price,
          item.dix,
          item.gex
      ]);
      return { query, values };
    }

    return null;
  }
}
