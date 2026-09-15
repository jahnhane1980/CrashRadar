import { describe, it, expect } from 'vitest';
import { LiquiditySensorHub } from '../../../src/signals/hubs/LiquiditySensorHub.js';
import { SignalComponent } from '../../../src/signals/contracts/SignalComponent.js';
import { SignalStatus, LiquidityRegime } from '../../../src/signals/contracts/SignalTypes.js';

describe('LiquiditySensorHub (Composite)', () => {
  it('should pass SignalComponent contract validation', () => {
    const hub = new LiquiditySensorHub();
    expect(SignalComponent.validate(hub)).toBe(true);
    expect(hub.getId()).toBe('LIQUIDITY_SENSOR_HUB');
    expect(hub.getComponentType()).toBe('HUB');
  });

  it('should return UNKNOWN for empty or short timeline', () => {
    const hub = new LiquiditySensorHub();
    const res = hub.evaluate([]);
    expect(res.status).toBe(SignalStatus.UNKNOWN);
    expect(res.regime).toBe(LiquidityRegime.UNKNOWN);
  });

  it('should detect EXPANSION regime when liquidity is abundant', () => {
    const hub = new LiquiditySensorHub();
    const timeline = [];
    for (let i = 0; i < 45; i++) {
      timeline.push({
        date: `2026-08-${(i + 1).toString().padStart(2, '0')}`,
        assets: { VIX: 14.5 },
        macroGroups: {
          BankingHealth: { BankReserves: 3600 },
          NetLiquidity: { RRPONTSYD: 1200, TGA: 750, WALCL: 7500 },
          TreasuryCapacity: { GDP: 28000, THREEFYTP10: 0.3, USGSEC: 100 },
          FinancialConditions: { RealYield10y: 1.5, FedFundsRate: 4.5 }
        }
      });
    }

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.OK);
    expect(res.regime).toBe(LiquidityRegime.EXPANSION);
    expect(res.diagnostics.isToxicTrap).toBe(false);
  });

  it('should detect BUFFERED_CUSHION (Status OK) when RRP is low but TGA cushions and stress is low', () => {
    const hub = new LiquiditySensorHub();
    const timeline = [];
    for (let i = 0; i < 45; i++) {
      timeline.push({
        date: `2026-08-${(i + 1).toString().padStart(2, '0')}`,
        assets: { VIX: 16.0 },
        macroGroups: {
          BankingHealth: { BankReserves: 2950 }, // knapp über LCLOR (2940) -> Slack < 50
          NetLiquidity: { RRPONTSYD: 10, TGA: 850, WALCL: 7000 }, // TGA 850 > 750 (Cushion = 100)
          TreasuryCapacity: { GDP: 28000, THREEFYTP10: 0.3, BuybackMio: 6000, USGSEC: 100 }, // Buyback > 5B
          FinancialConditions: { RealYield10y: 1.5, FedFundsRate: 4.5 }
        }
      });
    }

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.OK);
    expect(res.regime).toBe(LiquidityRegime.BUFFERED_CUSHION);
    expect(res.diagnostics.isBuffered).toBe(true);
    expect(res.diagnostics.isToxicTrap).toBe(false);
    expect(res.message).toContain('stabil gepuffert');
  });

  it('should trigger TOXIC_LIQUIDITY_TRAP (Status CRITICAL) when dualMacroStress >= 55 and VIX > 25', () => {
    const hub = new LiquiditySensorHub();
    const timeline = [];
    for (let i = 0; i < 45; i++) {
      // Erzeuge hohen Zins- und Geldmarkt-Stress
      timeline.push({
        date: `2026-08-${(i + 1).toString().padStart(2, '0')}`,
        assets: { VIX: i === 44 ? 26.5 : 18.0 }, // VIX bricht auf 26.5 aus
        macroGroups: {
          BankingHealth: { BankReserves: 2900 }, // unter LCLOR
          NetLiquidity: { RRPONTSYD: 5, TGA: 400, WALCL: 6500 }, // TGA Refill Deficit = 350
          TreasuryCapacity: { GDP: 28000, THREEFYTP10: 0.9, AuctionCouponsMio: 80000, USGSEC: 150 },
          FinancialConditions: {
            RealYield10y: i === 44 ? 2.8 : 1.8, // Starker Realzins-Anstieg
            FedFundsRate: 5.5
          }
        }
      });
    }

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.CRITICAL);
    expect(res.regime).toBe(LiquidityRegime.CRITICAL_DRAIN);
    expect(res.diagnostics.isToxicTrap).toBe(true);
    expect(res.diagnostics.vix).toBe(26.5);
    expect(res.message).toContain('Toxische Liquiditäts-Falle');
  });
});
