import { describe, it, expect } from 'vitest';
import { TiingoAdapter } from '../../../src/core/adapters/TiingoAdapter.js';

describe('TiingoAdapter', () => {
  const adapter = new TiingoAdapter();

  it('should map data correctly with default resolution', () => {
    const task = { id: 't1', ticker: 'SPY' };
    const data = [{ date: '2023-01-01T00:00:00.000Z', open: 100, high: 105, low: 95, close: 102, volume: 1000 }];
    
    const result = adapter.getInsertQueryAndValues(task, data);
    
    expect(result.query).toContain('INSERT INTO market_data_tiingo');
    expect(result.values[0]).toEqual(['SPY', '2023-01-01', 'daily', 100, 105, 95, 102, 1000]);
  });

  it('should extract explicit resolution from dbKey', () => {
    const task = { id: 't1', ticker: 'QQQ', resolution: 'weekly' };
    const data = [{ date: '2023-01-01T00:00:00.000Z', open: 100, high: 105, low: 95, close: 102, volume: 1000 }];
    
    const result = adapter.getInsertQueryAndValues(task, data);
    
    expect(result.values[0][0]).toBe('QQQ');
    expect(result.values[0][2]).toBe('weekly');
  });

  it('should throw error if ticker is missing (edge case)', () => {
    const task = { id: 't2' };
    expect(() => adapter.getInsertQueryAndValues(task, [])).toThrow('Invalid or missing ticker');
  });

  it('should throw error if ticker is non-string (edge case)', () => {
    const task = { id: 't3', ticker: 123 };
    expect(() => adapter.getInsertQueryAndValues(task, [])).toThrow('Invalid or missing ticker');
  });
});
