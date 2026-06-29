import { describe, it, expect, beforeEach } from 'vitest';
import { FinraAdapter } from '../../../../src/core/adapters/storage/FinraAdapter.js';

describe('FinraAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new FinraAdapter();
  });

  it('should generate correct SQL query and values for Finra Margin Debt data', () => {
    const task = { id: 'finra_margin_debt' };
    const data = [
      { record_date: '2025-10-01', margin_debt: 1183654, free_credit_cash: null, free_credit_margin: null },
      { record_date: '2025-11-01', margin_debt: 1214321, free_credit_cash: null, free_credit_margin: null }
    ];

    const result = adapter.getInsertQueryAndValues(task, data);

    expect(result.query).toContain('INSERT INTO macro_margin_debt (record_date, margin_debt, free_credit_cash, free_credit_margin)');
    expect(result.query).toContain('ON DUPLICATE KEY UPDATE');
    expect(result.query).toContain('margin_debt = VALUES(margin_debt)');
    
    expect(result.values).toHaveLength(2);
    expect(result.values[0]).toEqual(['2025-10-01', 1183654, null, null]);
    expect(result.values[1]).toEqual(['2025-11-01', 1214321, null, null]);
  });

  it('should return null if data is empty', () => {
    const result = adapter.getInsertQueryAndValues({ id: 'finra' }, []);
    expect(result).toBeNull();
    const result2 = adapter.getInsertQueryAndValues({ id: 'finra' }, null);
    expect(result2).toBeNull();
  });

  it('should generate correct SQL query and values for short_volume data', () => {
    const task = { dataset: 'short_volume' };
    const data = [
      { symbol: 'QQQ', record_date: '2025-01-01', short_volume: 100, total_volume: 500, short_volume_ratio: 0.2 }
    ];
    
    const result = adapter.getInsertQueryAndValues(task, data);
    
    expect(result.query).toContain('INSERT INTO market_data_short_volume');
    expect(result.values).toHaveLength(1);
    expect(result.values[0]).toEqual(['QQQ', '2025-01-01', 100, 500, 0.2]);
  });
});
