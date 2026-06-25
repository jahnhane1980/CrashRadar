import { describe, it, expect } from 'vitest';
import { FredAdapter } from '../../../src/core/adapters/FredAdapter.js';

describe('FredAdapter', () => {
  const adapter = new FredAdapter();

  it('should map data correctly', () => {
    const task = { id: 'f1', params: { series_id: 'WALCL' } };
    const data = [{ date: '2023-01-01', value: '12345.6' }];
    
    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.query).toContain('INSERT INTO econ_fred');
    expect(result.values[0]).toEqual(['WALCL', '2023-01-01', '12345.6']);
  });

  it('should map "." to null gracefully (edge case)', () => {
    const task = { id: 'f1', params: { series_id: 'WALCL' } };
    const data = [{ date: '2023-01-02', value: '.' }];
    
    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.values[0][2]).toBeNull();
  });

  it('should throw error if series_id is missing (edge case)', () => {
    const task = { id: 'f2', params: {} };
    expect(() => adapter.getInsertQueryAndValues(task, [])).toThrow('Missing series_id');
  });
});
