import { describe, it, expect } from 'vitest';
import { TimeSeriesService } from '../../src/services/TimeSeriesService.js';
import { SYMBOLS, FRED_SERIES } from '../../src/core/repositories/AnalysisRepository.js';

describe('TimeSeriesService', () => {
  it('sollte eine Timeline aus Raw Data bauen und alle Edge-Cases abdecken', () => {
    const rawData = {
      btc: [
        { date: '2023-01-01', close: 100, volume: 50, high: 110, low: 90 },
        { date: new Date('2023-01-02'), close: 105, volume: null }, // Date Objekt
        { date: 'Sun Jan 03 2023 00:00:00 GMT+0000', close: 110 } // GMT Date String
      ],
      tiingo: [
        { date: '2023-01-01', symbol: 'SPY', close: 200, volume: 1000 },
        { date: '2023-01-02', symbol: 'QQQ', close: 300, volume: null }
      ],
      yahoo: [
        { date: '2023-01-01', symbol: SYMBOLS.DXY, close: 104 },
        { date: '2023-01-01', symbol: SYMBOLS.GOLD, close: 2000, volume: 500 },
        { date: '2023-01-01', symbol: SYMBOLS.COPPER, close: 4 },
        { date: '2023-01-01', symbol: SYMBOLS.VIX, close: 15 },
        { date: '2023-01-01', symbol: SYMBOLS.HYG, close: 75 },
        { date: '2023-01-01', symbol: SYMBOLS.BIZD, close: 15 },
        { date: '2023-01-01', symbol: SYMBOLS.BKLN, close: 21 },
        { date: '2023-01-01', symbol: SYMBOLS.SKEW, close: 130 }
      ],
      fred: [
        { date: '2023-01-01', series_id: FRED_SERIES.WALCL, value: 8000000 }, // Sollte durch 1000 geteilt werden
        { date: '2023-01-01', series_id: 'OTHER', value: 'null' },
        { date: '2023-01-01', series_id: FRED_SERIES.DFF, value: 5.25 }
      ],
      tga: [
        { date: '2023-01-01', close_balance: 500000 }, // / 1000
        { date: '2023-01-02', close_balance: 'null', open_balance: 600000 }
      ],
      mw: [
        { date: '2023-01-01', maturing_90d_billions: 2000 },
        { date: '2023-01-02', maturing_90d_billions: null }
      ],
      sec: [
        { date: '2023-01-01', ticker: 'ARCC', interest_expense: 500, total_assets: 1000, net_income: 100 },
        { date: '2023-01-02', ticker: 'ARCC', interest_expense: null, total_assets: null, net_income: null }
      ],
      cboe: [{ date: '2023-01-01', volume: 1500000 }],
      finra: [{ date: '2023-01-01', MarginDebt: 700000 }],
      shortVolume: [{ date: '2023-01-01', short_volume_ratio: 45.5 }],
      pcr: [{ date: '2023-01-01', total_pcr: 0.8 }]
    };

    const timeline = TimeSeriesService.buildTimeline(rawData);
    
    // Test 2023-01-01
    expect(timeline['2023-01-01']).toBeDefined();
    expect(timeline['2023-01-01'].BTC).toBe(100);
    expect(timeline['2023-01-01'].BTC_Volume).toBe(50);
    expect(timeline['2023-01-01'].BTC_High).toBe(110);
    expect(timeline['2023-01-01'].BTC_Low).toBe(90);
    expect(timeline['2023-01-01'].SPY).toBe(200);
    expect(timeline['2023-01-01'].SPY_Volume).toBe(1000);
    expect(timeline['2023-01-01'].DXY).toBe(104);
    expect(timeline['2023-01-01'].Gold).toBe(2000);
    expect(timeline['2023-01-01'].Gold_Volume).toBe(500);
    expect(timeline['2023-01-01'].Copper).toBe(4);
    expect(timeline['2023-01-01'].VIX).toBe(15);
    expect(timeline['2023-01-01'].HYG).toBe(75);
    expect(timeline['2023-01-01'].BIZD).toBe(15);
    expect(timeline['2023-01-01'].BKLN).toBe(21);
    expect(timeline['2023-01-01'].SKEW).toBe(130);
    expect(timeline['2023-01-01'][FRED_SERIES.WALCL]).toBe(8000); // 8000000 / 1000
    expect(timeline['2023-01-01'][FRED_SERIES.DFF]).toBe(5.25);
    expect(timeline['2023-01-01'].TGA).toBe(500); // 500000 / 1000
    expect(timeline['2023-01-01'].MaturityWall90d).toBe(2000);
    expect(timeline['2023-01-01'].ARCC_InterestExpense).toBe(500);
    expect(timeline['2023-01-01'].ARCC_TotalAssets).toBe(1000);
    expect(timeline['2023-01-01'].ARCC_NetIncome).toBe(100);
    expect(timeline['2023-01-01'].CBOE_SPY).toBe(1500000);
    expect(timeline['2023-01-01'].MarginDebt).toBe(700000);
    expect(timeline['2023-01-01'].SPY_ShortVolumeRatio).toBe(45.5);
    expect(timeline['2023-01-01'].TotalPCR).toBe(0.8);
    expect(timeline['2023-01-01'].OTHER).toBeUndefined(); // 'null' string is ignored

    // Test Date parsing (Date Object)
    expect(timeline['2023-01-02']).toBeDefined();
    expect(timeline['2023-01-02'].BTC).toBe(105);
    expect(timeline['2023-01-02'].BTC_Volume).toBeUndefined();
    expect(timeline['2023-01-02'].QQQ).toBe(300);
    expect(timeline['2023-01-02'].QQQ_Volume).toBeUndefined();
    expect(timeline['2023-01-02'].TGA).toBe(600); // Fallback to open_balance

    // Test GMT String parsing
    expect(timeline['2023-01-03']).toBeDefined();
    expect(timeline['2023-01-03'].BTC).toBe(110);
  });
});
