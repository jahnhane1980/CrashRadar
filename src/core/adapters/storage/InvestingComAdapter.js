export class InvestingComAdapter {
  getInsertQueryAndValues(task, data) {
    const query = `
      INSERT INTO econ_challenger (record_date, value)
      VALUES ?
      ON DUPLICATE KEY UPDATE value = VALUES(value)
    `;
    const values = data.map(item => [item.record_date, item.value]);
    return { query, values };
  }
}
