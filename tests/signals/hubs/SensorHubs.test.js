import { describe, it, expect } from 'vitest';
import { CryptoSensorHub } from '../../../src/signals/hubs/CryptoSensorHub.js';
import { MacroStressSensorHub } from '../../../src/signals/hubs/MacroStressSensorHub.js';
import { LiquiditySensorHub } from '../../../src/signals/hubs/LiquiditySensorHub.js';
import { MarketBottomSensorHub } from '../../../src/signals/hubs/MarketBottomSensorHub.js';
import { SignalStatus, CryptoRegime, MacroStressRegime, LiquidityRegime, BottomRegime } from '../../../src/signals/contracts/SignalTypes.js';

describe('Sensor Hubs (Composites)', () => {
  describe('CryptoSensorHub', () => {
    it('should return BULL_EXPANSION when MSTR and BTC are both above trend', () => {
      const hub = new CryptoSensorHub();
      const timeline = Array(205).fill(0).map((_, i) => ({
        assets: {
          MSTR: 150,
          BTC: 65000
        }
      }));

      const res = hub.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.OK);
      expect(res.regime).toBe(CryptoRegime.BULL_EXPANSION);
    });

    it('should return BULL_CRITICAL on fresh MSTR death cross', () => {
      const hub = new CryptoSensorHub();
      const timeline = Array(205).fill(0).map((_, i) => ({
        assets: {
          MSTR: i === 204 ? 80 : 120,
          BTC: 65000
        }
      }));

      const res = hub.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.CRITICAL);
      expect(res.regime).toBe(CryptoRegime.BULL_CRITICAL);
      expect(res.message).toContain('MSTR verliert heute die 200-Tage-Linie');
    });

    it('should return CYCLE_BOTTOM_CLOSE when bottomSignal is critical', () => {
      const hub = new CryptoSensorHub();
      const timeline = Array(205).fill(0).map(() => ({ assets: { MSTR: 80, BTC: 30000 } }));
      const res = hub.evaluate(timeline, { bottomSignal: { status: SignalStatus.CRITICAL, isCritical: true } });
      expect(res.regime).toBe(CryptoRegime.CYCLE_BOTTOM_CLOSE);
    });
  });

  describe('MarketBottomSensorHub', () => {
    it('should confirm capitulation when VIX >= 35 and DarkPool >= 48%', () => {
      const hub = new MarketBottomSensorHub();
      const timeline = [{ assets: { VIX: 38.0, DIX: 49.5 } }];
      const res = hub.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.CRITICAL);
      expect(res.regime).toBe(BottomRegime.CAPITULATION_CONFIRMED);
      expect(res.isCritical).toBe(true);
    });

    it('should report BOTTOM_FORMING when only one of the two triggers', () => {
      const hub = new MarketBottomSensorHub();
      const timeline = [{ assets: { VIX: 36.0, DIX: 42.0 } }];
      const res = hub.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.WARNING);
      expect(res.regime).toBe(BottomRegime.BOTTOM_FORMING);
      expect(res.isCritical).toBe(false);
    });
  });

  describe('MacroStressSensorHub', () => {
    it('should return NORMAL_EXPANSION when SPY is healthy', () => {
      const hub = new MacroStressSensorHub();
      const timeline = Array(260).fill(0).map(() => ({
        assets: { SPY: 550, VIX: 16 }
      }));
      const res = hub.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.OK);
      expect(res.regime).toBe(MacroStressRegime.NORMAL_EXPANSION);
      expect(res.isShieldActive).toBe(false);
    });

    it('should return SYSTEMIC_STRESS when Chart Break and VIX shock coincide', () => {
      const hub = new MacroStressSensorHub();
      const timeline = Array(260).fill(0).map((_, i) => ({
        assets: {
          SPY: i === 259 ? 450 : 520, // > 8% Drawdown and below SMA
          VIX: i === 259 ? 31.0 : 18.0 // VIX Shock >= 28
        }
      }));
      const res = hub.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.CRITICAL);
      expect(res.regime).toBe(MacroStressRegime.SYSTEMIC_STRESS);
      expect(res.isShieldActive).toBe(true);
    });

    it('should return LIQUIDATION_CASCADE when Drawdown reaches <= -18%', () => {
      const hub = new MacroStressSensorHub();
      const timeline = Array(260).fill(0).map((_, i) => ({
        assets: {
          SPY: i === 259 ? 400 : 500, // 20% Drawdown
          VIX: 26.0
        }
      }));
      const res = hub.evaluate(timeline);
      expect(res.regime).toBe(MacroStressRegime.LIQUIDATION_CASCADE);
      expect(res.isMarginCallZone).toBe(true);
    });
  });

  describe('LiquiditySensorHub', () => {
    it('should preserve temporal projection (TTC Days and projectedCollision)', () => {
      const hub = new LiquiditySensorHub();
      const timeline = Array(30).fill(0).map(() => ({
        macroGroups: {
          NetLiquidity: { BankReserves: 3500000, RRPONTSYD: 250, TGA: 600, WALCL: 7000 },
          BankingHealth: { BankReserves: 3500 },
          TreasuryCapacity: { GDP: 28000, THREEFYTP10: 0.5, USGSEC: 100 }
        }
      }));

      const res = hub.evaluate(timeline);
      expect(res.status).toBeDefined();
      expect(res.regime).toBeDefined();
      expect(res.ttcDays).toBeDefined();
      expect(res.projectedCollision).toBeDefined();
      expect(typeof res.projectedCollision).toBe('string');
      expect(res.catalystStatus).toBeDefined();
    });
  });
});
