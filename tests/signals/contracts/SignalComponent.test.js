import { describe, it, expect } from 'vitest';
import { SignalComponent } from '../../../src/signals/contracts/SignalComponent.js';
import { SignalStatus, CryptoRegime, MacroStressRegime, LiquidityRegime, BottomRegime } from '../../../src/signals/contracts/SignalTypes.js';

describe('SignalComponent & SignalTypes Contract', () => {
  class MockSensor extends SignalComponent {
    getId() {
      return 'MOCK_SENSOR';
    }
    getName() {
      return 'Mock Sensor';
    }
    evaluate(timeline) {
      return {
        status: SignalStatus.OK,
        regime: 'NORMAL',
        message: 'Mock evaluation OK'
      };
    }
  }

  it('should validate a correct SignalComponent implementation', () => {
    const sensor = new MockSensor();
    expect(SignalComponent.validate(sensor)).toBe(true);
    expect(sensor.getId()).toBe('MOCK_SENSOR');
    expect(sensor.getName()).toBe('Mock Sensor');
    expect(sensor.getComponentType()).toBe('SENSOR');
  });

  it('should throw error on incomplete implementations', () => {
    expect(() => SignalComponent.validate({})).toThrow("Methode 'getId' fehlt");
    expect(() => SignalComponent.validate({ getId: () => 'A' })).toThrow("Methode 'getName' fehlt");
    expect(() => SignalComponent.validate({ getId: () => 'A', getName: () => 'B' })).toThrow("Methode 'evaluate' fehlt");
    expect(() => SignalComponent.validate({ getId: () => '', getName: () => 'B', evaluate: () => {} })).toThrow('nicht-leeren String');
  });

  it('should export immutable and complete enums', () => {
    expect(SignalStatus.CRITICAL).toBe('CRITICAL');
    expect(CryptoRegime.BULL_CRITICAL).toBe('BULL_CRITICAL');
    expect(MacroStressRegime.SYSTEMIC_STRESS).toBe('SYSTEMIC_STRESS');
    expect(LiquidityRegime.CRITICAL_DRAIN).toBe('CRITICAL_DRAIN');
    expect(BottomRegime.CAPITULATION_CONFIRMED).toBe('CAPITULATION_CONFIRMED');

    // Immutability check
    expect(() => { SignalStatus.NEW_STATUS = 'FAIL'; }).toThrow();
  });
});
