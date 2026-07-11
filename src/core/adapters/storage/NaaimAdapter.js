export class NaaimAdapter {
    getInsertQueryAndValues(task, data) {
        if (!data || data.length === 0) return null;

        if (task.id === 'naaim_exposure') {
            const query = `
                INSERT INTO market_data_naaim (record_date, exposure_index)
                VALUES ?
                ON DUPLICATE KEY UPDATE 
                    exposure_index = VALUES(exposure_index)
            `;
            const values = data.map(item => [
                item.record_date,
                item.exposure_index
            ]);
            return { query, values };
        }

        return null;
    }
}
