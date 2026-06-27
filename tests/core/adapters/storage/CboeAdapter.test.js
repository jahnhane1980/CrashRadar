import { describe, it, expect } from 'vitest';
import { CboeAdapter } from '../../../../src/core/adapters/storage/CboeAdapter.js';

describe('CboeAdapter', () => {
  const adapter = new CboeAdapter();

  it('sollte korrekte INSERT Query und Werte für valides Array erzeugen (Happy Path)', () => {
    const task = { id: 'cboe_spy', ticker: 'SPY' };
    const data = [
      { record_date: '2026-06-01', volume: 1000 },
      { record_date: '2026-06-02', volume: 2000 }
    ];

    const result = adapter.getInsertQueryAndValues(task, data);

    expect(result.query).toContain('INSERT INTO market_data_cboe');
    expect(result.query).toContain('ON DUPLICATE KEY UPDATE');
    expect(result.values).toHaveLength(2);
    expect(result.values[0]).toEqual(['SPY', '2026-06-01', 1000]);
    expect(result.values[1]).toEqual(['SPY', '2026-06-02', 2000]);
  });

  it('sollte Fehler werfen, wenn der Ticker im Task fehlt (Fehlerfall)', () => {
    const task = { id: 'cboe_broken' }; // no ticker
    const data = [{ record_date: '2026-06-01', volume: 1000 }];

    expect(() => {
      adapter.getInsertQueryAndValues(task, data);
    }).toThrow(/Invalid or missing ticker/);
  });
});
