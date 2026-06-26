import { describe, it, expect } from 'vitest';
import { BinanceAdapter } from '../../../../src/core/adapters/storage/BinanceAdapter.js';

describe('BinanceAdapter', () => {
  const adapter = new BinanceAdapter();

  it('should generate correct query and values for happy path', () => {
    const task = { params: { symbol: 'BTCUSDT', interval: '1d' } };
    const data = [
      [1609459200000, '28923.63', '29600.00', '28624.57', '29331.69', '54030.68', 1609545599999, '1585860472.93', 1334651, '28409.08', '833989063.26', '0']
    ];

    const result = adapter.getInsertQueryAndValues(task, data);

    expect(result.query).toContain('INSERT INTO market_data_binance');
    expect(result.values).toHaveLength(1);
    expect(result.values[0]).toEqual([
      'BTCUSDT', '1d', 1609459200000, '28923.63', '29600.00', '28624.57', '29331.69', '54030.68', '1585860472.93', 1334651, '28409.08', 1609545599999
    ]);
  });

  it('should handle empty data array gracefully', () => {
    const task = { params: { symbol: 'BTCUSDT', interval: '1d' } };
    const data = [];
    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.values).toHaveLength(0);
  });

  it('should map undefined gracefully if params are missing in edge case', () => {
    const task = { params: {} };
    const data = [[1,2,3,4,5,6,7,8,9,10,11,12]];
    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.values[0][0]).toBeUndefined(); // symbol
    expect(result.values[0][1]).toBeUndefined(); // interval
  });
});
