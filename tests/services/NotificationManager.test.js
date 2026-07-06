import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationManager } from '../../src/services/NotificationManager.js';

describe('NotificationManager', () => {
  let manager;
  let mockIndicators;
  let mockConfig;

  beforeEach(() => {
    mockIndicators = [
      {
        name: 'Mock Leading',
        category: 'LEADING',
        evaluate: vi.fn().mockReturnValue({ status: 'OK', value: 'Test', message: 'Alles gut' })
      },
      {
        name: 'Mock Trigger',
        category: 'TRIGGER',
        evaluate: vi.fn().mockReturnValue({ status: 'CRITICAL', value: '100', message: 'Krise!' })
      }
    ];

    mockConfig = {
      topics: {
        MACRO: { title: 'Makro Update', icon: 'earth_americas', priority: 'default' }
      },
      indicators: {
        'Mock Trigger': 'MACRO'
      }
    };

    manager = new NotificationManager(mockIndicators, mockConfig);
  });

  const generateData = () => {
    return [
      { 
          date: '2025-01-01', 
          mlRegimeSpy: { phase: 'UPTREND', confidence: 0.9 }, 
          mlRegimeQqq: { phase: 'BULL_MARKET', confidence: 0.8 }, 
          mlRegimeBtc: { phase: 'CYCLE_BOTTOM', confidence: 0.6 } 
      }
    ];
  };

  it('sollte einen sauberen Report generieren (cleanText = true)', () => {
    const data = generateData();
    const report = manager.generateReport(data, true);
    
    expect(report).toContain('MAKRO-FINANZ ANALYSE');
    expect(report).toContain('Mock Leading');
    expect(report).toContain('Mock Trigger');
    expect(report).toContain('[CRITICAL]');
    expect(report).toContain('[OK]');
  });

  it('sollte eine Exception werfen, wenn keine Daten übergeben werden bei generateReport', () => {
    expect(() => manager.generateReport([])).toThrow('Keine Daten für die Analyse vorhanden.');
    expect(() => manager.generateReport(null)).toThrow('Keine Daten für die Analyse vorhanden.');
  });

  it('sollte Alerts generieren und die History updaten', () => {
    const data = generateData();
    const result = manager.getAlerts(data, {}, 14);
    
    expect(result).not.toBeNull();
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].title).toBe('Makro Update');
    expect(result.notifications[0].priority).toBe('urgent');
    expect(result.updatedHistory['Mock Trigger_CRITICAL']).toBeDefined();
  });

  it('sollte DailyStatusReport generieren', () => {
    const data = generateData();
    const report = manager.getDailyStatusReport(data);
    
    expect(report).not.toBeNull();
    expect(report.title).toContain('CRITICAL');
    expect(report.message).toContain('🚨 Kritisch');
    expect(report.message).toContain('UPTREND (90.0%)');
  });

  it('sollte bei fehlenden ML-Regimen "UNKNOWN" anzeigen', () => {
    const data = [{ date: '2025-01-01' }]; // Keine ML-Daten
    const report = manager.getDailyStatusReport(data);
    expect(report.message).toContain('SPY: UNKNOWN');
    expect(report.message).toContain('QQQ: UNKNOWN');
  });

  it('sollte null zurückgeben bei getAlerts und getDailyStatusReport wenn Daten fehlen', () => {
    expect(manager.getAlerts([])).toBeNull();
    expect(manager.getAlerts(null)).toBeNull();
    expect(manager.getDailyStatusReport([])).toBeNull();
    expect(manager.getDailyStatusReport(null)).toBeNull();
  });

  it('sollte Debouncing (Spam-Schutz) anwenden und keine Benachrichtigung feuern', () => {
    const data = generateData();
    const history = {
      'Mock Trigger_CRITICAL': Date.now() - 1000 // Erst vor 1 Sekunde gesendet
    };
    
    const result = manager.getAlerts(data, history, 14); // 14 Tage Debounce
    
    // Er sollte den Trigger überspringen, es gibt keine anderen Alerts
    expect(result.notifications).toBeNull();
  });

  it('sollte den WARNING-Pfad und Fallback-Topics nutzen', () => {
    const warnIndicator = {
        name: 'Unbekannter Indikator',
        category: 'TRIGGER',
        evaluate: vi.fn().mockReturnValue({ status: 'WARNING', value: '10', message: 'Achtung' })
    };
    manager.indicators = [warnIndicator]; // Nur Warning
    
    const data = generateData();
    const result = manager.getAlerts(data, {}, 14);
    
    expect(result.notifications).toHaveLength(1);
    // Er fällt auf "MACRO" zurück, weil der Indikator nicht in notificationConfig.indicators ist
    expect(result.notifications[0].title).toBe('Makro Update');
    expect(result.notifications[0].priority).toBe('high');
  });

  it('sollte null Benachrichtigungen liefern, wenn alles OK ist', () => {
    manager.indicators = [
        { name: 'Mock', category: 'LEADING', evaluate: vi.fn().mockReturnValue({ status: 'OK' }) }
    ];
    const data = generateData();
    const result = manager.getAlerts(data, {}, 14);
    expect(result.notifications).toBeNull();
  });

  it('sollte nicht abstürzen, wenn die config komplett null/leer ist', () => {
    const emptyManager = new NotificationManager(mockIndicators, null);
    const data = generateData();
    const result = emptyManager.getAlerts(data, {}, 14);
    expect(result.notifications).toBeDefined();
    // Fallback topic title will be CrashRadar: MACRO
    expect(result.notifications[0].title).toBe('CrashRadar: MACRO');
  });

  it('sollte einen defekten Indikator abfangen (try-catch) ohne abzustürzen', () => {
    const brokenIndicator = {
        name: 'Broken Indikator',
        category: 'TRIGGER',
        evaluate: vi.fn().mockImplementation(() => { throw new Error('API down'); })
    };
    manager.indicators.push(brokenIndicator);
    
    const data = generateData();
    
    // generateReport sollte ihn als UNKNOWN/ERROR listen
    const report = manager.generateReport(data, true);
    expect(report).toContain('Broken Indikator');
    expect(report).toContain('ERROR -> Fehler bei der Auswertung (API down)');
    
    // getAlerts sollte den Fehler schlucken und den rest validieren
    const alerts = manager.getAlerts(data, {}, 14);
    expect(alerts.notifications).toHaveLength(1); // Der "Mock Trigger" feuert weiterhin erfolgreich!
    
    // getDailyStatusReport sollte nicht abstürzen
    const daily = manager.getDailyStatusReport(data);
    expect(daily.title).toContain('CRITICAL'); // Wegen Mock Trigger
  });
});
