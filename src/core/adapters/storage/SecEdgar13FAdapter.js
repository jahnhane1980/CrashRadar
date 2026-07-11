export class SecEdgar13FAdapter {
  getInsertQueryAndValues(task, data) {
    if (!data || data.length === 0) return null;

    if (task.id.startsWith('sec_13f_')) {
      const query = `
        INSERT INTO fund_13f_holdings (cik, report_date, filing_date, cusip, put_call, issuer_name, shares, value)
        VALUES ?
        ON DUPLICATE KEY UPDATE 
            filing_date = VALUES(filing_date),
            issuer_name = VALUES(issuer_name),
            shares = VALUES(shares),
            value = VALUES(value)
      `;
      
      const values = data.map(item => [
          item.cik,
          item.report_date,
          item.filing_date,
          item.cusip,
          item.put_call,
          item.issuer_name,
          item.shares,
          item.value
      ]);
      return { query, values };
    }

    return null;
  }
}
