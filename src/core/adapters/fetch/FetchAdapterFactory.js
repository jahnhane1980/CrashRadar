import { YahooFinanceFetchAdapter } from './YahooFinanceFetchAdapter.js';
import { CboeFetchAdapter } from './CboeFetchAdapter.js';
import { FinraFetchAdapter } from './FinraFetchAdapter.js';
import { SqueezeMetricsFetchAdapter } from './SqueezeMetricsFetchAdapter.js';

import { AaiiFetchAdapter } from './AaiiFetchAdapter.js';
import { NaaimFetchAdapter } from './NaaimFetchAdapter.js';
import { CalendarFetchAdapter } from './CalendarFetchAdapter.js';
import { SecEdgar13FFetchAdapter } from './SecEdgar13FFetchAdapter.js';
import { PolygonM5FetchAdapter } from './PolygonM5FetchAdapter.js';

const adapters = {
  'YahooFinance': new YahooFinanceFetchAdapter(),
  'Cboe': new CboeFetchAdapter(),
  'Finra': new FinraFetchAdapter(),
  'SqueezeMetrics': new SqueezeMetricsFetchAdapter(),

  'AAII': new AaiiFetchAdapter(),
  'NAAIM': new NaaimFetchAdapter(),
  'Calendar': new CalendarFetchAdapter(),
  'SecEdgar13F': new SecEdgar13FFetchAdapter(),
  'PolygonM5': new PolygonM5FetchAdapter(),
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
