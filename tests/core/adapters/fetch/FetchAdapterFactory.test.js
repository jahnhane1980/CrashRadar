import { describe, it, expect } from 'vitest';
import { FetchAdapterFactory } from '../../../../src/core/adapters/fetch/FetchAdapterFactory.js';
import { YahooFinanceFetchAdapter } from '../../../../src/core/adapters/fetch/YahooFinanceFetchAdapter.js';

describe('FetchAdapterFactory', () => {
  it('sollte den YahooFinanceFetchAdapter zurückgeben', () => {
    const adapter = FetchAdapterFactory.get('YahooFinance');
    expect(adapter).toBeInstanceOf(YahooFinanceFetchAdapter);
  });

  it('sollte einen Fehler werfen bei unbekanntem Provider', () => {
    expect(() => FetchAdapterFactory.get('Unknown')).toThrow('No fetch adapter found for provider: Unknown');
  });
});
