import { describe, it, expect } from 'vitest';
import { MstrLeadSensor } from '../../../src/signals/sensors/MstrLeadSensor.js';
import { BtcTrendSensor } from '../../../src/signals/sensors/BtcTrendSensor.js';
import { DarkPoolSensor } from '../../../src/signals/sensors/DarkPoolSensor.js';
import { VixShockSensor } from '../../../src/signals/sensors/VixShockSensor.js';
import { SpyTrendSensor } from '../../../src/signals/sensors/SpyTrendSensor.js';
import { CreditStressSensor } from '../../../src/signals/sensors/CreditStressSensor.js';
import { SignalStatus } from '../../../src/signals/contracts/SignalTypes.js';

describe('Atomic Sensors (Leafs)', () => {
  describe('MstrLeadSensor', () => {
    it('should detect when MSTR falls below SMA-200 (Death Cross)', () => {
      const sensor = new MstrLeadSensor();
      const timeline = Array(205).fill(0).map((_, i) => ({
        assets: { MSTR: i === 204 ? 80 : 100 }
      }));

      const res = sensor.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.CRITICAL);
      expect(res.isFreshBreak).toBe(true);
      expect(res.isAboveSma200).toBe(false);
      expect(res.dropPct).toBeLessThan(0);
    });
  });

  describe('BtcTrendSensor', () => {
    it('should detect BULL when BTC is above 147d SMA', () => {
      const sensor = new BtcTrendSensor();
      const timeline = Array(150).fill(0).map((_, i) => ({
        assets: { BTC: i === 149 ? 70000 : 60000 }
      }));

      const res = sensor.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.OK);
      expect(res.trend).toBe('BULL');
    });
  });

  describe('DarkPoolSensor', () => {
    it('should trigger CRITICAL when DIX >= 48%', () => {
      const sensor = new DarkPoolSensor();
      const timeline = [{ assets: { DIX: 49.2 } }];
      const res = sensor.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.CRITICAL);
      expect(res.isWhaleBuying).toBe(true);
    });
  });

  describe('VixShockSensor', () => {
    it('should trigger CRITICAL when VIX >= 35 (Panik Climax)', () => {
      const sensor = new VixShockSensor();
      const timeline = [{ assets: { VIX: 38.5 } }];
      const res = sensor.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.CRITICAL);
      expect(res.isExtremePanic).toBe(true);
    });
  });

  describe('SpyTrendSensor', () => {
    it('should detect Chart Break when SPY < SMA200 and DD >= 8%', () => {
      const sensor = new SpyTrendSensor();
      const timeline = Array(260).fill(0).map((_, i) => ({
        assets: { SPY: i === 259 ? 450 : 500 }
      }));
      const res = sensor.evaluate(timeline);
      expect(res.isBelowSma200).toBe(true);
      expect(res.drawdownPct).toBeLessThanOrEqual(-8.0);
      expect(res.isChartBreak).toBe(true);
    });
  });

  describe('CreditStressSensor', () => {
    it('should detect credit stress when High Yield Spread > 4.0%', () => {
      const sensor = new CreditStressSensor();
      const timeline = [{ assets: { HighYieldSpread: 4.8 } }];
      const res = sensor.evaluate(timeline);
      expect(res.status).toBe(SignalStatus.CRITICAL);
      expect(res.isCreditStress).toBe(true);
    });
  });
});
