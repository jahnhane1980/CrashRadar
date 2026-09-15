import { describe, it, expect } from 'vitest';
import { GoldilocksSensorHub } from '../../../src/signals/hubs/GoldilocksSensorHub.js';
import { SignalComponent } from '../../../src/signals/contracts/SignalComponent.js';
import { SignalStatus, GoldilocksRegime } from '../../../src/signals/contracts/SignalTypes.js';

describe('GoldilocksSensorHub (Composite)', () => {
  it('should pass SignalComponent contract validation', () => {
    const hub = new GoldilocksSensorHub();
    expect(SignalComponent.validate(hub)).toBe(true);
    expect(hub.getId()).toBe('GOLDILOCKS_SENSOR_HUB');
    expect(hub.getName()).toBe('Goldilocks Macro Regime Sensor Hub');
    expect(hub.getComponentType()).toBe('HUB');
  });

  it('should return UNKNOWN for empty timeline', () => {
    const hub = new GoldilocksSensorHub();
    const res = hub.evaluate([]);
    expect(res.status).toBe(SignalStatus.UNKNOWN);
    expect(res.regime).toBe(GoldilocksRegime.UNKNOWN);
    expect(res.score).toBeNull();
  });

  it('should detect GOLDILOCKS_EXPANSION in ideal conditions', () => {
    const hub = new GoldilocksSensorHub({ smaPeriod: 10 });
    // Erstelle 15 Tage Timeline mit SPY im Aufwärtstrend
    const timeline = [];
    for (let i = 0; i < 15; i++) {
      timeline.push({
        date: `2026-09-${(i + 1).toString().padStart(2, '0')}`,
        assets: {
          SPY: 700 + i * 2,
          Oil: 75.0
        },
        macroGroups: {
          Leading: {
            CPI_Core: 2.5, // 2.5% YoY Disinflation
            BreakevenInflation: 2.15,
            SahmRule: 0.10
          },
          LaborMarket: {
            PAYEMS: 159000 + i * 10,
            JTSJOL: 7500
          },
          FinancialConditions: {
            RealYield10y: 1.80,
            FedFundsRate: 3.50
          },
          YieldCurve: {
            Spread10y2y: 0.25
          }
        }
      });
    }

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.OK);
    expect(res.regime).toBe(GoldilocksRegime.GOLDILOCKS_EXPANSION);
    expect(res.score).toBeGreaterThanOrEqual(65);
    expect(res.isAboveSma200).toBe(true);
    expect(res.message).toContain('GOLDILOCKS-ZONE AKTIV');
    expect(res.diagnostics.inflation.coreCpiYoY).toBe(2.5);
    expect(res.diagnostics.labor.sahmRule).toBe(0.10);
    expect(res.diagnostics.monetary.realYield10y).toBe(1.80);
  });

  it('should detect RECESSION_CONTRACTION when Sahm Rule triggers (>= 0.50)', () => {
    const hub = new GoldilocksSensorHub();
    const timeline = [
      {
        date: '2026-09-14',
        assets: { SPY: 650, Oil: 70 },
        macroGroups: {
          Leading: {
            CPI_Core: 2.2,
            SahmRule: 0.58 // Alarm!
          },
          LaborMarket: {
            PAYEMS: 158000
          },
          FinancialConditions: {
            RealYield10y: 1.50
          },
          YieldCurve: {
            Spread10y2y: -0.10
          }
        }
      }
    ];

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.CRITICAL);
    expect(res.regime).toBe(GoldilocksRegime.RECESSION_CONTRACTION);
    expect(res.message).toContain('REZESSIONS-ALARM');
    expect(res.guidance).toContain('Soft Landing gescheitert');
  });

  it('should detect STAGFLATION_PRESSURE when Oil is high and Real Yields are restrictive', () => {
    const hub = new GoldilocksSensorHub();
    const timeline = [
      {
        date: '2026-09-14',
        assets: {
          SPY: 750,
          Oil: 100.50 // Öl über 95$
        },
        macroGroups: {
          Leading: {
            CPI_Core: 3.4,
            SahmRule: 0.15
          },
          LaborMarket: {
            PAYEMS: 159000
          },
          FinancialConditions: {
            RealYield10y: 2.55 // Realzinsen > 2.40%
          },
          YieldCurve: {
            Spread10y2y: 0.30
          }
        }
      }
    ];

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.WARNING);
    expect(res.regime).toBe(GoldilocksRegime.STAGFLATION_PRESSURE);
    expect(res.message).toContain('STAGFLATIONS-DRUCK');
  });
});
