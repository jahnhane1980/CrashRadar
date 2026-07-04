import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export class YahooFinanceFetchAdapter {
  async fetch(task, provider, startValue) {
    if (task.method === 'options') {
      console.log(`[YahooFinanceFetchAdapter] Fetching Options Chain for ${task.ticker}...`);
      const result = await yahooFinance.options(task.ticker);
      if (!result.options || result.options.length === 0) return { quotes: [] };
      
      let allCalls = [];
      let allPuts = [];
      for (const chain of result.options) {
         allCalls.push(...(chain.calls || []));
         allPuts.push(...(chain.puts || []));
      }
      
      const maxCall = allCalls.sort((a,b) => (b.openInterest || 0) - (a.openInterest || 0))[0];
      const maxPut = allPuts.sort((a,b) => (b.openInterest || 0) - (a.openInterest || 0))[0];
      
      if (!maxCall || !maxPut) return { quotes: [] };
      
      const today = new Date().toISOString().split('T')[0];
      return { 
        quotes: [{
          date: today,
          ticker: task.ticker,
          call_wall_strike: maxCall.strike,
          call_wall_oi: maxCall.openInterest,
          put_wall_strike: maxPut.strike,
          put_wall_oi: maxPut.openInterest
        }]
      };
    }

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
