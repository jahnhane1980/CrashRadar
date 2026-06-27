import { describe, it, expect } from 'vitest';
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
});
