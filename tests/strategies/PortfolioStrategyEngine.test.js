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
      const msh = context.macroSignalContext?.macroStressHub;
      const shield = msh?.regime === 'SYSTEMIC_STRESS' || msh?.isShieldActive;
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
    expect(ctxEmpty.regime).toBe('EXPANSION');
    expect(ctxEmpty.macroStressHub.status).toBe('UNKNOWN');
    expect(ctxEmpty.macroStressHub.regime).toBe('UNKNOWN');
    expect(ctxEmpty.cryptoHub.status).toBe('UNKNOWN');
    expect(ctxEmpty.cryptoHub.regime).toBe('UNKNOWN');
    expect(ctxEmpty.liquidityHub.status).toBe('UNKNOWN');
    expect(ctxEmpty.bottomHub.status).toBe('UNKNOWN');
  });

  it('should build macroSignalContext with precalculated signals correctly', () => {
    const engine = new PortfolioStrategyEngine();
    const timeline = [
      { date: '2025-05-01', assets: { SPY: 500, VIX: 18 } }
    ];

    const ctx = engine.buildMacroSignalContext(timeline, {
      macroStressHub: { status: 'OK', regime: 'NORMAL_EXPANSION', isShieldActive: false },
      bottomHub: { status: 'OK', regime: 'NONE', isCritical: false },
      cryptoHub: { status: 'OK', regime: 'BULL_EXPANSION' },
      liquidityHub: { status: 'OK', regime: 'EXPANSION' }
    });

    expect(ctx.date).toBe('2025-05-01');
    expect(ctx.regime).toBe('EXPANSION');
    expect(ctx.macroStressHub.isShieldActive).toBe(false);
    expect(ctx.bottomHub.isCritical).toBe(false);
    expect(ctx.cryptoHub.regime).toBe('BULL_EXPANSION');
  });

  it('should evaluate cryptoHub standardly in SignalEngine and emit signals for crypto strategies', () => {
    const engine = new PortfolioStrategyEngine();
    const timeline = Array(205).fill(0).map((_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      assets: {
        SPY: 500,
        BTC: 60000,
        MSTR: i === 204 ? 150 : 100 // Tag 204 springt über SMA-200
      }
    }));

    const ctx = engine.buildMacroSignalContext(timeline);

    expect(ctx.cryptoHub).toBeDefined();
    expect(ctx.cryptoHub.status).toBe('OK');
    expect(ctx.cryptoHub.regime).toBe('BULL_EXPANSION');
  });

  it('should expose all modern Sensor Hubs (CryptoHub, MacroStressHub, LiquidityHub, BottomHub) with descriptive regimes', () => {
    const engine = new PortfolioStrategyEngine();
    const timeline = Array(260).fill(0).map((_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
      assets: {
        SPY: 550,
        BTC: 65000,
        MSTR: 160,
        VIX: 17.5,
        DIX: 43.0
      },
      macroGroups: {
        NetLiquidity: { BankReserves: 3500000, RRPONTSYD: 200, TGA: 600, WALCL: 7000 },
        BankingHealth: { BankReserves: 3500 },
        TreasuryCapacity: { GDP: 28000, THREEFYTP10: 0.5, USGSEC: 100 }
      }
    }));

    const ctx = engine.buildMacroSignalContext(timeline);

    expect(ctx.cryptoHub).toBeDefined();
    expect(ctx.cryptoHub.regime).toBe('BULL_EXPANSION');
    expect(ctx.cryptoHub.status).toBe('OK');

    expect(ctx.macroStressHub).toBeDefined();
    expect(ctx.macroStressHub.regime).toBe('NORMAL_EXPANSION');
    expect(ctx.macroStressHub.isShieldActive).toBe(false);

    expect(ctx.liquidityHub).toBeDefined();
    expect(ctx.liquidityHub.regime).toBe('EXPANSION');
    expect(ctx.liquidityHub.projectedCollision).toBeDefined();

    expect(ctx.bottomHub).toBeDefined();
    expect(ctx.bottomHub.regime).toBe('NONE');
  });

  it('should set regime to CRISIS_ALERT when macroStressHub is in SYSTEMIC_STRESS', () => {
    const engine = new PortfolioStrategyEngine();
    const timeline = [{ date: '2025-05-01', assets: { SPY: 450, VIX: 32 } }];

    const ctx = engine.buildMacroSignalContext(timeline, {
      macroStressHub: { status: 'CRITICAL', regime: 'SYSTEMIC_STRESS', isShieldActive: true, isMarginCallZone: false }
    });

    expect(ctx.regime).toBe('CRISIS_ALERT');
    expect(ctx.macroStressHub.isShieldActive).toBe(true);
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
        macroStressHub: { status: 'OK', regime: 'NORMAL_EXPANSION', isShieldActive: false }
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
        macroStressHub: { status: 'OK', regime: 'NORMAL_EXPANSION', isShieldActive: false },
        bottomHub: { status: 'OK', regime: 'NONE', isCritical: false }
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
        macroStressHub: { status: 'CRITICAL', regime: 'SYSTEMIC_STRESS', isShieldActive: true },
        bottomHub: { status: 'OK', regime: 'NONE', isCritical: false }
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
