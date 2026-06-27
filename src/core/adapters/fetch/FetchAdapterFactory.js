import { YahooFinanceFetchAdapter } from './YahooFinanceFetchAdapter.js';
import { CboeFetchAdapter } from './CboeFetchAdapter.js';
import { FinraFetchAdapter } from './FinraFetchAdapter.js';

const adapters = {
  'YahooFinance': new YahooFinanceFetchAdapter(),
  'Cboe': new CboeFetchAdapter(),
  'Finra': new FinraFetchAdapter(),
};

export class FetchAdapterFactory {
  static get(providerName) {
    const adapter = adapters[providerName];
    if (!adapter) {
      throw new Error(`No fetch adapter found for provider: ${providerName}`);
    }
    return adapter;
  }
}
