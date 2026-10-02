import { FetchAdapterFactory } from './fetch/FetchAdapterFactory.js';
import { StorageAdapterFactory } from './storage/StorageAdapterFactory.js';

import { YahooFinanceFetchAdapter } from './fetch/YahooFinanceFetchAdapter.js';
import { CboeFetchAdapter } from './fetch/CboeFetchAdapter.js';
import { FinraFetchAdapter } from './fetch/FinraFetchAdapter.js';
import { SqueezeMetricsFetchAdapter } from './fetch/SqueezeMetricsFetchAdapter.js';
import { AaiiFetchAdapter } from './fetch/AaiiFetchAdapter.js';
import { NaaimFetchAdapter } from './fetch/NaaimFetchAdapter.js';
import { CalendarFetchAdapter } from './fetch/CalendarFetchAdapter.js';
import { SecEdgar13FFetchAdapter } from './fetch/SecEdgar13FFetchAdapter.js';
import { PolygonM5FetchAdapter } from './fetch/PolygonM5FetchAdapter.js';

import { BinanceAdapter } from './storage/BinanceAdapter.js';
import { TiingoAdapter } from './storage/TiingoAdapter.js';
import { FredAdapter } from './storage/FredAdapter.js';
import { FiscalDataAdapter } from './storage/FiscalDataAdapter.js';
import { YahooFinanceAdapter } from './storage/YahooFinanceAdapter.js';
import { SecEdgarAdapter } from './storage/SecEdgarAdapter.js';
import { CboeAdapter } from './storage/CboeAdapter.js';
import { FinraAdapter } from './storage/FinraAdapter.js';
import { SqueezeMetricsAdapter } from './storage/SqueezeMetricsAdapter.js';
import { SecEdgar13FAdapter } from './storage/SecEdgar13FAdapter.js';
import { AaiiAdapter } from './storage/AaiiAdapter.js';
import { NaaimAdapter } from './storage/NaaimAdapter.js';
import { CalendarStorageAdapter } from './storage/CalendarStorageAdapter.js';
import { M5StorageAdapter } from './storage/M5StorageAdapter.js';

export function bootstrapAdapters() {
  // Fetch
  FetchAdapterFactory.register('YahooFinance', new YahooFinanceFetchAdapter());
  FetchAdapterFactory.register('Cboe', new CboeFetchAdapter());
  FetchAdapterFactory.register('Finra', new FinraFetchAdapter());
  FetchAdapterFactory.register('SqueezeMetrics', new SqueezeMetricsFetchAdapter());
  FetchAdapterFactory.register('AAII', new AaiiFetchAdapter());
  FetchAdapterFactory.register('NAAIM', new NaaimFetchAdapter());
  FetchAdapterFactory.register('Calendar', new CalendarFetchAdapter());
  FetchAdapterFactory.register('SecEdgar13F', new SecEdgar13FFetchAdapter());
  FetchAdapterFactory.register('PolygonM5', new PolygonM5FetchAdapter());

  // Storage
  StorageAdapterFactory.register('Binance', new BinanceAdapter());
  StorageAdapterFactory.register('Tiingo', new TiingoAdapter());
  StorageAdapterFactory.register('FRED', new FredAdapter());
  StorageAdapterFactory.register('FiscalData', new FiscalDataAdapter());
  StorageAdapterFactory.register('YahooFinance', new YahooFinanceAdapter());
  StorageAdapterFactory.register('SecEdgar', new SecEdgarAdapter());
  StorageAdapterFactory.register('Cboe', new CboeAdapter());
  StorageAdapterFactory.register('Finra', new FinraAdapter());
  StorageAdapterFactory.register('SqueezeMetrics', new SqueezeMetricsAdapter());
  StorageAdapterFactory.register('SecEdgar13F', new SecEdgar13FAdapter());
  StorageAdapterFactory.register('AAII', new AaiiAdapter());
  StorageAdapterFactory.register('NAAIM', new NaaimAdapter());
  StorageAdapterFactory.register('Calendar', new CalendarStorageAdapter());
  StorageAdapterFactory.register('PolygonM5', new M5StorageAdapter());
}
