import { describe, it, expect, vi } from 'vitest';
import { YahooFinanceFetchAdapter } from '../../../../src/core/adapters/fetch/YahooFinanceFetchAdapter.js';

// Mock yahoo-finance2
vi.mock('yahoo-finance2', () => {
  return {
    default: class MockYahooFinance {
      chart = vi.fn().mockResolvedValue([{ date: '2023-01-01', close: 100 }])
    }
  };
});

describe('YahooFinanceFetchAdapter', () => {
  it('sollte Daten von YahooFinance abrufen', async () => {
    const adapter = new YahooFinanceFetchAdapter();
    const task = { method: 'chart', ticker: 'AAPL', options: {} };
    const provider = { pagination: { startParam: 'period1' } };
    
    const result = await adapter.fetch(task, provider, '2023-01-01');
    expect(result).toBeDefined();
    expect(result[0].close).toBe(100);
  });

  it('sollte ein leeres Array zurückgeben, wenn startValue (String) in der Zukunft liegt', async () => {
    const adapter = new YahooFinanceFetchAdapter();
    const task = { method: 'chart', ticker: 'AAPL', options: {} };
    const provider = { pagination: { startParam: 'period1' } };
    
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 2);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    const result = await adapter.fetch(task, provider, futureDateStr);
    expect(result).toEqual([]);
  });

  it('sollte ein leeres Array zurückgeben, wenn startValue (Unix MS) in der Zukunft liegt', async () => {
    const adapter = new YahooFinanceFetchAdapter();
    const task = { method: 'chart', ticker: 'AAPL', options: {} };
    const provider = { pagination: { startParam: 'period1' } };
    
    const futureDateMs = Date.now() + 86400000 * 2; // 2 days in the future
    
    const result = await adapter.fetch(task, provider, futureDateMs);
    expect(result).toEqual([]);
  });
});
