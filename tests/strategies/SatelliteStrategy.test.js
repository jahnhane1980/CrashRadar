import { describe, it, expect, beforeEach } from 'vitest';
import { SatelliteStrategy } from '../../src/strategies/SatelliteStrategy.js';
import { PortfolioStrategyInterface } from '../../src/strategies/PortfolioStrategyInterface.js';

describe('SatelliteStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new SatelliteStrategy();
  });

  it('should conform to PortfolioStrategyInterface contract', () => {
    expect(PortfolioStrategyInterface.validate(strategy)).toBe(true);
    expect(strategy.getId()).toBe('SATELITE');
    expect(strategy.getName()).toBe('Satellite Core-Satellite Portfolio');
    expect(strategy.getVersion()).toBe('1.0.0');
  });

  it('should recommend HODL with 80% SPY / 15% DFNS / 5% BTC in normal bull market', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: false, status: 'NORMAL' },
        bottomSniper: { isCritical: false }
      }
    });

    expect(evalResult.status).toBe('NORMAL_HODL');
    expect(evalResult.action).toBe('HODL');
    expect(evalResult.targetAllocationPct).toEqual({
      SPY: 80.0,
      DFNS: 15.0,
      BTC: 5.0,
      GLD: 0.0,
      CASH: 0.0
    });
    expect(evalResult.reason).toContain('HODL-Prinzip aktiv');
  });

  it('should trigger DCA_CORE_80_15_5 on monthly savings day (1st of month)', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-10-01',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: false, status: 'NORMAL' },
        bottomSniper: { isCritical: false }
      }
    });

    expect(evalResult.status).toBe('NORMAL_HODL');
    expect(evalResult.action).toBe('DCA_CORE_80_15_5');
    expect(evalResult.reason).toContain('Monatliche Sparrate stur nach Zielallokation investieren');
  });

  it('should trigger EMERGENCY_SHIELD and EVACUATE_50_GOLD_50_CASH when katastrophenMatrix activates', () => {
    const evalResult = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true, status: 'CRITICAL', signal: 'ALLOCATE_GOLD' },
        bottomSniper: { isCritical: false }
      }
    });

    expect(evalResult.status).toBe('EMERGENCY_SHIELD');
    expect(evalResult.action).toBe('EVACUATE_50_GOLD_50_CASH');
    expect(evalResult.targetAllocationPct).toEqual({
      SPY: 0.0,
      DFNS: 0.0,
      BTC: 0.0,
      GLD: 50.0,
      CASH: 50.0
    });
    expect(evalResult.reason).toContain('KATASTROPHEN-SCHUTZSCHILD AKTIV');
  });

  it('should hold emergency hedge on subsequent emergency days', () => {
    // Tag 1: Alarm löst aus
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true }
      }
    });

    // Tag 2: Alarm bleibt aktiv
    const day2Result = strategy.evaluateDaily({
      date: '2026-09-14',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        bottomSniper: { isCritical: false }
      }
    });

    expect(day2Result.status).toBe('EMERGENCY_SHIELD');
    expect(day2Result.action).toBe('HOLD_EMERGENCY_HEDGE');
    expect(day2Result.targetAllocationPct.GLD).toBe(50.0);
    expect(day2Result.targetAllocationPct.CASH).toBe(50.0);
  });

  it('should allocate savings rate to 50% Gold / 50% Cash on monthly savings day during emergency shield', () => {
    // In Notfall versetzen
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: { katastrophenMatrix: { isShieldActive: true } }
    });

    // 1. des Folgemonats
    const savingsResult = strategy.evaluateDaily({
      date: '2026-10-01',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        bottomSniper: { isCritical: false }
      }
    });

    expect(savingsResult.status).toBe('EMERGENCY_SHIELD');
    expect(savingsResult.action).toBe('DCA_EMERGENCY_50_GOLD_50_CASH');
    expect(savingsResult.targetAllocationPct.GLD).toBe(50.0);
    expect(savingsResult.targetAllocationPct.CASH).toBe(50.0);
  });

  it('should trigger RE_ENTRY_RESET when bottomSniper fires critical panic capitulation during emergency', () => {
    // In Notfall versetzen
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: { katastrophenMatrix: { isShieldActive: true } }
    });

    // Markttiefpunkt wird vom Bottom-Sniper detektiert
    const reEntryResult = strategy.evaluateDaily({
      date: '2026-09-20',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        bottomSniper: { isCritical: true, status: 'CRITICAL' }
      }
    });

    expect(reEntryResult.status).toBe('RE_ENTRY_RESET');
    expect(reEntryResult.action).toBe('REINVEST_TARGET_ALLOCATION');
    expect(reEntryResult.targetAllocationPct).toEqual({
      SPY: 80.0,
      DFNS: 15.0,
      BTC: 5.0,
      GLD: 0.0,
      CASH: 0.0
    });
    expect(reEntryResult.reason).toContain('Panik-Boden Sniper');
  });

  it('should lock re-entry when shield deactivates before minHoldingPeriodDays (Anti-Whipsaw Hysterese)', () => {
    // In Notfall versetzen (Tag 1)
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: { katastrophenMatrix: { isShieldActive: true } }
    });

    // An Tag 2 schaltet Shield scheinbar ab, aber Mindesthaltedauer (15 Tage) ist nicht erreicht!
    const prematureResult = strategy.evaluateDaily({
      date: '2026-09-14',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: false },
        bottomSniper: { isCritical: false }
      }
    });

    // Bleibt verriegelt im Schutzschild!
    expect(prematureResult.status).toBe('EMERGENCY_SHIELD');
    expect(prematureResult.action).toBe('HOLD_EMERGENCY_HEDGE');
    expect(prematureResult.reason).toContain('Anti-Whipsaw-Hysterese');
  });

  it('should trigger RE_ENTRY_RESET when katastrophenMatrix deactivates shield after minHoldingPeriodDays', () => {
    // In Notfall versetzen
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: { katastrophenMatrix: { isShieldActive: true } }
    });

    // 15 Tage im Notfall simulieren
    strategy.daysInEmergency = 15;

    // Entwarnung: Schild deaktiviert nach Ablauf der Mindesthaltedauer
    const resetResult = strategy.evaluateDaily({
      date: '2026-09-28',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: false, status: 'NORMAL' },
        bottomSniper: { isCritical: false }
      }
    });

    expect(resetResult.status).toBe('RE_ENTRY_RESET');
    expect(resetResult.action).toBe('REINVEST_TARGET_ALLOCATION');
    expect(resetResult.targetAllocationPct.SPY).toBe(80.0);
    expect(resetResult.targetAllocationPct.DFNS).toBe(15.0);
    expect(resetResult.targetAllocationPct.BTC).toBe(5.0);
    expect(strategy.cooldownDays).toBe(20);
  });

  it('should suppress immediate re-triggers during cooldown period after re-entry', () => {
    // Re-Entry simulieren
    strategy.currentStatus = 'NORMAL_HODL';
    strategy.cooldownDays = 10;

    // Plötzlicher erneuter Katastrophen-Alarm während Cooldown
    const churnResult = strategy.evaluateDaily({
      date: '2026-10-05',
      macroSignalContext: {
        katastrophenMatrix: { isShieldActive: true },
        bottomSniper: { isCritical: false }
      }
    });

    // Fehlausstieg wird unterdrückt!
    expect(churnResult.status).toBe('NORMAL_HODL');
    expect(churnResult.action).toBe('HODL');
    expect(churnResult.reason).toContain('Anti-Whipsaw Cooldown aktiv');
  });

  it('should generate valid standardized snapshot via getSnapshot()', () => {
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: { katastrophenMatrix: { isShieldActive: false } }
    });

    const snapshot = strategy.getSnapshot('2026-09-13');
    expect(snapshot.strategy_id).toBe('SATELITE');
    expect(snapshot.status).toBe('NORMAL_HODL');
    expect(snapshot.action).toBe('HODL');
    expect(snapshot.targetAllocationPct).toEqual({
      SPY: 80.0,
      DFNS: 15.0,
      BTC: 5.0,
      GLD: 0.0,
      CASH: 0.0
    });
  });

  it('should reset internal state back to NORMAL_HODL via resetState()', () => {
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: { katastrophenMatrix: { isShieldActive: true } }
    });
    expect(strategy.currentStatus).toBe('EMERGENCY_SHIELD');

    strategy.resetState();
    expect(strategy.currentStatus).toBe('NORMAL_HODL');
    expect(strategy.daysInEmergency).toBe(0);
    expect(strategy.cooldownDays).toBe(0);
    expect(strategy.lastEvaluation).toBeNull();
  });

  it('should park 5% BTC in CASH when cryptoHub enters BEAR_REGIME or BULL_CRITICAL during normal market', () => {
    const res = strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        macroStressHub: { status: 'OK', regime: 'NORMAL_EXPANSION', isShieldActive: false },
        cryptoHub: { status: 'CRITICAL', regime: 'BEAR_REGIME' }
      }
    });

    expect(res.status).toBe('BTC_HEDGE_CASH');
    expect(res.action).toBe('EVACUATE_BTC_TO_CASH');
    expect(res.targetAllocationPct).toEqual({
      SPY: 80.0,
      DFNS: 15.0,
      BTC: 0.0,
      GLD: 0.0,
      CASH: 5.0
    });
    expect(res.reason).toContain('Krypto-Airbag aktiv');
  });

  it('should lock crypto re-entry before minBtcHedgeDays (Anti-Whipsaw Hysterese)', () => {
    // Tag 1: Krypto-Winter
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        macroStressHub: { status: 'OK', regime: 'NORMAL_EXPANSION', isShieldActive: false },
        cryptoHub: { status: 'CRITICAL', regime: 'BEAR_REGIME' }
      }
    });
    expect(strategy.currentStatus).toBe('BTC_HEDGE_CASH');

    // Tag 2: MSTR / Krypto dreht vorzeitig scheinbar wieder auf Bull
    const prematureRes = strategy.evaluateDaily({
      date: '2026-09-14',
      macroSignalContext: {
        macroStressHub: { status: 'OK', regime: 'NORMAL_EXPANSION', isShieldActive: false },
        cryptoHub: { status: 'OK', regime: 'BULL_EXPANSION' }
      }
    });

    // Bleibt in Cash verriegelt (Anti-Whipsaw Dämpfer)
    expect(prematureRes.status).toBe('BTC_HEDGE_CASH');
    expect(prematureRes.action).toBe('HOLD_BTC_IN_CASH');
    expect(prematureRes.reason).toContain('Krypto-Airbag Hysterese aktiv');
    expect(strategy.daysInBtcHedge).toBe(2);
  });

  it('should reinvest 5% Cash back into BTC when cryptoHub returns to BULL_EXPANSION after minBtcHedgeDays', () => {
    // Tag 1: Krypto-Winter
    strategy.evaluateDaily({
      date: '2026-09-13',
      macroSignalContext: {
        macroStressHub: { status: 'OK', regime: 'NORMAL_EXPANSION', isShieldActive: false },
        cryptoHub: { status: 'CRITICAL', regime: 'BEAR_REGIME' }
      }
    });
    expect(strategy.currentStatus).toBe('BTC_HEDGE_CASH');

    // 10 Tage im Krypto-Hedge simulieren
    strategy.daysInBtcHedge = 10;

    // Tag 11: Krypto dreht nach Ablauf der Hysterese wieder auf Bull
    const bullRes = strategy.evaluateDaily({
      date: '2026-09-24',
      macroSignalContext: {
        macroStressHub: { status: 'OK', regime: 'NORMAL_EXPANSION', isShieldActive: false },
        cryptoHub: { status: 'OK', regime: 'BULL_EXPANSION' }
      }
    });

    expect(bullRes.status).toBe('NORMAL_HODL');
    expect(bullRes.action).toBe('REINVEST_BTC_SATELLITE');
    expect(bullRes.targetAllocationPct).toEqual({
      SPY: 80.0,
      DFNS: 15.0,
      BTC: 5.0,
      GLD: 0.0,
      CASH: 0.0
    });
    expect(bullRes.reason).toContain('Krypto-Taktgeber wieder bullisch und Mindestverweildauer erfüllt');
    expect(strategy.daysInBtcHedge).toBe(0);
  });
});
