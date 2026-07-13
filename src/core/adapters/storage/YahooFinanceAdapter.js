export class YahooFinanceAdapter {
  getInsertQueryAndValues(task, data) {
    const symbol = task.ticker;
    
    if (task.method === 'fundamentals') {
      const query = `
        INSERT INTO company_fundamentals (symbol, date, period, shareIssued, freeCashFlow, totalRevenue, netIncome, financingCashFlow, institutional_ownership)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          shareIssued = VALUES(shareIssued),
          freeCashFlow = VALUES(freeCashFlow),
          totalRevenue = VALUES(totalRevenue),
          netIncome = VALUES(netIncome),
          financingCashFlow = VALUES(financingCashFlow),
          institutional_ownership = VALUES(institutional_ownership)
      `;
      const values = data.map(item => [
        item.ticker, 
        item.date,
        item.period,
        item.shareIssued, 
        item.freeCashFlow, 
        item.totalRevenue, 
        item.netIncome, 
        item.financingCashFlow, 
        item.institutional_ownership
      ]);
      return { query, values };
    }

    const query = `
      INSERT INTO market_data_yahoo (symbol, record_date, open, high, low, close, volume)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), volume = VALUES(volume)
    `;
    const values = data.map(item => {
      if (!item.date) throw new Error(`Missing date in YahooFinance data for ${symbol}`);
      let dateStr;
      if (typeof item.date === 'string') {
        dateStr = item.date.substring(0, 10);
      } else {
        const d = item.date instanceof Date ? item.date : new Date(item.date);
        if (isNaN(d.getTime())) throw new Error(`Invalid date in YahooFinance data for ${symbol}: ${item.date}`);
        dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      }
      return [symbol, dateStr, item.open, item.high, item.low, item.close, item.volume];
    });
    return { query, values };
  }
}
