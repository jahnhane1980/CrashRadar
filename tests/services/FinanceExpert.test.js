import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('mysql2/promise', () => {
  return {
    default: {
      createPool: vi.fn()
    }
  };
});
import mysql from 'mysql2/promise';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';

describe('FinanceExpert', () => {
  let expert;
  let mockPool;
  let excludeWalcl = false;

  beforeEach(() => {
    excludeWalcl = false;
    process.env.DATABASE_URL = 'mysql://dummy';

    mockPool = {
      query: vi.fn().mockImplementation(async (sql, params) => {
        const s = sql.toLowerCase();
        
        // Mock für alle Forward-Fill (getLastBefore) Queries
        if (s.includes('limit 1')) {
          return [[]]; // Kein Initial-State vor 2025-01-01
        }

        // Mock für Bulk Queries
        if (s.includes('market_data_binance')) {
          return [[
            { date: '2025-01-01', close: 50000 },
            { date: '2025-01-02', close: 51000 },
            { date: '2025-01-03', close: 52000 }
          ]];
        }
        
        if (s.includes('market_data_tiingo')) {
          return [[
            { symbol: 'SPY', date: '2025-01-01', close: 500 },
            { symbol: 'QQQ', date: '2025-01-01', close: 400 },
            { symbol: 'TLT', date: '2025-01-01', close: 95 }
          ]];
        }

        if (s.includes('market_data_yahoo')) {
          return [[
            { symbol: 'DX-Y.NYB', date: '2025-01-01', close: 105.5 },
            { symbol: 'GC=F', date: '2025-01-01', close: 2000.5 },
            { symbol: 'HG=F', date: '2025-01-01', close: 4.5 }
          ]];
        }

        if (s.includes('econ_fred')) {
          const fredData = [
            { series_id: 'RRPONTSYD', date: '2025-01-01', value: 500 },
            { series_id: 'DFII10', date: '2025-01-01', value: 2.5 },
            { series_id: 'TOTRESNS', date: '2025-01-01', value: 3000 },
            { series_id: 'BORROW', date: '2025-01-01', value: 10 },
            { series_id: 'T10Y2Y', date: '2025-01-01', value: -0.5 },
            { series_id: 'NFCI', date: '2025-01-01', value: -0.2 },
            // Edge Case: string "null" from FRED
            { series_id: 'WALCL', date: '2025-01-03', value: 'null' }
          ];
          if (!excludeWalcl) {
            fredData.unshift({ series_id: 'WALCL', date: '2025-01-01', value: 7000000 });
          }
          return [fredData];
        }

        if (s.includes('fiscal_tga')) {
          return [[
            { date: '2025-01-01', open_balance: 800000, close_balance: '750000' },
            { date: '2025-01-02', open_balance: 760000, close_balance: 'null' },
            { date: '2025-01-03', open_balance: 'null', close_balance: 'null' }
          ]];
        }

        if (s.includes('macro_maturity_wall')) {
          return [[
            { date: '2025-01-01', maturing_90d_billions: 50.5 }
          ]];
        }

        if (s.includes('econ_challenger')) {
          return [[
            { date: '2025-01-01', Challenger: 45000 }
          ]];
        }

        return [[]];
      }),
      end: vi.fn()
    };

    mysql.createPool.mockReturnValue(mockPool);
    expert = new FinanceExpert();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sollte Daten korrekt gruppieren und Einheiten konvertieren', async () => {
    const data = await expert.getDailyGroupedData('2025-01-01');
    expect(data.length).toBe(3);

    const day1 = data[0];
    expect(day1.date).toBe('2025-01-01');
    expect(day1.assets.SPY).toBe(500);
    expect(day1.assets.QQQ).toBe(400);
    expect(day1.assets.TLT).toBe(95);
    expect(day1.assets.BTC).toBe(50000);
    expect(day1.assets.Gold).toBe(2000.5);
    expect(day1.assets.Copper).toBe(4.5);

    // WALCL(7000) - TGA(750) - RRP(500) = 5750
    expect(day1.macroGroups.NetLiquidity.NetLiquidity).toBe(5750);
    expect(day1.macroGroups.NetLiquidity.WALCL).toBe(7000);
    expect(day1.macroGroups.NetLiquidity.TGA).toBe(750);
    
    expect(day1.macroGroups.FinancialConditions.DXY).toBe(105.5);
    expect(day1.macroGroups.FinancialConditions.RealYield10y).toBe(2.5);
    expect(day1.macroGroups.FinancialConditions.ChicagoFedIndex).toBe(-0.2);
    expect(day1.macroGroups.BankingHealth.TotalReserves).toBe(3000);
    expect(day1.macroGroups.BankingHealth.EmergencyBorrowing).toBe(10);
    expect(day1.macroGroups.YieldCurve.Spread10y2y).toBe(-0.5);
    expect(day1.macroGroups.Leading.Challenger).toBe(45000);
  });

  it('sollte Lücken via Forward-Fill (LOCF) füllen', async () => {
    const data = await expert.getDailyGroupedData('2025-01-01');
    const day2 = data[1];

    expect(day2.date).toBe('2025-01-02');
    // BTC hat neue Daten
    expect(day2.assets.BTC).toBe(51000);
    
    // SPY hatte keine Daten an Tag 2, sollte vom Tag 1 übernommen werden
    expect(day2.assets.SPY).toBe(500);
    expect(day2.macroGroups.FinancialConditions.DXY).toBe(105.5);
  });

  it('sollte TGA Fallback auf open_balance machen wenn close_balance "null" ist', async () => {
    const data = await expert.getDailyGroupedData('2025-01-01');
    const day2 = data[1];

    // Am 2. Tag war close_balance 'null', open_balance war 760000 -> 760 Billions
    expect(day2.macroGroups.NetLiquidity.TGA).toBe(760);
    expect(day2.macroGroups.NetLiquidity.NetLiquidity).toBe(5740);
  });

  it('sollte leeres Array zurückgeben wenn keine Daten vorhanden sind', async () => {
    mockPool.query.mockResolvedValue([[]]); // Alles leer
    const data = await expert.getDailyGroupedData('2030-01-01');
    expect(data).toEqual([]);
  });
  
  it('sollte nicht crashen wenn WALCL oder TGA komplett fehlt', async () => {
      excludeWalcl = true;
      const data = await expert.getDailyGroupedData('2025-01-01');
      expect(data[0].macroGroups.NetLiquidity.WALCL).toBe(null);
      expect(data[0].macroGroups.NetLiquidity.NetLiquidity).toBe(null);
  });

  it('sollte einen Fehler werfen wenn kein startDate übergeben wird', async () => {
    await expect(expert.getDailyGroupedData()).rejects.toThrow(/startDate is required/);
  });

  it('sollte TGA korrekt handhaben, wenn open_balance und close_balance beide "null" sind', async () => {
    const data = await expert.getDailyGroupedData('2025-01-01');
    const day3 = data[2];
    expect(day3.date).toBe('2025-01-03');
    expect(day3.macroGroups.NetLiquidity.TGA).toBe(760);
  });

  it('sollte FRED "null" Strings korrekt verwerfen und via Forward-Fill alte Werte behalten', async () => {
    const data = await expert.getDailyGroupedData('2025-01-01');
    const day3 = data[2];
    expect(day3.macroGroups.NetLiquidity.WALCL).toBe(7000);
  });

  it('sollte Fehler werfen wenn keine DATABASE_URL vorhanden ist', () => {
    delete process.env.DATABASE_URL;
    expect(() => new FinanceExpert()).toThrow(/No database URL provided/i);
    process.env.DATABASE_URL = 'mysql://dummy';
  });

  it('sollte die DB-Verbindung sauber schließen', async () => {
    await expert.close();
    expect(mockPool.end).toHaveBeenCalled();
  });

  it('sollte init mit repository instanz akzeptieren', async () => {
    const mockRepo = { close: vi.fn() };
    const e = new FinanceExpert(mockRepo);
    expect(e.repo).toBe(mockRepo);
    await e.close();
    expect(mockRepo.close).toHaveBeenCalled();
  });

  it('sollte close() nicht crashen wenn repo null ist', async () => {
    const e = new FinanceExpert('mysql://dummy');
    e.repo = null;
    await expect(e.close()).resolves.not.toThrow();
  });
});
