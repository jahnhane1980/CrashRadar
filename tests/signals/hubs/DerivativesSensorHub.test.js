import { describe, it, expect } from 'vitest';
import { DerivativesSensorHub } from '../../../src/signals/hubs/DerivativesSensorHub.js';
import { SignalStatus, DerivativesRegime } from '../../../src/signals/contracts/SignalTypes.js';

describe('DerivativesSensorHub (Composite)', () => {
  it('should return UNKNOWN for empty timeline', () => {
    const hub = new DerivativesSensorHub();
    const res = hub.evaluate([]);
    expect(res.status).toBe(SignalStatus.UNKNOWN);
    expect(res.regime).toBe(DerivativesRegime.UNKNOWN);
  });

  it('should detect EXTREME_SQUEEZE_COIL on 2026-09-14 with extreme PCR and Short Volume', () => {
    const hub = new DerivativesSensorHub();
    const timeline = [
      {
        date: '2026-09-14',
        assets: {
          TotalPCR: 1.61,
          SKEW: 154.5,
          SPY_ShortVolumeRatio: 0.647,
          VIX: 17.7
        }
      }
    ];

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.CRITICAL);
    expect(res.regime).toBe(DerivativesRegime.EXTREME_SQUEEZE_COIL);
    expect(res.isQuadrupleWitching).toBe(true);
    expect(res.daysToOpEx).toBe(4);
    expect(res.daysToVixSettlement).toBe(2);
    expect(res.message).toContain('MAXIMALE FEDERSPANNUNG');
    expect(res.guidance).toContain('Stop-Fishing');
  });

  it('should detect MILD_OPEX_PINNING during OpEx week with neutral sentiment', () => {
    const hub = new DerivativesSensorHub();
    const timeline = [
      {
        date: '2026-09-17',
        assets: {
          TotalPCR: 0.82,
          SKEW: 122.0,
          SPY_ShortVolumeRatio: 0.46,
          VIX: 15.0
        }
      }
    ];

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.WARNING);
    expect(res.regime).toBe(DerivativesRegime.MILD_OPEX_PINNING);
    expect(res.message).toContain('Max-Pain');
  });

  it('should detect VOL_CRUSH_REBOUND on VIX-Settlement Wednesday (2026-09-16)', () => {
    const hub = new DerivativesSensorHub();
    const timeline = [
      {
        date: '2026-09-16',
        assets: {
          TotalPCR: 1.10,
          SKEW: 130.0,
          SPY_ShortVolumeRatio: 0.50,
          VIX: 16.2
        }
      }
    ];

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.CRITICAL);
    expect(res.regime).toBe(DerivativesRegime.VOL_CRUSH_REBOUND);
    expect(res.guidance).toContain('Das Angst-Ventil öffnet sich');
  });

  it('should detect POST_OPEX_EXPANSION on Monday after OpEx (2026-09-21)', () => {
    const hub = new DerivativesSensorHub();
    const timeline = [
      {
        date: '2026-09-21',
        assets: {
          TotalPCR: 0.90,
          SKEW: 125.0,
          SPY_ShortVolumeRatio: 0.48,
          VIX: 14.8
        }
      }
    ];

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.OK);
    expect(res.regime).toBe(DerivativesRegime.POST_OPEX_EXPANSION);
    expect(res.guidance).toContain('Gamma-Fessel weg');
  });

  it('should return NEUTRAL_FLOW on normal trading days outside OpEx windows', () => {
    const hub = new DerivativesSensorHub();
    const timeline = [
      {
        date: '2026-09-01',
        assets: {
          TotalPCR: 0.85,
          SKEW: 120.0,
          SPY_ShortVolumeRatio: 0.47,
          VIX: 15.5
        }
      }
    ];

    const res = hub.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.OK);
    expect(res.regime).toBe(DerivativesRegime.NEUTRAL_FLOW);
  });
});
