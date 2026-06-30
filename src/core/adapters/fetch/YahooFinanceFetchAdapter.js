import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export class YahooFinanceFetchAdapter {
  async fetch(task, provider, startValue) {
    if (startValue) {
      let dateToCheck = String(startValue);
      // Wenn es ein YYYY-MM-DD String ist, als UTC Mitternacht interpretieren
      if (!dateToCheck.includes('T') && isNaN(Number(dateToCheck))) {
        dateToCheck += 'T00:00:00.000Z';
      } else if (!isNaN(Number(dateToCheck))) {
        // Fallback falls Unix-Timestamp in ms
        dateToCheck = Number(dateToCheck);
      }
      
      const startDate = new Date(dateToCheck);
      if (!isNaN(startDate.getTime()) && startDate > new Date()) {
        console.log(`[YahooFinanceFetchAdapter] Skipping ${task.ticker} as startValue (${startValue}) is in the future.`);
        return [];
      }
    }

    const options = task.options || {};
    options[provider.pagination?.startParam || 'period1'] = startValue;
    return await yahooFinance[task.method](task.ticker, options);
  }
}
