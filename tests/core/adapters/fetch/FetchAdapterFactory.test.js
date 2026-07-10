import { describe, it, expect } from 'vitest';
import { FetchAdapterFactory } from '../../../../src/core/adapters/fetch/FetchAdapterFactory.js';
import { YahooFinanceFetchAdapter } from '../../../../src/core/adapters/fetch/YahooFinanceFetchAdapter.js';
import { CboeFetchAdapter } from '../../../../src/core/adapters/fetch/CboeFetchAdapter.js';
import { FinraFetchAdapter } from '../../../../src/core/adapters/fetch/FinraFetchAdapter.js';
import { InvestingComFetchAdapter } from '../../../../src/core/adapters/fetch/InvestingComFetchAdapter.js';

describe('FetchAdapterFactory', () => {
  it('sollte den passenden Adapter für bekannte Provider zurückgeben', () => {
    expect(FetchAdapterFactory.get('YahooFinance')).toBeInstanceOf(YahooFinanceFetchAdapter);
    expect(FetchAdapterFactory.get('Cboe')).toBeInstanceOf(CboeFetchAdapter);
    expect(FetchAdapterFactory.get('Finra')).toBeInstanceOf(FinraFetchAdapter);
    expect(FetchAdapterFactory.get('InvestingCom')).toBeInstanceOf(InvestingComFetchAdapter);
  });

  it('sollte einen Fehler werfen bei unbekanntem Provider', () => {
    expect(() => FetchAdapterFactory.get('Unknown')).toThrow('No fetch adapter found for provider: Unknown');
  });
});
