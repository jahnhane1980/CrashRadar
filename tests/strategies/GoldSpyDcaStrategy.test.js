import { describe, it, expect } from 'vitest';
import { GoldSpyDcaStrategy } from '../../src/strategies/GoldSpyDcaStrategy.js';
import { PortfolioStrategyInterface } from '../../src/strategies/PortfolioStrategyInterface.js';

describe('GoldSpyDcaStrategy', () => {
  const strategy = new GoldSpyDcaStrategy();

  it('should conform to PortfolioStrategyInterface', () => {
    expect(PortfolioStrategyInterface.validate(strategy)).toBe(true);
    expect(strategy.getId()).toBe('GOLD_SPY');
    expect(strategy.getName()).toBe('Gold-SPY Dynamic DCA Portfolio');
    expect(strategy.getVersion()).toBe('2.2.0');
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

  it('should re-enter 100% SPY DCA when Bottom-Sniper fires DEPLOY_CASH', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true }
      }
    });

    expect(evalResult.status).toBe('RE_ENTRY_SNIPER');
    expect(evalResult.targetAllocationPct).toEqual({ SPY: 100.0, GLD: 0.0, CASH: 0.0 });
    expect(evalResult.trancheAction).toBe('BUY_TRANCHE');
    expect(evalResult.reason).toContain('Generationen-Boden Sniper');
  });

  it('should generate valid snapshot for Cloudflare D1', () => {
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: false }
      }
    });

    const snapshot = strategy.getSnapshot('2026-09-13');
    expect(snapshot.strategy_id).toBe('GOLD_SPY');
    expect(snapshot.status).toBe('NORMAL_DCA');
    expect(snapshot.target_allocation_pct.SPY).toBe(100.0);
  });
});
