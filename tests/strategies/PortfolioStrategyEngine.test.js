import { describe, it, expect, vi } from 'vitest';
import { PortfolioStrategyEngine } from '../../src/strategies/PortfolioStrategyEngine.js';
import { PortfolioStrategyInterface } from '../../src/strategies/PortfolioStrategyInterface.js';
import { GoldSpyDcaStrategy } from '../../src/strategies/GoldSpyDcaStrategy.js';
import { KamikazeGrowthStrategy } from '../../src/strategies/KamikazeGrowthStrategy.js';

describe('PortfolioStrategyEngine', () => {
  // Mock-Strategie 1: Kamikaze Style (mit Broker State)
  class MockKamikazeStrategy extends PortfolioStrategyInterface {
    getId() {
      return 'KAMIKAZE_GROWTH';
    }

    getName() {
      return 'Kamikaze Growth';
    }

    getVersion() {
      return '1.2.4';
    }

    evaluateDaily(context) {
      this.lastContext = context;
      return {
        strategy_id: this.getId(),
        status: 'ACTIVE',
        lasting_hold_preserved: ['PLTR'],
        free_usd: context.brokerState?.free_usd || 7000
      };
    }

    getSnapshot(date) {
      return {
        strategy_id: this.getId(),
        date,
        status: 'ACTIVE',
        positions: [{ ticker: 'PLTR', investmentType: 'LASTING_HOLD' }]
      };
    }
  }

  // Mock-Strategie 2: Gold SPY Style
  class MockGoldSpyStrategy extends PortfolioStrategyInterface {
    getId() {
      return 'GOLD_SPY';
    }

    getName() {
      return 'Gold-SPY Dynamic DCA';
    }

    getVersion() {
      return '2.2.0';
    }

    evaluateDaily(context) {
      const shield = context.macroSignalContext?.katastrophenMatrix?.isShieldActive;
      return {
        strategy_id: this.getId(),
        status: shield ? 'HEDGE_75_25' : '100_SPY_DCA'
      };
    }

    getSnapshot(date) {
      return {
        strategy_id: this.getId(),
        date,
        target_allocation: { SPY: 100.0 }
      };
    }
  }

  // Mock-Strategie 3: Failing Strategy (Fehler-Isolation)
  class MockBuggyStrategy extends PortfolioStrategyInterface {
    getId() {
      return 'BUGGY_STRATEGY';
    }

    getName() {
      return 'Buggy Strategy';
    }

    evaluateDaily() {
      throw new Error('Simulation of an unexpected runtime error!');
    }

    getSnapshot() {
      throw new Error('Snapshot failure!');
    }
  }

  it('should register valid strategies and reject invalid ones', () => {
    const engine = new PortfolioStrategyEngine();
    const strat1 = new MockKamikazeStrategy();
    const strat2 = new MockGoldSpyStrategy();

    engine.registerStrategy(strat1).registerStrategy(strat2);

    expect(engine.getStrategy('KAMIKAZE_GROWTH')).toBe(strat1);
    expect(engine.getStrategy('GOLD_SPY')).toBe(strat2);
    expect(engine.getStrategy('UNKNOWN')).toBeNull();
    expect(engine.getRegisteredStrategies()).toHaveLength(2);

    expect(() => engine.registerStrategy({})).toThrow("Methode 'getId' fehlt");
  });

  it('should build a complete macroSignalContext even with empty/minimal timeline', () => {
    const engine = new PortfolioStrategyEngine();
    const ctxEmpty = engine.buildMacroSignalContext([]);
    expect(ctxEmpty.status).toBe('UNKNOWN');
    expect(ctxEmpty.katastrophenMatrix.status).toBe('UNKNOWN');
    expect(ctxEmpty.goldSniper.status).toBe('UNKNOWN');
  });

  it('should build macroSignalContext with precalculated signals correctly', () => {
    const engine = new PortfolioStrategyEngine();
    const timeline = [
      { date: '2025-05-01', assets: { SPY: 500, VIX: 18 } }
    ];

    const ctx = engine.buildMacroSignalContext(timeline, {
      katastrophenMatrix: { status: 'OK', isShieldActive: false },
      goldSniper: { status: 'OK', state: 'NORMAL', signal: 'NONE' },
      treasuryCapacity: { status: 'OK', score: 20 },
      panicCapitulation: { status: 'OK' }
    });

    expect(ctx.date).toBe('2025-05-01');
    expect(ctx.regime).toBe('EXPANSION');
    expect(ctx.katastrophenMatrix.isShieldActive).toBe(false);
    expect(ctx.bottomSniper.isCritical).toBe(false);
  });

  it('should set regime to CRISIS_ALERT when katastrophenMatrix isShieldActive is true', () => {
    const engine = new PortfolioStrategyEngine();
    const timeline = [{ date: '2025-05-01', assets: { SPY: 450, VIX: 32 } }];

    const ctx = engine.buildMacroSignalContext(timeline, {
      katastrophenMatrix: { status: 'CRITICAL', isShieldActive: true, signal: 'ALLOCATE_GOLD' },
      goldSniper: { status: 'CRITICAL', state: 'HEDGE_ACTIVE', signal: 'ALLOCATE_GOLD' }
    });

    expect(ctx.regime).toBe('CRISIS_ALERT');
    expect(ctx.katastrophenMatrix.isShieldActive).toBe(true);
  });

  it('should evaluate all registered strategies and pass context, timeline and brokerState', async () => {
    const engine = new PortfolioStrategyEngine();
    const kamikaze = new MockKamikazeStrategy();
    const goldSpy = new MockGoldSpyStrategy();
    engine.registerStrategy(kamikaze).registerStrategy(goldSpy);

    const timeline = [{ date: '2026-09-13', assets: { SPY: 560 } }];
    const brokerStates = {
      KAMIKAZE_GROWTH: { free_usd: 9400.50 }
    };

    const evalResult = await engine.evaluateAll({
      date: '2026-09-13',
      timeline,
      brokerStates,
      precalculatedSignals: {
        katastrophenMatrix: { status: 'OK', isShieldActive: false }
      }
    });

    expect(evalResult.date).toBe('2026-09-13');
    expect(evalResult.strategyResults.KAMIKAZE_GROWTH.status).toBe('ACTIVE');
    expect(evalResult.strategyResults.KAMIKAZE_GROWTH.free_usd).toBe(9400.50);
    expect(evalResult.strategyResults.GOLD_SPY.status).toBe('100_SPY_DCA');
  });

  it('should isolate runtime errors in individual strategies without crashing evaluateAll', async () => {
    const engine = new PortfolioStrategyEngine();
    const validStrat = new MockKamikazeStrategy();
    const buggyStrat = new MockBuggyStrategy();
    engine.registerStrategy(validStrat).registerStrategy(buggyStrat);

    const evalResult = await engine.evaluateAll({
      date: '2026-09-13',
      timeline: [{ date: '2026-09-13', assets: { SPY: 560 } }]
    });

    expect(evalResult.strategyResults.KAMIKAZE_GROWTH.status).toBe('ACTIVE');
    expect(evalResult.strategyResults.BUGGY_STRATEGY.status).toBe('ERROR');
    expect(evalResult.strategyResults.BUGGY_STRATEGY.error).toContain('unexpected runtime error');
  });

  it('should build standardized daily snapshot for Cloudflare D1', () => {
    const engine = new PortfolioStrategyEngine();
    const kamikaze = new MockKamikazeStrategy();
    const goldSpy = new MockGoldSpyStrategy();
    engine.registerStrategy(kamikaze).registerStrategy(goldSpy);

    const snapshot = engine.buildDailySnapshot('2026-09-13', {
      regime: 'EXPANSION',
      status: 'OK'
    });

    expect(snapshot.schema_version).toBe('2.1.0');
    expect(snapshot.snapshot_date).toBe('2026-09-13');
    expect(snapshot.active_strategies_count).toBe(2);
    expect(snapshot.strategies.KAMIKAZE_GROWTH.strategy_id).toBe('KAMIKAZE_GROWTH');
    expect(snapshot.strategies.GOLD_SPY.strategy_id).toBe('GOLD_SPY');
  });

  it('should successfully run real GoldSpyDcaStrategy and KamikazeGrowthStrategy together', async () => {
    const engine = new PortfolioStrategyEngine();
    const goldSpy = new GoldSpyDcaStrategy();
    const kamikaze = new KamikazeGrowthStrategy();

    engine.registerStrategy(goldSpy).registerStrategy(kamikaze);

    // 1. Normalbetrieb Test
    const normalEval = await engine.evaluateAll({
      date: '2026-09-13',
      timeline: [{ date: '2026-09-13', assets: { SPY: 560, GLD: 250 } }],
      precalculatedSignals: {
        katastrophenMatrix: { isShieldActive: false },
        goldSniper: { signal: 'NONE', isGoldHedgeActive: false },
        bottomSniper: { isCritical: false }
      }
    });

    expect(normalEval.strategyResults.GOLD_SPY.status).toBe('NORMAL_DCA');
    expect(normalEval.strategyResults.GOLD_SPY.targetAllocationPct).toEqual({ SPY: 100.0, GLD: 0.0, CASH: 0.0 });
    expect(normalEval.strategyResults.KAMIKAZE_GROWTH.status).toBe('ACTIVE_MANAGEMENT');
    expect(normalEval.strategyResults.KAMIKAZE_GROWTH.lastingHoldTickers).toContain('AIRO');

    // 2. Notfall-Alarm Test: Katastrophen-Matrix schlägt an
    const alarmEval = await engine.evaluateAll({
      date: '2026-09-13',
      timeline: [{ date: '2026-09-13', assets: { SPY: 450, GLD: 270 } }],
      precalculatedSignals: {
        katastrophenMatrix: { isShieldActive: true, signal: 'ALLOCATE_GOLD' },
        goldSniper: { isGoldHedgeActive: true, signal: 'ALLOCATE_GOLD' },
        bottomSniper: { isCritical: false }
      }
    });

    // Gold-SPY evakuiert in 75/25 Sweet Spot
    expect(alarmEval.strategyResults.GOLD_SPY.status).toBe('EMERGENCY_HEDGE');
    expect(alarmEval.strategyResults.GOLD_SPY.targetAllocationPct).toEqual({ SPY: 0.0, GLD: 75.0, CASH: 25.0 });

    // Kamikaze schützt LASTING_HOLD und evakuiert Zykliker in 50/50 Gold/Cash
    expect(alarmEval.strategyResults.KAMIKAZE_GROWTH.status).toBe('EMERGENCY_HEDGE');
    expect(alarmEval.strategyResults.KAMIKAZE_GROWTH.hedgeAllocation).toEqual({ gold_pct: 50, cash_pct: 50 });
    expect(alarmEval.strategyResults.KAMIKAZE_GROWTH.lastingHoldTickers).toContain('AIRO');

    // 3. Snapshot Export generieren
    const snapshot = engine.buildDailySnapshot('2026-09-13', alarmEval.macroSignalContext);
    expect(snapshot.schema_version).toBe('2.1.0');
    expect(snapshot.strategies.GOLD_SPY.status).toBe('EMERGENCY_HEDGE');
    expect(snapshot.strategies.KAMIKAZE_GROWTH.read_only).toBe(true);
  });
});
