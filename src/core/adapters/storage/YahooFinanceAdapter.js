export class YahooFinanceAdapter {
  getInsertQueryAndValues(task, data) {
    if (!data || data.length === 0) return { query: null, values: [] };

    const symbol = task.ticker;

    if (task.method === 'options') {
      const targetTable = task.targetTable !== undefined ? task.targetTable : 'market_data_options_wall';
      if (!targetTable) {
        return { query: null, values: [] };
      }
      const query = `
        INSERT INTO ${targetTable} (symbol, record_date, call_wall_strike, call_wall_oi, put_wall_strike, put_wall_oi)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          call_wall_strike = VALUES(call_wall_strike),
          call_wall_oi = VALUES(call_wall_oi),
          put_wall_strike = VALUES(put_wall_strike),
          put_wall_oi = VALUES(put_wall_oi)
      `;
      const values = data.map(item => {
        let dateStr;
        const dVal = item.date || item.record_date;
        if (!dVal) throw new Error(`Missing date in YahooFinance options data for ${symbol}`);
        if (typeof dVal === 'string') {
          dateStr = dVal.substring(0, 10);
        } else {
          const d = dVal instanceof Date ? dVal : new Date(dVal);
          if (isNaN(d.getTime())) throw new Error(`Invalid date in YahooFinance options data for ${symbol}: ${dVal}`);
          dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        }
        return [
          item.ticker || symbol,
          dateStr,
          item.call_wall_strike,
          item.call_wall_oi,
          item.put_wall_strike,
          item.put_wall_oi
        ];
      });
      return { query, values };
    }
    
    if (task.method === 'fundamentals') {
      const query = `
        INSERT INTO company_fundamentals (symbol, date, period, shareIssued, freeCashFlow, totalRevenue, netIncome, financingCashFlow, inventory, cogs, cash_and_cash_equivalents, total_debt, short_term_debt, ebitda, interest_expense, stock_based_compensation, institutional_ownership)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          shareIssued = VALUES(shareIssued),
          freeCashFlow = VALUES(freeCashFlow),
          totalRevenue = VALUES(totalRevenue),
          netIncome = VALUES(netIncome),
          financingCashFlow = VALUES(financingCashFlow),
          inventory = VALUES(inventory),
          cogs = VALUES(cogs),
          cash_and_cash_equivalents = VALUES(cash_and_cash_equivalents),
          total_debt = VALUES(total_debt),
          short_term_debt = VALUES(short_term_debt),
          ebitda = VALUES(ebitda),
          interest_expense = VALUES(interest_expense),
          stock_based_compensation = VALUES(stock_based_compensation),
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
        item.inventory,
        item.cogs,
        item.cash_and_cash_equivalents,
        item.total_debt,
        item.short_term_debt,
        item.ebitda,
        item.interest_expense,
        item.stock_based_compensation,
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
