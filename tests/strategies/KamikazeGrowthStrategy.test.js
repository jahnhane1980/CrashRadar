import { describe, it, expect } from 'vitest';
import { KamikazeGrowthStrategy } from '../../src/strategies/KamikazeGrowthStrategy.js';
import { PortfolioStrategyInterface } from '../../src/strategies/PortfolioStrategyInterface.js';

describe('KamikazeGrowthStrategy', () => {
  const strategy = new KamikazeGrowthStrategy();

  it('should conform to PortfolioStrategyInterface', () => {
    expect(PortfolioStrategyInterface.validate(strategy)).toBe(true);
    expect(strategy.getId()).toBe('KAMIKAZE_GROWTH');
    expect(strategy.getName()).toBe('Kamikaze Growth Portfolio');
    expect(strategy.getVersion()).toBe('1.2.4');
  });

  it('should preserve LASTING_HOLD positions (PLTR, AIRO) during Katastrophen-Matrix alarm', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true, signal: 'ALLOCATE_GOLD' },
        goldSniper: { isGoldHedgeActive: true, signal: 'ALLOCATE_GOLD' }
      }
    });

    expect(evalResult.status).toBe('EMERGENCY_HEDGE');
    expect(evalResult.action).toBe('EVACUATE_HEDGE');
    expect(evalResult.hedgeAllocation).toEqual({ gold_pct: 50, cash_pct: 50 });
    // LASTING_HOLD Monopole bleiben geschützt!
    expect(evalResult.lastingHoldTickers).toContain('AIRO');
    expect(evalResult.reason).toContain('LASTING_HOLD Monopole');
    expect(evalResult.reason).toContain('bleiben unangetastet');
  });

  it('should reconcile with real broker state and dynamically calculate 35% Zündfunken-Pool', () => {
    const customBrokerState = {
      free_usd: 12000.00,
      pending_orders_usd: 3000.00,
      positions: [
        { ticker: 'PLTR', investmentType: 'LASTING_HOLD', shares: 500 },
        { ticker: 'SOFI', investmentType: 'CYCLICAL', shares: 1000 }
      ]
    };

    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      brokerState: customBrokerState,
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: false }
      }
    });

    expect(evalResult.status).toBe('ACTIVE_MANAGEMENT');
    expect(evalResult.freeUsd).toBe(12000.00);
    // 35% von 12.000$ = 4.200$
    expect(evalResult.fireSparkUsd).toBe(4200.00);
    expect(evalResult.lastingHoldTickers).toEqual(['PLTR']);
    expect(evalResult.cyclicalTickers).toEqual(['SOFI']);
  });

  it('should switch hedge portion to 100% Cash when Gold-Sniper triggers EXIT_GOLD_TO_CASH', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'PRE_MARGIN_LOCK', signal: 'EXIT_GOLD_TO_CASH' }
      }
    });

    expect(evalResult.status).toBe('PRE_MARGIN_CASH_LOCK');
    expect(evalResult.action).toBe('EXIT_GOLD_TO_CASH');
    expect(evalResult.hedgeAllocation).toEqual({ gold_pct: 0, cash_pct: 100 });
    expect(evalResult.reason).toContain('Pre-Margin-Call Gewinnsicherung');
  });

  it('should activate Zündfunken-Pool for dip-buys when Bottom-Sniper fires DEPLOY_CASH', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        goldSniper: { state: 'RE_ENTRY', signal: 'DEPLOY_CASH' },
        bottomSniper: { isCritical: true }
      }
    });

    expect(evalResult.status).toBe('RE_ENTRY_SNIPER');
    expect(evalResult.action).toBe('DEPLOY_SPARK');
    expect(evalResult.reason).toContain('Generationen-Boden Sniper aktiv');
    expect(evalResult.reason).toContain('Zündfunken-Pool');
  });

  it('should generate valid flagship snapshot for Telegram Read-Only broadcast', () => {
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: false }
      }
    });

    const snapshot = strategy.getSnapshot('2026-09-13');
    expect(snapshot.strategy_id).toBe('KAMIKAZE_GROWTH');
    expect(snapshot.read_only).toBe(true);
    expect(snapshot.stream_type).toBe('FLAGSHIP_BROADCAST');
    expect(snapshot.cash_pots.free_usd).toBeGreaterThan(0);
    expect(snapshot.cash_pots.fire_spark_usd).toBeGreaterThan(0);
  });
});
