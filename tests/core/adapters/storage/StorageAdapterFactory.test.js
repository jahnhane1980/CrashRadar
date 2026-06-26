import { describe, it, expect } from 'vitest';
import { StorageAdapterFactory } from '../../../../src/core/adapters/storage/StorageAdapterFactory.js';
import { BinanceAdapter } from '../../../../src/core/adapters/storage/BinanceAdapter.js';
import { TiingoAdapter } from '../../../../src/core/adapters/storage/TiingoAdapter.js';

describe('StorageAdapterFactory', () => {
  it('should return correct adapter for existing providers', () => {
    const binanceAdapter = StorageAdapterFactory.getAdapter('Binance');
    expect(binanceAdapter).toBeInstanceOf(BinanceAdapter);

    const tiingoAdapter = StorageAdapterFactory.getAdapter('Tiingo');
    expect(tiingoAdapter).toBeInstanceOf(TiingoAdapter);
  });

  it('should throw error for unknown provider (edge case)', () => {
    expect(() => StorageAdapterFactory.getAdapter('UnknownProvider')).toThrow('No storage adapter found for provider: UnknownProvider');
  });
});
