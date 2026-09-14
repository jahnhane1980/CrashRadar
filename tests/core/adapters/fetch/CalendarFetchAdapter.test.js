import { describe, it, expect, vi } from 'vitest';
import { CalendarFetchAdapter } from '../../../../src/core/adapters/fetch/CalendarFetchAdapter.js';
import { FetchAdapterFactory } from '../../../../src/core/adapters/fetch/FetchAdapterFactory.js';

describe('CalendarFetchAdapter', () => {
  it('should be registered in FetchAdapterFactory', () => {
    const adapter = FetchAdapterFactory.get('Calendar');
    expect(adapter).toBeInstanceOf(CalendarFetchAdapter);
  });

  it('should calculate the first Wednesday of months deterministically', () => {
    // 2026:
    // Feb 1 is Sunday -> First Wed is Feb 4
    expect(CalendarFetchAdapter.getFirstWednesdayOfMonth(2026, 1)).toBe('2026-02-04');
    // May 1 is Friday -> First Wed is May 6
    expect(CalendarFetchAdapter.getFirstWednesdayOfMonth(2026, 4)).toBe('2026-05-06');
    // Aug 1 is Saturday -> First Wed is Aug 5
    expect(CalendarFetchAdapter.getFirstWednesdayOfMonth(2026, 7)).toBe('2026-08-05');
    // Nov 1 is Sunday -> First Wed is Nov 4
    expect(CalendarFetchAdapter.getFirstWednesdayOfMonth(2026, 10)).toBe('2026-11-04');
  });

  it('should generate QRA events for a given year with correct quarters', () => {
    const events = CalendarFetchAdapter.generateQraEventsForYear(2026, '2026-09-14');
    expect(events).toHaveLength(4);
    expect(events[0].id).toBe('qra_2026_q1');
    expect(events[0].status).toBe('COMPLETED');
    expect(events[3].id).toBe('qra_2026_q4');
    expect(events[3].event_date).toBe('2026-11-04');
    expect(events[3].status).toBe('CONFIRMED');
  });

  it('should fetch and calculate debt ceiling headroom and events from mock API', async () => {
    const adapter = new CalendarFetchAdapter();
    const mockRequestManager = {
      fetch: vi.fn().mockImplementation(async (url) => {
        if (url.includes('debt_subject_to_limit')) {
          return {
            data: [
              { record_date: '2026-09-10', debt_catg: 'Statutory Debt Limit', close_today_bal: '41103996' },
              { record_date: '2026-09-10', debt_catg: 'Debt Held by the Public', close_today_bal: '32363418' },
              { record_date: '2026-09-10', debt_catg: 'Intragovernmental Holdings', close_today_bal: '7684309' }
            ]
          };
        }
        if (url.includes('operating_cash_balance')) {
          return {
            data: [
              { record_date: '2026-09-10', open_today_bal: '843705' }
            ]
          };
        }
        return { data: [] };
      })
    };

    const task = { id: 'macro_calendar_events', provider: 'Calendar' };
    const events = await adapter.fetch(task, { type: 'package' }, '2026-01-01', mockRequestManager);

    expect(events.length).toBeGreaterThan(10);
    const debtStatus = events.find(e => e.subcategory === 'DEBT_CEILING' && e.status === 'CONFIRMED');
    expect(debtStatus).toBeDefined();
    expect(debtStatus.metadata_json.headroomBillion).toBe(1056);

    const crEvent = events.find(e => e.id === 'cr_deadline_fy2027');
    expect(crEvent).toBeDefined();
    expect(crEvent.event_date).toBe('2026-12-18');
    expect(crEvent.status).toBe('CONFIRMED');

    const statutoryEvent = events.find(e => e.id === 'statutory_deadline_fy2027');
    expect(statutoryEvent).toBeDefined();
    expect(statutoryEvent.status).toBe('EXTENDED');
  });

  it('should calculate target observation dates for BLS & BEA cycles correctly', () => {
    // NFP Oct 2026 reports Sep 2026
    expect(CalendarFetchAdapter.calculateTargetObservationDate('2026-10-02', 1)).toBe('2026-09-01');
    // JOLTS Sep 2026 reports Jul 2026 (2 months lookback)
    expect(CalendarFetchAdapter.calculateTargetObservationDate('2026-09-01', 2)).toBe('2026-07-01');
    // NFP Jan 2027 reports Dec 2026 (year rollover)
    expect(CalendarFetchAdapter.calculateTargetObservationDate('2027-01-08', 1)).toBe('2026-12-01');
  });

  it('should provide 5 major macro release configurations', () => {
    const configs = CalendarFetchAdapter.getMacroReleaseConfigs();
    expect(configs).toHaveLength(5);
    const codes = configs.map(c => c.eventCode);
    expect(codes).toContain('PAYEMS');
    expect(codes).toContain('CPI_CORE');
    expect(codes).toContain('PCE_CORE');
    expect(codes).toContain('PPI');
    expect(codes).toContain('JTSJOL');
  });
});
