import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorRegistry } from '../../src/core/ErrorRegistry.js';

describe('ErrorRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sollte initial leer sein', () => {
    const registry = new ErrorRegistry();
    expect(registry.hasErrors()).toBe(false);
    expect(registry.hasWarnings()).toBe(false);
    expect(registry.errors.length).toBe(0);
  });

  it('sollte Fehler als Error-Objekt oder String aufnehmen', () => {
    const registry = new ErrorRegistry();
    registry.addError('Task1', new Error('API Timeout'));
    registry.addError('Task2', 'String Error');

    expect(registry.hasErrors()).toBe(true);
    expect(registry.errors).toEqual([
      { context: 'Task1', message: 'API Timeout' },
      { context: 'Task2', message: 'String Error' }
    ]);
  });

  it('sollte Warnungen aufnehmen', () => {
    const registry = new ErrorRegistry();
    registry.addWarning('Parser', 'Skipped empty line');

    expect(registry.hasWarnings()).toBe(true);
    expect(registry.warnings).toEqual([
      { context: 'Parser', message: 'Skipped empty line' }
    ]);
  });

  it('sollte eine korrekte Zusammenfassung (Summary) generieren', () => {
    const registry = new ErrorRegistry();
    
    // Simulate some time passed
    vi.setSystemTime(new Date('2026-07-23T10:00:05Z')); // 5 seconds later
    
    registry.addError('Fetcher', new Error('Timeout'));
    registry.addWarning('DB', 'Slow Query');

    const summary = registry.getSummary();
    
    expect(summary).toContain('Laufzeit: 5.0s');
    expect(summary).toContain('Fehler: 1 | Warnungen: 1');
    expect(summary).toContain('❌ FEHLER:\n- [Fetcher] Timeout');
    expect(summary).toContain('⚠️ WARNUNGEN:\n- [DB] Slow Query');
  });

  // --- EDGE CASES ---

  it('Edge Case: sollte mit null oder undefined nicht abstürzen, sondern stringifizieren', () => {
    const registry = new ErrorRegistry();
    registry.addError('TaskNull', null);
    registry.addError('TaskUndefined', undefined);

    expect(registry.hasErrors()).toBe(true);
    expect(registry.errors).toEqual([
      { context: 'TaskNull', message: 'null' },
      { context: 'TaskUndefined', message: 'undefined' }
    ]);
  });

  it('Edge Case: Summary formatting wenn NUR Warnungen existieren', () => {
    const registry = new ErrorRegistry();
    registry.addWarning('API', 'Rate Limit nähert sich');
    
    const summary = registry.getSummary();
    
    expect(summary).not.toContain('❌ FEHLER:');
    expect(summary).toContain('⚠️ WARNUNGEN:\n- [API] Rate Limit nähert sich');
  });

  it('Edge Case: Summary formatting wenn absolut keine Fehler oder Warnungen existieren (Happy Path)', () => {
    const registry = new ErrorRegistry();
    
    const summary = registry.getSummary();
    
    expect(summary).not.toContain('❌ FEHLER:');
    expect(summary).not.toContain('⚠️ WARNUNGEN:');
    expect(summary).toContain('Fehler: 0 | Warnungen: 0');
  });
});
