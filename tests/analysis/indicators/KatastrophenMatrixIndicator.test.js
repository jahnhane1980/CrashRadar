import { describe, it, expect } from 'vitest';
import { KatastrophenMatrixIndicator } from '../../../src/analysis/indicators/KatastrophenMatrixIndicator.js';

describe('KatastrophenMatrixIndicator', () => {
  const indicator = new KatastrophenMatrixIndicator();

  // Helper: Baut eine synthetische Timeline mit 250 Handelstagen
  const buildTimeline = (length = 250, customizer = null) => {
    const timeline = [];
    let basePrice = 400;

    for (let i = 0; i < length; i++) {
      // Normaler leichter Aufwärtstrend (400 -> 500)
      basePrice += 0.4;
      const day = {
        date: new Date(2025, 0, 1 + i).toISOString().split('T')[0],
        assets: {
          SPY: Number(basePrice.toFixed(2)),
          VIX: 16.0
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
    const resEmpty = indicator.evaluate([]);
    expect(resEmpty.status).toBe('UNKNOWN');
    expect(resEmpty.isShieldActive).toBe(false);

    const resShort = indicator.evaluate(buildTimeline(199));
    expect(resShort.status).toBe('UNKNOWN');
    expect(resShort.message).toContain('Zu wenig Daten');
  });

  it('should return UNKNOWN if benchmark price is missing or invalid', () => {
    const timeline = buildTimeline(210, (day, i, len) => {
      if (i === len - 1) day.assets.SPY = null;
    });
    const res = indicator.evaluate(timeline);
    expect(res.status).toBe('UNKNOWN');
    expect(res.message).toContain('Fehlender oder ungültiger Preis');
  });

  it('should return OK and NONE signal in a healthy bull market', () => {
    const timeline = buildTimeline(250);
    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('OK');
    expect(res.signal).toBe('NONE');
    expect(res.isShieldActive).toBe(false);
    expect(res.chartBreak).toBe(false);
    expect(res.activePillars).toHaveLength(0);
    expect(res.message).toContain('Normalbetrieb');
  });

  it('should return WARNING (MONITOR) and NOT trigger evacuation during a healthy correction without macro alarm', () => {
    // Simulation: SPY fällt an den letzten Tagen unter SMA 200 (-9.0% DD),
    // aber VIX, CFI, NetLiq und MarginDebt bleiben alle GRÜN
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i >= len - 10) {
        // Starker Preisabfall unter SMA 200
        day.assets.SPY = 380; // Peak war ~496 -> DD ist ca. -23%
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('WARNING');
    expect(res.signal).toBe('MONITOR');
    expect(res.isShieldActive).toBe(false);
    expect(res.chartBreak).toBe(true);
    expect(res.activePillars).toHaveLength(0);
    expect(res.message).toContain('KORREKTUR-MODUS');
    expect(res.message).toContain('alle Makro-Säulen sind GRÜN');
  });

  it('should return WARNING (MONITOR) when Macro is RED but Chart trend is still intact', () => {
    // VIX springt auf 32, aber SPY bleibt stabil im Aufwärtstrend über SMA 200
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i === len - 1) {
        day.assets.VIX = 32.5;
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('WARNING');
    expect(res.signal).toBe('MONITOR');
    expect(res.isShieldActive).toBe(false);
    expect(res.chartBreak).toBe(false);
    expect(res.activePillars).toHaveLength(1);
    expect(res.activePillars[0]).toContain('Säule A: VIX Panik-Schock');
    expect(res.message).toContain('MAKRO-ALARM');
  });

  it('should trigger CRITICAL and ALLOCATE_GOLD on Säule A (VIX >= 28 + Chart Break)', () => {
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i >= len - 5) {
        day.assets.SPY = 380; // Chart-Bruch: unter SMA 200 & DD > 8%
        day.assets.VIX = 31.2; // Säule A aktiv
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('CRITICAL');
    expect(res.signal).toBe('ALLOCATE_GOLD');
    expect(res.isShieldActive).toBe(true);
    expect(res.chartBreak).toBe(true);
    expect(res.activePillars.some(p => p.includes('Säule A: VIX Panik-Schock'))).toBe(true);
    expect(res.message).toContain('KATASTROPHEN-ALARM AKTIV');
  });

  it('should trigger CRITICAL and ALLOCATE_GOLD on Säule B (Kreditstress CFI > -0.20 + Chart Break)', () => {
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i >= len - 5) {
        day.assets.SPY = 380; // Chart-Bruch
        day.assets.VIX = 22.0; // VIX normal
        day.macroGroups.FinancialConditions.ChicagoFedIndex = -0.05; // Säule B aktiv (> -0.20)
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('CRITICAL');
    expect(res.signal).toBe('ALLOCATE_GOLD');
    expect(res.isShieldActive).toBe(true);
    expect(res.activePillars.some(p => p.includes('Säule B: Kreditstress ChicagoFedIndex'))).toBe(true);
  });

  it('should trigger CRITICAL and ALLOCATE_GOLD on Säule C (Net Liquidity 8W Delta < -5% + Chart Break)', () => {
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i >= len - 5) {
        day.assets.SPY = 380; // Chart-Bruch
        day.assets.VIX = 20.0;
        // Net Liquidity von 6000 auf 5500 fallen lassen (Δ = -8.3% < -5.0%)
        day.macroGroups.NetLiquidity.WALCL = 6500;
        day.macroGroups.NetLiquidity.TGA = 500;
        day.macroGroups.NetLiquidity.RRPONTSYD = 500; // NetLiq = 5500 vs. vorher 6000
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('CRITICAL');
    expect(res.signal).toBe('ALLOCATE_GOLD');
    expect(res.isShieldActive).toBe(true);
    expect(res.activePillars.some(p => p.includes('Säule C: NetLiq 8W-Entzug'))).toBe(true);
  });

  it('should maintain anti-whipsaw hysteresis for 15 days even if SPY temporarily bounces', () => {
    // Tag len - 10: Alarm löst aus (SPY Crash + VIX 35)
    // Tag len - 5 bis len - 1: SPY bounced kurz nach oben über SMA 200, VIX fällt auf 20
    // Da erst 10 Tage vergangen sind (< 15 Tage), MUSS der Schutzschirm AKTIV bleiben!
    const timeline = buildTimeline(250, (day, i, len) => {
      if (i === len - 10) {
        day.assets.SPY = 370;
        day.assets.VIX = 35.0;
      } else if (i > len - 10 && i < len - 5) {
        day.assets.SPY = 380;
        day.assets.VIX = 29.0;
      } else if (i >= len - 5) {
        // Scheinerholung: SPY über SMA 200 & VIX ruhig
        day.assets.SPY = 550;
        day.assets.VIX = 18.0;
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('CRITICAL');
    expect(res.signal).toBe('ALLOCATE_GOLD');
    expect(res.isShieldActive).toBe(true);
    expect(res.isHysteresisActive).toBe(true);
    expect(res.daysInAlarm).toBeGreaterThanOrEqual(9);
    expect(res.message).toContain('Anti-Whipsaw Hysterese');
  });

  it('should deactivate shield once hysteresis (15 days) has elapsed AND market conditions recover', () => {
    // Alarm hat vor 25 Tagen ausgelöst (len - 25).
    // Die letzten 20 Tage waren komplett gesund (SPY > SMA 200, VIX 16, keine Makro-Alarme).
    const timeline = buildTimeline(260, (day, i, len) => {
      if (i === len - 25) {
        day.assets.SPY = 360;
        day.assets.VIX = 35.0;
      } else if (i > len - 25 && i < len - 20) {
        day.assets.SPY = 370;
        day.assets.VIX = 30.0;
      } else if (i >= len - 20) {
        // Vollständige Erholung seit 20 Tagen (> 15 Tage Hysterese)
        day.assets.SPY = 520 + (i - (len - 20));
        day.assets.VIX = 15.0;
      }
    });

    const res = indicator.evaluate(timeline);

    expect(res.status).toBe('OK');
    expect(res.signal).toBe('NONE');
    expect(res.isShieldActive).toBe(false);
    expect(res.isHysteresisActive).toBe(false);
    expect(res.message).toContain('Normalbetrieb');
  });
});
