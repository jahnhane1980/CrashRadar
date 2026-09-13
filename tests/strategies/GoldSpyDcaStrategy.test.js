import { describe, it, expect, beforeEach } from 'vitest';
import { GoldSpyDcaStrategy } from '../../src/strategies/GoldSpyDcaStrategy.js';
import { PortfolioStrategyInterface } from '../../src/strategies/PortfolioStrategyInterface.js';

describe('GoldSpyDcaStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new GoldSpyDcaStrategy();
  });

  it('should conform to PortfolioStrategyInterface', () => {
    expect(PortfolioStrategyInterface.validate(strategy)).toBe(true);
    expect(strategy.getId()).toBe('GOLD_SPY');
    expect(strategy.getName()).toBe('Gold-SPY Dynamic DCA Portfolio');
    expect(strategy.getVersion()).toBe('2.3.0');
  });

  it('should allocate 100% SPY DCA in normal regime', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: false },
        goldSniper: { signal: 'NONE', isGoldHedgeActive: false },
        bottomSniper: { isCritical: false }
      }
    });

    expect(evalResult.status).toBe('NORMAL_DCA');
    expect(evalResult.targetAllocationPct).toEqual({ SPY: 100.0, GLD: 0.0, CASH: 0.0 });
    expect(evalResult.trancheAction).toBe('HOLD');
    expect(evalResult.reason).toContain('100% S&P 500 DCA im Normalbetrieb');
  });

  it('should evacuate into 75% Gold / 25% Cash sweet spot when Katastrophen-Matrix triggers', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true, signal: 'ALLOCATE_GOLD' },
        goldSniper: { isGoldHedgeActive: true, signal: 'ALLOCATE_GOLD' },
        bottomSniper: { isCritical: false }
      }
    });

    expect(evalResult.status).toBe('EMERGENCY_HEDGE');
    expect(evalResult.targetAllocationPct).toEqual({ SPY: 0.0, GLD: 75.0, CASH: 25.0 });
    expect(evalResult.trancheAction).toBe('EVACUATE_HEDGE');
    expect(evalResult.reason).toContain('Sweet Spot');
  });

  it('should switch to 100% Cash when Gold-Sniper triggers EXIT_GOLD_TO_CASH at -18% to -19%', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'PRE_MARGIN_LOCK', signal: 'EXIT_GOLD_TO_CASH' },
        bottomSniper: { isCritical: false }
      }
    });

    expect(evalResult.status).toBe('PRE_MARGIN_CASH_LOCK');
    expect(evalResult.targetAllocationPct).toEqual({ SPY: 0.0, GLD: 0.0, CASH: 100.0 });
    expect(evalResult.trancheAction).toBe('EXIT_GOLD_TO_CASH');
    expect(evalResult.reason).toContain('Pre-Margin-Call Gewinnsicherung');
  });

  it('should enter Tranche 1 (30% SPY / 70% Cash) when Bottom-Sniper fires DEPLOY_CASH', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      marketData: { SPY: 300.0 },
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true, darkPoolAccumulation: { status: 'OK' } }
      }
    });

    expect(evalResult.status).toBe('RE_ENTRY_SNIPER');
    expect(evalResult.trancheAction).toBe('BUY_TRANCHE_1');
    expect(evalResult.trancheLevel).toBe(1);
    expect(evalResult.targetAllocationPct).toEqual({ SPY: 30.0, GLD: 0.0, CASH: 70.0 });
    expect(evalResult.reason).toContain('Re-Entry Tranche 1 (30% SPY)');
  });

  it('should progress to Tranche 2 (70% SPY / 30% Cash) when Dark Pool Accumulation is critical', () => {
    // Day 1: Tranche 1
    strategy.evaluateDaily({
      date: '2026-09-13',
      marketData: { SPY: 300.0 },
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true, darkPoolAccumulation: { status: 'OK' } }
      }
    });

    // Day 2: Dark Pool accumulation triggers Tranche 2
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-14',
      marketData: { SPY: 295.0 },
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true, darkPoolAccumulation: { status: 'CRITICAL', currentDix: 49.5 } }
      }
    });

    expect(evalResult.status).toBe('RE_ENTRY_SNIPER');
    expect(evalResult.trancheAction).toBe('BUY_TRANCHE_2');
    expect(evalResult.trancheLevel).toBe(2);
    expect(evalResult.targetAllocationPct).toEqual({ SPY: 70.0, GLD: 0.0, CASH: 30.0 });
    expect(evalResult.reason).toContain('Re-Entry Tranche 2 (+40% auf 70% SPY)');
  });

  it('should progress to Tranche 3 (100% SPY) when SPY recovers above SMA 20', () => {
    // Day 1: Tranche 1
    strategy.evaluateDaily({
      date: '2026-09-13',
      marketData: { SPY: 300.0 },
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true }
      }
    });

    // Day 2: Dark Pool triggers Tranche 2
    strategy.evaluateDaily({
      date: '2026-09-14',
      marketData: { SPY: 295.0 },
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true, darkPoolAccumulation: { status: 'CRITICAL' } }
      }
    });

    // Day 3: SPY rises above SMA20 (310 > 280)
    const mockTimeline = Array.from({ length: 25 }, (_, i) => ({
      date: `2026-09-${i + 1}`,
      assets: { SPY: 280.0 }
    }));
    mockTimeline.push({ date: '2026-09-15', assets: { SPY: 310.0 } });

    const evalResult = strategy.evaluateDaily({
      date: '2026-09-15',
      timeline: mockTimeline,
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true }
      }
    });

    expect(evalResult.status).toBe('RE_ENTRY_SNIPER');
    expect(evalResult.trancheAction).toBe('BUY_TRANCHE_3');
    expect(evalResult.trancheLevel).toBe(3);
    expect(evalResult.targetAllocationPct).toEqual({ SPY: 100.0, GLD: 0.0, CASH: 0.0 });
    expect(evalResult.reason).toContain('Re-Entry Tranche 3 (+30% auf 100% SPY)');
  });

  it('should reset to 100% Cash when margin call cascade hits during tranches', () => {
    // Day 1: Tranche 1 active
    strategy.evaluateDaily({
      date: '2026-09-13',
      marketData: { SPY: 300.0 },
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true }
      }
    });

    // Day 2: Market plunges into margin call without bottom signal
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-14',
      marketData: { SPY: 250.0 },
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'MARGIN_CALL_ACTIVE', signal: 'HOLD_CASH' },
        bottomSniper: { isCritical: false }
      }
    });

    expect(evalResult.status).toBe('MARGIN_CALL_ACTIVE');
    expect(evalResult.targetAllocationPct).toEqual({ SPY: 0.0, GLD: 0.0, CASH: 100.0 });
    expect(evalResult.trancheAction).toBe('HOLD_CASH');
    expect(strategy.trancheLevel).toBe(0);
  });

  it('should generate valid snapshot with tranche metadata for Cloudflare D1', () => {
    strategy.evaluateDaily({
      date: '2026-09-13',
      marketData: { SPY: 300.0 },
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true }
      }
    });

    const snapshot = strategy.getSnapshot('2026-09-13');
    expect(snapshot.strategy_id).toBe('GOLD_SPY');
    expect(snapshot.status).toBe('RE_ENTRY_SNIPER');
    expect(snapshot.version).toBe('2.3.0');
    expect(snapshot.tranche_level).toBe(1);
    expect(snapshot.target_allocation_pct.SPY).toBe(30.0);
    expect(snapshot.target_allocation_pct.CASH).toBe(70.0);
  });
});
