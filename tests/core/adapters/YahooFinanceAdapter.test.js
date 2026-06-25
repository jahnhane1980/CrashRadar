import { describe, it, expect } from 'vitest';
import { YahooFinanceAdapter } from '../../../src/core/adapters/YahooFinanceAdapter.js';

describe('YahooFinanceAdapter', () => {
  const adapter = new YahooFinanceAdapter();

  it('should map string dates correctly', () => {
    const task = { ticker: 'AAPL' };
    const data = [{ date: '2023-01-01T00:00:00.000Z', open: 150, high: 155, low: 149, close: 154, volume: 1000 }];
    
    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.query).toContain('INSERT INTO market_data_yahoo');
    expect(result.values[0]).toEqual(['AAPL', '2023-01-01', 150, 155, 149, 154, 1000]);
  });

  it('should handle Date objects correctly', () => {
    const task = { ticker: 'AAPL' };
    const data = [{ date: new Date('2023-01-01T12:00:00.000Z'), open: 150, high: 155, low: 149, close: 154, volume: 1000 }];
    
    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.values[0][1]).toBeDefined(); 
  });

  it('should throw error if date is missing (edge case)', () => {
    const task = { ticker: 'AAPL' };
    const data = [{ open: 150 }];
    expect(() => adapter.getInsertQueryAndValues(task, data)).toThrow('Missing date');
  });

  it('should throw error if date object is invalid Date (edge case)', () => {
    const task = { ticker: 'AAPL' };
    const data = [{ date: new Date('not-a-valid-date'), open: 150 }];
    expect(() => adapter.getInsertQueryAndValues(task, data)).toThrow('Invalid date');
  });
});
