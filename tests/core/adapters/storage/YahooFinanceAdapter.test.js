import { describe, it, expect } from 'vitest';
import { YahooFinanceAdapter } from '../../../../src/core/adapters/storage/YahooFinanceAdapter.js';

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

  it('sollte error werfen wenn date object invalid ist (edge case)', () => {
    const task = { ticker: 'AAPL' };
    const data = [{ date: new Date('not-a-valid-date'), open: 150 }];
    expect(() => adapter.getInsertQueryAndValues(task, data)).toThrow('Invalid date');
  });

  it('sollte fundamentals in company_fundamentals einfügen', () => {
    const task = { ticker: 'ZETA', method: 'fundamentals' };
    const data = [{ 
      ticker: 'ZETA', 
      date: '2024-01-01',
      period: '3M',
      shareIssued: 210000000, 
      freeCashFlow: 50000,
      totalRevenue: 100000,
      netIncome: 20000,
      financingCashFlow: -10000,
      institutional_ownership: 0.81 
    }];
    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.query).toContain('INSERT INTO company_fundamentals');
    expect(result.values[0]).toEqual(['ZETA', '2024-01-01', '3M', 210000000, 50000, 100000, 20000, -10000, 0.81]);
  });
});
