import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IndicatorEngine } from '../../src/analysis/IndicatorEngine.js';
import { Logger } from '../../src/core/Logger.js';

describe('IndicatorEngine V2 (New Architecture)', () => {
  let engine;

  beforeEach(() => {
    engine = new IndicatorEngine();
  });

  const createFakeData = () => {
    return {
        '2026-07-09': {
            date: '2026-07-09',
            assets: {
                VIX: 50,
                SPY_Volume: 200000000,
                GDX: 15,
                GDX_Volume: 50000000,
                SMH: 250,
                IGV: 300
            },
            macroGroups: {
                NetLiquidity: { TGA: 500 },
                BankingHealth: { TotalReserves: 3000 },
                Leading: { MaturityWallPct: 15, MarginDebt: 900000 },
                YieldCurve: { Spread10y2y: 0.5 },
                FinancialConditions: { ChicagoFedIndex: -0.5 }
            },
            mlRegimeSpy: { phase: 'BEAR_MARKET', confidence: 0.9 }
        }
    };
  };

  it('sollte run() ohne Absturz für die CLI ausführen (Terminal Output)', () => {
    const data = createFakeData();
    let output = '';
    const loggerSpy = vi.spyOn(Logger, 'info').mockImplementation((msg) => { output += msg + '\n'; });
    
    expect(() => engine.run(data)).not.toThrow();
    
    loggerSpy.mockRestore();
    expect(output).toContain('MAKRO-FINANZ ANALYSE');
    expect(output).toContain('MAKRO-REGIME');
    expect(output).toContain('TRADE ACTIONS');
  });

  it('sollte einen Fehler werfen, wenn run() leere Daten erhält', () => {
    expect(() => engine.run({})).toThrow(/Keine Daten für die Analyse/);
    expect(() => engine.run(null)).toThrow(/Keine Daten für die Analyse/);
  });
  
  it('sollte einen sauberen Report für den NotificationManager generieren', () => {
    const data = createFakeData();
    const report = engine.generateReport(data, true); // cleanText = true
    
    expect(report).toContain('MAKRO-FINANZ ANALYSE (Stichtag: 2026-07-09)');
    expect(report).toContain('Regime:');
    expect(report).toContain('Liquidität:');
  });
  
  it('sollte getAlerts() erfolgreich aufrufen', () => {
    const data = createFakeData();
    const alerts = engine.getAlerts(data);
    // Erwartet, dass es nicht crasht
    expect(alerts).toBeDefined();
  });
  
  it('sollte getDailyStatusReport() erfolgreich aufrufen', () => {
    const data = createFakeData();
    const status = engine.getDailyStatusReport(data);
    expect(status).toBeDefined();
    expect(status.title).toContain('CrashRadar: Makro-Wetterbericht');
  });
});
