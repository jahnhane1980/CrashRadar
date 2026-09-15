import { describe, it, expect, vi } from 'vitest';
import { DailyPortfolioCompass } from '../../src/analysis/DailyPortfolioCompass.js';
import { SignalComponent } from '../../src/signals/contracts/SignalComponent.js';
import { SignalStatus } from '../../src/signals/contracts/SignalTypes.js';

describe('DailyPortfolioCompass', () => {
  it('should pass SignalComponent contract validation', () => {
    const compass = new DailyPortfolioCompass();
    expect(SignalComponent.validate(compass)).toBe(true);
    expect(compass.getId()).toBe('DAILY_PORTFOLIO_COMPASS');
    expect(compass.getComponentType()).toBe('ANALYSIS');
  });

  it('should return UNKNOWN for empty timeline', () => {
    const compass = new DailyPortfolioCompass();
    const res = compass.evaluate([]);
    expect(res.status).toBe(SignalStatus.UNKNOWN);
    expect(res.hubs.liquidity).toBeNull();
    expect(res.hubs.derivatives).toBeNull();
    expect(res.hubs.goldilocks).toBeNull();
  });

  it('should evaluate the 3 hubs and output their signals to console', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const compass = new DailyPortfolioCompass();
    const timeline = [];
    for (let i = 0; i < 45; i++) {
      const d = new Date(Date.UTC(2026, 6, 1 + i));
      timeline.push({
        date: d.toISOString().split('T')[0],
        assets: { SPY: 700 + i, VIX: 15.0 },
        macroGroups: {
          BankingHealth: { BankReserves: 3600 },
          NetLiquidity: { RRPONTSYD: 500, TGA: 750, WALCL: 7500 },
          TreasuryCapacity: { GDP: 28000, THREEFYTP10: 0.3 },
          FinancialConditions: { RealYield10y: 1.5, FedFundsRate: 4.5 }
        }
      });
    }

    const res = compass.evaluate(timeline);
    expect(res.date).toBe(timeline[44].date);
    expect(res.hubs.liquidity).toBeDefined();
    expect(res.hubs.derivatives).toBeDefined();
    expect(res.hubs.goldilocks).toBeDefined();

    // Verifiziere, dass alle drei Hubs in die Konsole geloggt wurden
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1. 💧 LIQUIDITY-SENSOR-HUB:'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2. ⚡ DERIVATIVES-SENSOR-HUB:'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('3. 🥣 GOLDILOCKS-SENSOR-HUB:'));
    consoleSpy.mockRestore();
  });

  it('should reflect CRITICAL status when a hub triggers critical (e.g. toxic liquidity trap)', () => {
    const compass = new DailyPortfolioCompass();
    const timeline = [];
    for (let i = 0; i < 45; i++) {
      const d = new Date(Date.UTC(2026, 6, 1 + i));
      timeline.push({
        date: d.toISOString().split('T')[0],
        assets: {
          SPY: 650 - i,
          VIX: i === 44 ? 27.5 : 17.0
        },
        macroGroups: {
          BankingHealth: { BankReserves: 2900 },
          NetLiquidity: { RRPONTSYD: 0, TGA: 400, WALCL: 6500 },
          TreasuryCapacity: { GDP: 28000, THREEFYTP10: 0.9, AuctionCouponsMio: 80000 },
          FinancialConditions: { RealYield10y: 2.8, FedFundsRate: 5.5 }
        }
      });
    }

    const res = compass.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.CRITICAL);
    expect(res.hubs.liquidity.status).toBe(SignalStatus.CRITICAL);
  });

  it('should safely return UNKNOWN if slice length is less than 21 days due to early dateOverride', () => {
    const compass = new DailyPortfolioCompass();
    const timeline = [];
    for (let i = 0; i < 45; i++) {
      const d = new Date(Date.UTC(2026, 6, 1 + i));
      timeline.push({
        date: d.toISOString().split('T')[0],
        assets: { SPY: 700 + i, VIX: 15.0 }
      });
    }

    const res = compass.evaluate(timeline, { dateOverride: timeline[5].date });
    expect(res.status).toBe(SignalStatus.UNKNOWN);
    expect(res.message).toContain('zu kurz');
  });
});
