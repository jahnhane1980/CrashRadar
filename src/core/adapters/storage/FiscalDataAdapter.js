export class FiscalDataAdapter {
  getInsertQueryAndValues(task, data) {
    if (task.id === 'fiscaldata_tga') {
      const query = `
        INSERT INTO fiscal_tga (record_date, open_balance, close_balance)
        VALUES ?
        ON DUPLICATE KEY UPDATE open_balance = VALUES(open_balance), close_balance = VALUES(close_balance)
      `;
      const values = data.filter(item => item.account_type === 'Treasury General Account (TGA) Closing Balance' || item.account_type === 'Federal Reserve Account' || item.account_type === 'Treasury General Account (TGA)')
                         .map(item => [item.record_date, item.open_today_bal, item.close_today_bal]);
      return { query, values };
    } else if (task.id === 'fiscaldata_auctions') {
      const query = `
        INSERT INTO fiscal_auctions (auction_date, cusip, security_type, issue_date, maturity_date, total_accepted, high_yield)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          security_type = VALUES(security_type), issue_date = VALUES(issue_date), maturity_date = VALUES(maturity_date), total_accepted = VALUES(total_accepted), high_yield = VALUES(high_yield)
      `;
      const values = data.map(item => [item.record_date, item.cusip, item.security_type, item.issue_date, item.maturity_date, item.total_accepted, item.high_yield]);
      return { query, values };
    }
    
    // Fallback falls unbekannt
    return { query: null, values: [] };
  }
}
