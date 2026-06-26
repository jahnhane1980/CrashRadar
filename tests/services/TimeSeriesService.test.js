import { describe, it, expect } from 'vitest';
import { TimeSeriesService } from '../../src/services/TimeSeriesService.js';

describe('TimeSeriesService', () => {
  it('sollte eine Timeline aus Raw Data bauen', () => {
    const rawData = {
      btc: [{ date: '2023-01-01', close: 100 }],
      tiingo: [{ date: '2023-01-01', symbol: 'SPY', close: 200 }],
      yahoo: [],
      fred: [],
      tga: [],
      mw: []
    };

    const timeline = TimeSeriesService.buildTimeline(rawData);
    expect(timeline['2023-01-01']).toBeDefined();
    expect(timeline['2023-01-01'].BTC).toBe(100);
    expect(timeline['2023-01-01'].SPY).toBe(200);
  });
});
