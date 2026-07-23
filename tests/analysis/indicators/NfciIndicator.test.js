import { describe, it, expect } from 'vitest';
import { NfciIndicator } from '../../../src/analysis/indicators/NfciIndicator.js';

describe('NfciIndicator', () => {
    const indicator = new NfciIndicator();

    const buildTimeline = (chicagoFedIndexValue) => {
        return [{
            macroGroups: {
                FinancialConditions: {
                    ChicagoFedIndex: chicagoFedIndexValue
                }
            }
        }];
    };

    it('should have correct name and category', () => {
        expect(indicator.name).toBe('Chicago Fed Stress Index (NFCI)');
        expect(indicator.category).toBe('ACUTE_PANIC');
    });

    it('should return UNKNOWN if timeline is empty', () => {
        const result = indicator.evaluate([]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Zu wenig (oder ungültige) Daten');
    });

    it('should return UNKNOWN if ChicagoFedIndex is exactly null', () => {
        const result = indicator.evaluate(buildTimeline(null));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine Daten vorhanden');
    });

    it('should return CRITICAL if value > 0', () => {
        const result = indicator.evaluate(buildTimeline(0.5));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('0.50');
        expect(result.message).toBe('Akuter Stress im Finanzsystem (>0).');
    });

    it('should return OK if value < 0', () => {
        const result = indicator.evaluate(buildTimeline(-0.25));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('-0.25');
        expect(result.message).toBe('Kein Systemstress (<=0).');
    });

    it('should return OK if value === 0 (boundary)', () => {
        const result = indicator.evaluate(buildTimeline(0));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('0.00');
        expect(result.message).toBe('Kein Systemstress (<=0).');
    });

    // --- Chaos Tests ---

    it('chaos: should handle null timeline gracefully', () => {
        const result = indicator.evaluate(null);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Zu wenig (oder ungültige) Daten');
    });

    it('chaos: should handle missing macroGroups gracefully', () => {
        const timeline = [{ other: 'data' }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine Daten vorhanden');
    });

    it('chaos: should handle missing FinancialConditions gracefully', () => {
        const timeline = [{ macroGroups: { other: 'data' } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine Daten vorhanden');
    });

    it('chaos: should handle undefined ChicagoFedIndex gracefully', () => {
        const timeline = [{ macroGroups: { FinancialConditions: {} } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine Daten vorhanden');
    });

    it('chaos: should parse valid number strings', () => {
        const result = indicator.evaluate(buildTimeline('1.5'));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('1.50');
    });

    it('chaos: should return UNKNOWN for invalid number strings (NaN)', () => {
        const result = indicator.evaluate(buildTimeline('INVALID'));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Ungültige Daten (keine Zahl)');
    });
});
