import { BinanceAdapter } from './BinanceAdapter.js';
import { TiingoAdapter } from './TiingoAdapter.js';
import { FredAdapter } from './FredAdapter.js';
import { FiscalDataAdapter } from './FiscalDataAdapter.js';
import { YahooFinanceAdapter } from './YahooFinanceAdapter.js';
import { SecEdgarAdapter } from './SecEdgarAdapter.js';
import { CboeAdapter } from './CboeAdapter.js';
import { FinraAdapter } from './FinraAdapter.js';

const adapters = {
  'Binance': new BinanceAdapter(),
  'Tiingo': new TiingoAdapter(),
  'FRED': new FredAdapter(),
  'FiscalData': new FiscalDataAdapter(),
  'YahooFinance': new YahooFinanceAdapter(),
  'SecEdgar': new SecEdgarAdapter(),
  'Cboe': new CboeAdapter(),
  'Finra': new FinraAdapter(),
};

export class StorageAdapterFactory {
  /**
   * Liefert den passenden Datenbank-Adapter für den gegebenen Provider.
   * Keine if/else Kette, reines Objekt-Mapping O(1).
   */
  static getAdapter(providerName) {
    const adapter = adapters[providerName];
    if (!adapter) {
      throw new Error(`No storage adapter found for provider: ${providerName}`);
    }
    return adapter;
  }
}
