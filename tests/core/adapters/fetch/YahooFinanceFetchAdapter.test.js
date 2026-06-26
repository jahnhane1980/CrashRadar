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
});
