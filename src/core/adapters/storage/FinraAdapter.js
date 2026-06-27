export class FinraAdapter {
    getInsertQueryAndValues(task, data) {
        if (!data || data.length === 0) return null;

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
