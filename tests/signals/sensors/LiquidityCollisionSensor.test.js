import { describe, it, expect } from 'vitest';
import { LiquidityCollisionSensor } from '../../../src/signals/sensors/LiquidityCollisionSensor.js';
import { SignalComponent } from '../../../src/signals/contracts/SignalComponent.js';
import { SignalStatus } from '../../../src/signals/contracts/SignalTypes.js';

describe('LiquidityCollisionSensor (Leaf-Sensor)', () => {
  it('should pass SignalComponent contract validation', () => {
    const sensor = new LiquidityCollisionSensor();
    expect(SignalComponent.validate(sensor)).toBe(true);
    expect(sensor.getId()).toBe('LIQUIDITY_COLLISION_SENSOR');
    expect(sensor.getComponentType()).toBe('SENSOR');
  });

  it('should return UNKNOWN for empty or short timeline', () => {
    const sensor = new LiquidityCollisionSensor();
    const res = sensor.evaluate([]);
    expect(res.status).toBe(SignalStatus.UNKNOWN);
    expect(res.ttcDays).toBeNull();
  });

  it('should detect healthy liquidity slack when RRP and reserves are ample', () => {
    const sensor = new LiquidityCollisionSensor();
    const timeline = [];
    for (let i = 0; i < 25; i++) {
      timeline.push({
        date: `2026-09-${(i + 1).toString().padStart(2, '0')}`,
        macroGroups: {
          BankingHealth: { BankReserves: 3500 },
          NetLiquidity: { RRPONTSYD: 500, TGA: 750, WALCL: 7000 },
          TreasuryCapacity: { GDP: 28000 }
        }
      });
    }

    const res = sensor.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.OK);
    expect(res.liquidSlackBillion).toBeGreaterThan(500);
    expect(res.isCollisionImminent).toBe(false);
  });

  it('should trigger CRITICAL when Bank Reserves fall below LCLOR', () => {
    const sensor = new LiquidityCollisionSensor();
    const timeline = [];
    for (let i = 0; i < 25; i++) {
      timeline.push({
        date: `2026-09-${(i + 1).toString().padStart(2, '0')}`,
        macroGroups: {
          BankingHealth: { BankReserves: 2500 }, // LCLOR = 28000 * 0.105 = 2940 -> 2500 < 2940!
          NetLiquidity: { RRPONTSYD: 0, TGA: 750, WALCL: 7000 },
          TreasuryCapacity: { GDP: 28000 }
        }
      });
    }

    const res = sensor.evaluate(timeline);
    expect(res.status).toBe(SignalStatus.CRITICAL);
    expect(res.isBelowLclor).toBe(true);
    expect(res.isCollisionImminent).toBe(true);
  });
});
