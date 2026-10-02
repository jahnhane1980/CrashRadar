import { describe, it, expect, beforeAll } from 'vitest';
import { FetchAdapterFactory } from '../../../../src/core/adapters/fetch/FetchAdapterFactory.js';
import { YahooFinanceFetchAdapter } from '../../../../src/core/adapters/fetch/YahooFinanceFetchAdapter.js';
import { CboeFetchAdapter } from '../../../../src/core/adapters/fetch/CboeFetchAdapter.js';
import { FinraFetchAdapter } from '../../../../src/core/adapters/fetch/FinraFetchAdapter.js';
import { SecEdgar13FFetchAdapter } from '../../../../src/core/adapters/fetch/SecEdgar13FFetchAdapter.js';
import { PolygonM5FetchAdapter } from '../../../../src/core/adapters/fetch/PolygonM5FetchAdapter.js';
import { bootstrapAdapters } from '../../../../src/core/adapters/bootstrap.js';

describe('FetchAdapterFactory', () => {
  beforeAll(() => {
    bootstrapAdapters();
  });

  it('sollte den passenden Adapter fuer bekannte Provider zurueckgeben', () => {
    expect(FetchAdapterFactory.getAdapter('YahooFinance')).toBeInstanceOf(YahooFinanceFetchAdapter);
    expect(FetchAdapterFactory.getAdapter('Cboe')).toBeInstanceOf(CboeFetchAdapter);
    expect(FetchAdapterFactory.getAdapter('Finra')).toBeInstanceOf(FinraFetchAdapter);
    expect(FetchAdapterFactory.getAdapter('SecEdgar13F')).toBeInstanceOf(SecEdgar13FFetchAdapter);
    expect(FetchAdapterFactory.getAdapter('PolygonM5')).toBeInstanceOf(PolygonM5FetchAdapter);
  });

  it('sollte einen Fehler werfen bei unbekanntem Provider', () => {
    expect(() => FetchAdapterFactory.getAdapter('Unknown')).toThrow('No fetch adapter found for provider: Unknown');
  });
});
