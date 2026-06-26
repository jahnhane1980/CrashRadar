import { describe, it, expect } from 'vitest';
import { SecEdgarAdapter } from '../../../../src/core/adapters/storage/SecEdgarAdapter.js';

describe('SecEdgarAdapter', () => {
  it('sollte leere query und values zurückgeben wenn keine Daten vorhanden', () => {
    const adapter = new SecEdgarAdapter();
    const result1 = adapter.getInsertQueryAndValues({ ticker: 'ARCC' }, null);
    expect(result1.query).toBeNull();
    
    const result2 = adapter.getInsertQueryAndValues({ ticker: 'ARCC' }, []);
    expect(result2.query).toBeNull();
    
    const result3 = adapter.getInsertQueryAndValues({ ticker: 'ARCC' }, [{ facts: {} }]);
    expect(result3.query).toBeNull();
  });

  it('sollte valide INSERT SQL für SEC EDGAR Facts generieren', () => {
    const adapter = new SecEdgarAdapter();
    
    const mockData = [{
      cik: 12345,
      facts: {
        'us-gaap': {
          'InterestExpense': {
            units: {
              'USD': [
                { end: '2025-03-31', val: 186000000, form: '10-Q' },
                { end: '2025-06-30', val: 188000000, form: '10-Q' }
              ]
            }
          },
          'Assets': {
            units: {
              'USD': [
                { end: '2025-03-31', val: 2000000000, form: '10-Q' }
              ]
            }
          }
        }
      }
    }];

    const { query, values } = adapter.getInsertQueryAndValues({ ticker: 'ARCC' }, mockData);
    
    expect(query).toContain('INSERT INTO fund_sec_edgar');
    expect(query).toContain('ON DUPLICATE KEY UPDATE');
    
    // Es gibt 2 unterschiedliche End-Daten (2025-03-31 und 2025-06-30)
    expect(values.length).toBe(2);
    
    // 2025-03-31 hat InterestExpense und Assets
    const march = values.find(v => v[1] === '2025-03-31');
    expect(march[0]).toBe('ARCC');
    expect(march[2]).toBe(186000000); // interest
    expect(march[3]).toBe(2000000000); // assets
    expect(march[4]).toBeNull(); // net_income
    
    // 2025-06-30 hat nur InterestExpense
    const june = values.find(v => v[1] === '2025-06-30');
    expect(june[2]).toBe(188000000);
    expect(june[3]).toBeNull();
  });
});
