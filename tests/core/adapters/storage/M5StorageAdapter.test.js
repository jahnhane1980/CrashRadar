import { describe, it, expect } from 'vitest';
import { M5StorageAdapter } from '../../../../src/core/adapters/storage/M5StorageAdapter.js';
import { StorageAdapterFactory } from '../../../../src/core/adapters/storage/StorageAdapterFactory.js';
import { bootstrapAdapters } from '../../../../src/core/adapters/bootstrap.js';

describe('M5StorageAdapter', () => {
  bootstrapAdapters();

  const adapter = new M5StorageAdapter();

  it('should return { query: null, values: [] } when data is empty, null or undefined', () => {
    const task = { ticker: 'SPY' };

    expect(adapter.getInsertQueryAndValues(task, null)).toEqual({ query: null, values: [] });
    expect(adapter.getInsertQueryAndValues(task, undefined)).toEqual({ query: null, values: [] });
    expect(adapter.getInsertQueryAndValues(task, [])).toEqual({ query: null, values: [] });
  });

  it('should generate correct SQL query and map rows correctly for valid candle data', () => {
    const task = { ticker: 'SPY' };
    const data = [
      { t: 1704067200000, o: 470.1, h: 470.9, l: 470.0, c: 470.5, v: 12345 },
      { t: 1704067500000, o: 470.5, h: 471.2, l: 470.4, c: 471.0, v: 54321 }
    ];

    const result = adapter.getInsertQueryAndValues(task, data);

    expect(result.query).toContain('INSERT INTO market_data_m5 (symbol, record_time, open, high, low, close, volume)');
    expect(result.query).toContain('VALUES ?');
    expect(result.query).toContain('ON DUPLICATE KEY UPDATE');
    expect(result.query).toContain(
      'open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), volume = VALUES(volume)'
    );

    expect(result.values).toHaveLength(2);
    expect(result.values[0]).toEqual([
      'SPY',
      '2024-01-01 00:00:00',
      470.1,
      470.9,
      470.0,
      470.5,
      12345
    ]);
    expect(result.values[1]).toEqual([
      'SPY',
      '2024-01-01 00:05:00',
      470.5,
      471.2,
      470.4,
      471.0,
      54321
    ]);
  });

  it('should default volume to 0 if item.v is missing, null, or falsy', () => {
    const task = { ticker: 'QQQ' };
    const data = [
      { t: 1704067200000, o: 400.0, h: 401.0, l: 399.5, c: 400.5 },
      { t: 1704067500000, o: 400.5, h: 401.5, l: 400.0, c: 401.0, v: null },
      { t: 1704067800000, o: 401.0, h: 402.0, l: 400.5, c: 401.5, v: 0 }
    ];

    const result = adapter.getInsertQueryAndValues(task, data);

    expect(result.values).toHaveLength(3);
    expect(result.values[0][6]).toBe(0);
    expect(result.values[1][6]).toBe(0);
    expect(result.values[2][6]).toBe(0);
  });

  it('should be registered in StorageAdapterFactory under key "PolygonM5"', () => {
    const factoryAdapter = StorageAdapterFactory.getAdapter('PolygonM5');
    expect(factoryAdapter).toBeInstanceOf(M5StorageAdapter);
  });
});
