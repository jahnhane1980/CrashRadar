import { describe, it, expect } from 'vitest';
import { StorageAdapterFactory } from '../../../../src/core/adapters/storage/StorageAdapterFactory.js';
import { BinanceAdapter } from '../../../../src/core/adapters/storage/BinanceAdapter.js';
import { TiingoAdapter } from '../../../../src/core/adapters/storage/TiingoAdapter.js';

describe('StorageAdapterFactory', () => {
  it('should return correct adapter for existing providers', () => {
    expect(StorageAdapterFactory.getAdapter('Binance')).toBeInstanceOf(BinanceAdapter);
    expect(StorageAdapterFactory.getAdapter('Tiingo')).toBeInstanceOf(TiingoAdapter);
    expect(StorageAdapterFactory.getAdapter('FRED')).toBeDefined();
    expect(StorageAdapterFactory.getAdapter('FiscalData')).toBeDefined();
    expect(StorageAdapterFactory.getAdapter('YahooFinance')).toBeDefined();
    expect(StorageAdapterFactory.getAdapter('SecEdgar')).toBeDefined();
    expect(StorageAdapterFactory.getAdapter('Cboe')).toBeDefined();
  });

  it('should throw error for unknown provider (edge case)', () => {
    expect(() => StorageAdapterFactory.getAdapter('UnknownProvider')).toThrow('No storage adapter found for provider: UnknownProvider');
  });
});
