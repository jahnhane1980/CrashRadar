import { describe, it, expect } from 'vitest';
import { FiscalDataAdapter } from '../../../src/core/adapters/FiscalDataAdapter.js';

describe('FiscalDataAdapter', () => {
  const adapter = new FiscalDataAdapter();

  it('should map fiscaldata_tga correctly and filter account types', () => {
    const task = { id: 'fiscaldata_tga' };
    const data = [
      { account_type: 'Federal Reserve Account', record_date: '2023-01-01', open_today_bal: '100', close_today_bal: '150' },
      { account_type: 'Some Other Account', record_date: '2023-01-02', open_today_bal: '200', close_today_bal: '250' }
    ];
    
    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.query).toContain('INSERT INTO fiscal_tga');
    expect(result.values).toHaveLength(1); // Only the Federal Reserve Account should be mapped
    expect(result.values[0]).toEqual(['2023-01-01', '100', '150']);
  });

  it('should map fiscaldata_auctions correctly', () => {
    const task = { id: 'fiscaldata_auctions' };
    const data = [
      { record_date: '2023-01-01', cusip: '123456', security_type: 'Bill', issue_date: '2023-01-02', maturity_date: '2023-04-02', total_accepted: '1000', high_yield: '4.5' }
    ];
    
    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.query).toContain('INSERT INTO fiscal_auctions');
    expect(result.values[0]).toEqual(['2023-01-01', '123456', 'Bill', '2023-01-02', '2023-04-02', '1000', '4.5']);
  });

  it('should return null query for unknown task id (edge case)', () => {
    const task = { id: 'fiscaldata_buybacks' };
    const result = adapter.getInsertQueryAndValues(task, []);
    expect(result.query).toBeNull();
    expect(result.values).toHaveLength(0);
  });
});
