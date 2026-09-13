import { describe, it, expect } from 'vitest';
import { PortfolioStrategyInterface } from '../../src/strategies/PortfolioStrategyInterface.js';

describe('PortfolioStrategyInterface', () => {
  // Eine gültige Mock-Strategie, die den Kontrakt erfüllt
  class MockValidStrategy extends PortfolioStrategyInterface {
    getId() {
      return 'MOCK_STRATEGY';
    }

    getName() {
      return 'Mock Strategy for Testing';
    }

    getVersion() {
      return '1.2.0';
    }

    evaluateDaily(context) {
      return { status: 'OK', date: context.date };
    }

    getSnapshot(date) {
      return { strategy_id: this.getId(), snapshot_date: date, status: 'ACTIVE' };
    }
  }

  it('should pass validation for a fully conforming strategy', () => {
    const strategy = new MockValidStrategy();
    expect(PortfolioStrategyInterface.validate(strategy)).toBe(true);
  });

  it('should throw when an invalid object or primitive is passed', () => {
    expect(() => PortfolioStrategyInterface.validate(null)).toThrow('gültiges Objekt');
    expect(() => PortfolioStrategyInterface.validate('string')).toThrow('gültiges Objekt');
  });

  it('should throw if any required method is missing', () => {
    const missingGetSnapshot = {
      getId: () => 'TEST',
      getName: () => 'Test',
      evaluateDaily: () => ({})
    };
    expect(() => PortfolioStrategyInterface.validate(missingGetSnapshot)).toThrow("Methode 'getSnapshot' fehlt");

    const missingEvaluateDaily = {
      getId: () => 'TEST',
      getName: () => 'Test',
      getSnapshot: () => ({})
    };
    expect(() => PortfolioStrategyInterface.validate(missingEvaluateDaily)).toThrow("Methode 'evaluateDaily' fehlt");
  });

  it('should throw if getId() returns empty or non-string', () => {
    const invalidId = {
      getId: () => '',
      getName: () => 'Test',
      evaluateDaily: () => ({}),
      getSnapshot: () => ({})
    };
    expect(() => PortfolioStrategyInterface.validate(invalidId)).toThrow('nicht-leeren String');
  });

  it('should throw on default base class method invocations if not overridden', () => {
    const baseInstance = new PortfolioStrategyInterface();
    expect(() => baseInstance.getId()).toThrow('getId() muss implementiert werden');
    expect(() => baseInstance.getName()).toThrow('getName() muss implementiert werden');
    expect(() => baseInstance.evaluateDaily({})).toThrow('evaluateDaily(context) muss');
    expect(() => baseInstance.getSnapshot('2026-09-13')).toThrow('getSnapshot(date) muss');
  });

  it('should successfully load existing manifests via loadManifest()', () => {
    const goldSpyManifest = PortfolioStrategyInterface.loadManifest('gold-spy');
    expect(goldSpyManifest).toBeDefined();
    expect(goldSpyManifest.id).toBe('GOLD_SPY');

    const kamikazeManifest = PortfolioStrategyInterface.loadManifest('kamikaze-growth');
    expect(kamikazeManifest).toBeDefined();
    expect(kamikazeManifest.id).toBe('KAMIKAZE_GROWTH');
  });

  it('should throw if manifest does not exist', () => {
    expect(() => PortfolioStrategyInterface.loadManifest('does-not-exist-xyz')).toThrow('Manifest-Datei nicht gefunden');
  });
});
