import { describe, it, expect } from 'vitest';
import { GoldSniperIndicator } from '../../../src/analysis/indicators/GoldSniperIndicator.js';

describe('GoldSniperIndicator', () => {
  const indicator = new GoldSniperIndicator();

  // Helper: Baut eine synthetische 260-Tage Timeline
  const buildTimeline = (length = 260, customizer = null) => {
    const timeline = [];
    let spy = 400;
    let gld = 180;

    for (let i = 0; i < length; i++) {
      spy += 0.4; // SPY klettert von 400 auf ~504
      gld += 0.05; // Gold leicht aufwärts

      const day = {
        date: new Date(2025, 0, 1 + i).toISOString().split('T')[0],
        assets: {
          SPY: Number(spy.toFixed(2)),
          GLD: Number(gld.toFixed(2)),
          VIX: 16.0,
          CBOE_SPY: 1000
        },
        macroGroups: {
          FinancialConditions: {
            ChicagoFedIndex: -0.55
          },
          NetLiquidity: {
            WALCL: 7000,
            TGA: 500,
            RRPONTSYD: 500
          },
          Leading: {
            MarginDebt: 500000 + i * 100
          }
        }
      };

      if (customizer) {
        customizer(day, i, length);
      }

      timeline.push(day);
    }
    return timeline;
  };

  it('should return UNKNOWN if timeline has fewer than 200 days', () => {
    const res = indicator.evaluate([]);
    expect(res.status).toBe('UNKNOWN');
    expect(res.signal).toBe('NONE');
    expect(res.state).toBe('NORMAL');

    const resShort = indicator.evaluate(buildTimeline(199));
    expect(resShort.status).toBe('UNKNOWN');
  });

  it('should return UNKNOWN if benchmark price is missing or invalid', () => {
    const timeline = buildTimeline(220, (day, i, len) => {
      if (i === len - 1) day.assets.SPY = null;
    });
    const res = indicator.evaluate(timeline);
    expect(res.status).toBe('UNKNOWN');
    expect(res.message).toContain('Fehlender oder ungültiger Preis');
  });

  it('should return NORMAL state with signal NONE in healthy bull regime', () => {
    const timeline = buildTimeline(250);
    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('OK');
    expect(res.state).toBe('NORMAL');
    expect(res.signal).toBe('NONE');
    expect(res.isGoldHedgeActive).toBe(false);
    expect(res.isCashLockActive).toBe(false);
    expect(res.message).toContain('Normalbetrieb');
  });

  it('should transition to HEDGE_ACTIVE with signal ALLOCATE_GOLD when Katastrophen-Matrix triggers', () => {
    // Tag len - 5: SPY bricht ein auf 380 (Peak war ~500 -> DD -24%, unter SMA 200) + VIX 30
    // SPY DD ist bei -10% bis -15%, Gold steigt
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i >= len - 5) {
        day.assets.SPY = 445; // Peak ~500 -> DD -11% (noch vor -18% Exit!)
        day.assets.VIX = 30.0; // VIX Schock-Panik
        day.assets.GLD = 195.0; // Gold gewinnt an Wert
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('CRITICAL');
    expect(res.state).toBe('HEDGE_ACTIVE');
    expect(res.signal).toBe('ALLOCATE_GOLD');
    expect(res.isGoldHedgeActive).toBe(true);
    expect(res.isCashLockActive).toBe(false);
    expect(res.daysInHedge).toBe(5);
    expect(res.message).toContain('GOLD-HEDGE AKTIV');
  });

  it('should transition to PRE_MARGIN_LOCK and fire EXIT_GOLD_TO_CASH when SPY drawdown reaches -18.0%', () => {
    // Tag len - 10 bis len - 2: SPY bei -12% DD (Hedge aktiv, GLD steigt auf 200)
    // Tag len - 1: SPY fällt genau auf -18.5% DD -> EXIT_GOLD_TO_CASH!
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i >= len - 10 && i < len - 1) {
        day.assets.SPY = 430; // DD ca. -14%
        day.assets.VIX = 32.0;
        day.assets.GLD = 200.0;
      } else if (i === len - 1) {
        day.assets.SPY = 405; // Peak war ~500 -> DD ca. -19.0%
        day.assets.VIX = 35.0;
        day.assets.GLD = 205.0; // Schönes Plus im Gold
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('CRITICAL');
    expect(res.state).toBe('PRE_MARGIN_LOCK');
    expect(res.signal).toBe('EXIT_GOLD_TO_CASH');
    expect(res.isCashLockActive).toBe(true);
    expect(res.isGoldHedgeActive).toBe(false);
    expect(res.goldExitDate).toBe(timeline[timeline.length - 1].date);
    expect(res.message).toContain('PRE-MARGIN-CALL GEWINNSICHERUNG');
  });

  it('should fire HOLD_CASH on subsequent days in PRE_MARGIN_LOCK before -20%', () => {
    // Tag len - 2: Exit ausgelöst bei -18.5%
    // Tag len - 1: Immer noch zwischen -18% und -20% -> HOLD_CASH
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i >= len - 5 && i < len - 2) {
        day.assets.SPY = 430; // DD ca. -14%
        day.assets.VIX = 30.0;
      } else if (i === len - 2) {
        day.assets.SPY = 405; // DD -19.0% -> Exit Tag
        day.assets.VIX = 33.0;
      } else if (i === len - 1) {
        day.assets.SPY = 403; // DD -19.4% (noch > -20%)
        day.assets.VIX = 34.0;
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('CRITICAL');
    expect(res.state).toBe('PRE_MARGIN_LOCK');
    expect(res.signal).toBe('HOLD_CASH');
    expect(res.isCashLockActive).toBe(true);
  });

  it('should transition to MARGIN_CALL_ACTIVE and signal HOLD_CASH when SPY drawdown exceeds -20.0%', () => {
    // SPY crasht auf -22.0% DD
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i >= len - 6 && i < len - 2) {
        day.assets.SPY = 430; // DD ca. -14%
        day.assets.VIX = 30.0;
      } else if (i === len - 2) {
        day.assets.SPY = 405; // DD -19.0% -> Exit Tag
        day.assets.VIX = 35.0;
      } else if (i === len - 1) {
        day.assets.SPY = 385; // Peak ~500 -> DD -23.0% (Margin-Call Schwelle <= -20% unterschritten!)
        day.assets.VIX = 42.0;
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('CRITICAL');
    expect(res.state).toBe('MARGIN_CALL_ACTIVE');
    expect(res.signal).toBe('HOLD_CASH');
    expect(res.isMarginCallActive).toBe(true);
    expect(res.isCashLockActive).toBe(true);
    expect(res.message).toContain('MARGIN-CALL KASKADE AKTIV');
  });

  it('should transition to RE_ENTRY and fire DEPLOY_CASH when Bottom Sniper triggers', () => {
    // Simulation: Mocken/Vorgeben von panicCapitulation CRITICAL am letzten Tag
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i >= len - 10 && i < len - 2) {
        day.assets.SPY = 430;
        day.assets.VIX = 30.0;
      } else if (i >= len - 2) {
        day.assets.SPY = 385; // Im Crash
        day.assets.VIX = 45.0;
      }
    });

    // Wir übergeben ein vorkalkuliertes Signal für den Bottom Sniper
    const res = indicator.evaluate(timeline, {
      panicCapitulation: {
        status: 'CRITICAL',
        message: 'GENERATIONEN-KAUFSIGNAL! Extremer Panik-Climax bestätigt.'
      }
    });

    expect(res.status).toBe('CRITICAL');
    expect(res.state).toBe('RE_ENTRY');
    expect(res.signal).toBe('DEPLOY_CASH');
    expect(res.isBottomSniperActive).toBe(true);
    expect(res.message).toContain('GENERATIONEN-BODEN SNIPER');
  });

  it('should reset cleanly to NORMAL when Katastrophen-Matrix deactivates after recovery', () => {
    // Vor 25 Tagen war ein Crash, aber seit 20 Tagen ist der Markt voll erholt über SMA 200
    const timeline = buildTimeline(260, (day, i, len) => {
      if (i === len - 25) {
        day.assets.SPY = 360;
        day.assets.VIX = 35.0;
      } else if (i > len - 25 && i < len - 20) {
        day.assets.SPY = 370;
        day.assets.VIX = 28.0;
      } else if (i >= len - 20) {
        // Erholung
        day.assets.SPY = 520 + (i - (len - 20));
        day.assets.VIX = 15.0;
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('OK');
    expect(res.state).toBe('NORMAL');
    expect(res.signal).toBe('NONE');
    expect(res.isGoldHedgeActive).toBe(false);
    expect(res.isCashLockActive).toBe(false);
    expect(res.isMarginCallActive).toBe(false);
    expect(res.message).toContain('Normalbetrieb');
  });
});
