export class AaiiAdapter {
    getInsertQueryAndValues(task, data) {
        if (!data || data.length === 0) return null;

        if (task.id === 'aaii_sentiment') {
            const query = `
                INSERT INTO market_data_aaii (record_date, bullish, neutral, bearish, spread)
                VALUES ?
                ON DUPLICATE KEY UPDATE 
                    bullish = VALUES(bullish),
                    neutral = VALUES(neutral),
                    bearish = VALUES(bearish),
                    spread = VALUES(spread)
            `;
            const values = data.map(item => [
                item.record_date,
                item.bullish,
                item.neutral,
                item.bearish,
                item.spread
            ]);
            return { query, values };
        }

        return null;
    }
}
