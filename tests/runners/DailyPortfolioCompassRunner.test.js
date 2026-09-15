import { describe, it, expect, vi } from 'vitest';
import { DailyPortfolioCompassRunner } from '../../src/runners/DailyPortfolioCompassRunner.js';
import { SignalStatus } from '../../src/signals/contracts/SignalTypes.js';

describe('DailyPortfolioCompassRunner', () => {
  const buildMockTimeline = () => {
    const timeline = [];
    for (let i = 0; i < 45; i++) {
      const d = new Date(Date.UTC(2026, 6, 1 + i));
      timeline.push({
        date: d.toISOString().split('T')[0],
        assets: {
          SPY: 550 + i,
          VIX: 16.0
        },
        macroGroups: {
          BankingHealth: { BankReserves: 3400 },
          NetLiquidity: { RRPONTSYD: 400, TGA: 700, WALCL: 7200 },
          TreasuryCapacity: { GDP: 29000, THREEFYTP10: 0.4 },
          FinancialConditions: { RealYield10y: 1.8, FedFundsRate: 5.0 }
        }
      });
    }
    return timeline;
  };

  it('should run successfully with injected timeline and format output', async () => {
    const mockNtfy = { send: vi.fn().mockResolvedValue() };
    const runner = new DailyPortfolioCompassRunner({
      sendNtfy: false
    }, {
      timeline: buildMockTimeline(),
      ntfyService: mockNtfy
    });

    const result = await runner.run();
    expect(result).toBeDefined();
    expect(result.status).toBe(SignalStatus.OK);
    expect(result.hubs.liquidity).toBeDefined();
    expect(result.hubs.derivatives).toBeDefined();
    expect(result.hubs.goldilocks).toBeDefined();
    expect(mockNtfy.send).not.toHaveBeenCalled();
  });

  it('should dispatch Ntfy alert when sendNtfy is enabled', async () => {
    process.env.NTFY_PORTFOLIO_COMPASS_TOPIC = 'test-compass-topic';
    const mockNtfy = { send: vi.fn().mockResolvedValue() };
    const runner = new DailyPortfolioCompassRunner({
      sendNtfy: true
    }, {
      timeline: buildMockTimeline(),
      ntfyService: mockNtfy
    });

    const result = await runner.run();
    expect(result).toBeDefined();
    expect(mockNtfy.send).toHaveBeenCalledTimes(1);
    const [title, msg] = mockNtfy.send.mock.calls[0];
    expect(title).toContain('CrashRadar Kompass');
    expect(msg).toContain('Liquidität');
    expect(msg).toContain('Derivate');
    expect(msg).toContain('Goldilocks');
  });

  it('should throw error when timeline is empty', async () => {
    const runner = new DailyPortfolioCompassRunner({}, {
      timeline: []
    });

    await expect(runner.run()).rejects.toThrow('FinanceExpert lieferte keine Daten');
  });
});
