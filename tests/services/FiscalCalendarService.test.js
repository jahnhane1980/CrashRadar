import { describe, it, expect, vi } from 'vitest';
import { FiscalCalendarService } from '../../src/services/FiscalCalendarService.js';

describe('FiscalCalendarService', () => {
  it('should initialize with config fallback and calculate fiscal status', () => {
    const service = new FiscalCalendarService();
    const status = service.getFiscalStatus('2026-09-14');

    expect(status.date).toBe('2026-09-14');
    expect(status.isExtendedByContinuingResolution).toBe(true);
    expect(status.effectiveDeadline).toBe('2026-12-18');
    expect(status.daysUntilDeadline).toBeGreaterThan(90);
    expect(status.preElectionShieldActive).toBe(true);
  });

  it('should load events from DB pool and update fiscal years and milestones', async () => {
    const mockRows = [
      {
        id: 'cr_deadline_fy2027',
        category: 'FISCAL',
        subcategory: 'SHUTDOWN',
        title: 'Continuing Resolution Funding Deadline',
        event_date: '2026-12-18',
        event_time: '23:59 EDT',
        status: 'CONFIRMED',
        criticality: 'CRITICAL',
        metadata_json: JSON.stringify({
          statutoryDeadline: '2026-09-30',
          preElectionShieldActive: true
        }),
        source: 'CONGRESS_ENACTED_CR'
      },
      {
        id: 'qra_2026_q4',
        category: 'FISCAL',
        subcategory: 'QRA',
        title: 'Treasury QRA Q4 2026',
        event_date: '2026-11-04',
        event_time: '14:30 MESZ',
        status: 'CONFIRMED',
        criticality: 'HIGH',
        metadata_json: JSON.stringify({ targetRefundingQuarter: 'Q1 2027' }),
        source: 'TREASURY_QRA_SCHEDULE'
      }
    ];

    const mockPool = {
      query: vi.fn().mockResolvedValue([mockRows])
    };

    const service = new FiscalCalendarService(null, { pool: mockPool });
    await service.loadFromDb();

    const status = service.getFiscalStatus('2026-09-14');
    expect(status.effectiveDeadline).toBe('2026-12-18');
    expect(status.nextMilestone).toBeDefined();
    expect(status.nextMilestone.id).toBe('qra_2026_q4');
    expect(status.nextMilestone.date).toBe('2026-11-04');
  });

  it('should query upcoming events with category filter', async () => {
    const mockRows = [
      {
        id: 'fomc_2026_09_16',
        category: 'CENTRAL_BANK',
        subcategory: 'FOMC',
        title: 'FOMC Zinsentscheid',
        event_date: '2026-09-16',
        status: 'CONFIRMED',
        criticality: 'CRITICAL',
        metadata_json: '{}'
      }
    ];

    const mockPool = {
      query: vi.fn().mockResolvedValue([mockRows])
    };

    const service = new FiscalCalendarService(null, { pool: mockPool });
    const upcoming = await service.getUpcomingEvents('2026-09-14', { category: 'CENTRAL_BANK', limit: 1 });

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].id).toBe('fomc_2026_09_16');
    expect(upcoming[0].category).toBe('CENTRAL_BANK');
  });
});
