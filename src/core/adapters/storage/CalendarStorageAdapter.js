export class CalendarStorageAdapter {
  getInsertQueryAndValues(task, data) {
    if (!Array.isArray(data) || data.length === 0) {
      return { query: null, values: [] };
    }

    const query = `
      INSERT INTO macro_calendar_events (
        id, category, subcategory, title, event_date, event_time, status, criticality, metadata_json, actual_value, details_json, source
      )
      VALUES ?
      ON DUPLICATE KEY UPDATE
        category = VALUES(category),
        subcategory = VALUES(subcategory),
        title = VALUES(title),
        event_date = VALUES(event_date),
        event_time = VALUES(event_time),
        status = VALUES(status),
        criticality = VALUES(criticality),
        metadata_json = VALUES(metadata_json),
        actual_value = VALUES(actual_value),
        details_json = VALUES(details_json),
        source = VALUES(source),
        updated_at = CURRENT_TIMESTAMP
    `;

    const values = data.map(item => [
      item.id,
      item.category,
      item.subcategory,
      item.title,
      item.event_date,
      item.event_time || null,
      item.status || 'SCHEDULED',
      item.criticality || 'MEDIUM',
      typeof item.metadata_json === 'object' && item.metadata_json !== null
        ? JSON.stringify(item.metadata_json)
        : (item.metadata_json || null),
      item.actual_value !== undefined && item.actual_value !== null ? String(item.actual_value) : null,
      typeof item.details_json === 'object' && item.details_json !== null
        ? JSON.stringify(item.details_json)
        : (item.details_json || null),
      item.source || 'CALENDAR_ADAPTER'
    ]);

    return { query, values };
  }
}
