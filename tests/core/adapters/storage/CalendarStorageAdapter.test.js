import { describe, it, expect } from 'vitest';
import { CalendarStorageAdapter } from '../../../../src/core/adapters/storage/CalendarStorageAdapter.js';
import { StorageAdapterFactory } from '../../../../src/core/adapters/storage/StorageAdapterFactory.js';

describe('CalendarStorageAdapter', () => {
  const adapter = new CalendarStorageAdapter();

  it('should be registered in StorageAdapterFactory', () => {
    const factoryAdapter = StorageAdapterFactory.getAdapter('Calendar');
    expect(factoryAdapter).toBeInstanceOf(CalendarStorageAdapter);
  });

  it('should map calendar items to SQL insert values correctly', () => {
    const task = { id: 'macro_calendar_events', provider: 'Calendar' };
    const data = [
      {
        id: 'qra_2026_q4',
        category: 'FISCAL',
        subcategory: 'QRA',
        title: 'Treasury Quarterly Refunding Announcement',
        event_date: '2026-11-04',
        event_time: '14:30 MESZ',
        status: 'CONFIRMED',
        criticality: 'HIGH',
        metadata_json: { quarter: 'Q4' },
        actual_value: '2.45',
        details_json: { pass: true },
        source: 'TREASURY_QRA_SCHEDULE'
      }
    ];

    const result = adapter.getInsertQueryAndValues(task, data);
    expect(result.query).toContain('INSERT INTO macro_calendar_events');
    expect(result.query).toContain('ON DUPLICATE KEY UPDATE');
    expect(result.values).toHaveLength(1);
    expect(result.values[0][0]).toBe('qra_2026_q4');
    expect(result.values[0][1]).toBe('FISCAL');
    expect(result.values[0][2]).toBe('QRA');
    expect(result.values[0][4]).toBe('2026-11-04');
    expect(result.values[0][8]).toBe(JSON.stringify({ quarter: 'Q4' }));
    expect(result.values[0][9]).toBe('2.45');
    expect(result.values[0][10]).toBe(JSON.stringify({ pass: true }));
  });

  it('should handle empty data gracefully', () => {
    const result = adapter.getInsertQueryAndValues({ id: 'macro_calendar_events' }, []);
    expect(result.query).toBeNull();
    expect(result.values).toEqual([]);
  });
});
