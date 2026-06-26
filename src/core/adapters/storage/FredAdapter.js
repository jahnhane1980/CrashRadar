export class FredAdapter {
  getInsertQueryAndValues(task, data) {
    if (!task.params || !task.params.series_id) throw new Error(`Missing series_id in params for task ${task.id}`);
    const series_id = task.params.series_id;
    
    const query = `
      INSERT INTO econ_fred (series_id, observation_date, value)
      VALUES ?
      ON DUPLICATE KEY UPDATE value = VALUES(value)
    `;
    const values = data.map(item => [series_id, item.date, item.value === '.' ? null : item.value]);
    return { query, values };
  }
}
