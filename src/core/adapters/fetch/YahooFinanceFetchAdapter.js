import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export class YahooFinanceFetchAdapter {
  async fetch(task, provider, startValue) {
    const options = task.options || {};
    options[provider.pagination?.startParam || 'period1'] = startValue;
    return await yahooFinance[task.method](task.ticker, options);
  }
}
