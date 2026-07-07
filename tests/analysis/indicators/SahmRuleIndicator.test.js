import { describe, it, expect, beforeEach } from 'vitest';
import { SahmRuleIndicator } from '../../../src/analysis/indicators/SahmRuleIndicator.js';

describe('SahmRuleIndicator - HARDCORE TESTS', () => {
    let indicator;

    beforeEach(() => {
        indicator = new SahmRuleIndicator();
    });

    const buildTimeline = (sahmValue, length = 1) => {
        const arr = [];
        
        // Noise history
        for (let i = 0; i < length - 1; i++) {
            if (i % 2 === 0) arr.push(null);
            else arr.push({ macroGroups: { Leading: { SahmRule: 9.99 } } }); // False positive
        }

        // Current Day
        const currentDay = {
            macroGroups: {
                Leading: {}
            }
        };
        
        if (sahmValue !== undefined) {
            currentDay.macroGroups.Leading.SahmRule = sahmValue;
        } else {
            currentDay.macroGroups = null; // simulate deep missing
        }
        
        arr.push(currentDay);
        return arr;
    };

    it('INTEGRATION: Value >= 0.50 -> CRITICAL', () => {
        const result = indicator.evaluate(buildTimeline(0.60));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('0.60');
    });

    it('INTEGRATION: Value < 0.50 -> OK', () => {
        const result = indicator.evaluate(buildTimeline(0.20));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('0.20');
    });

    // --- DEEP HISTORY TEST ---
    it('INTEGRATION: 1000 Tage Rauschen in der Historie, ignoriert Noise', () => {
        const result = indicator.evaluate(buildTimeline(0.40, 1000));
        expect(result.status).toBe('OK'); // Der Wert an Tag 1000 ist 0.40. Alles davor (inkl. 9.99) wird ignoriert.
    });

    // --- BOUNDARY TESTS ---
    it('BOUNDARY: Exakt 0.49 -> OK (knapp verfehlt)', () => {
        const result = indicator.evaluate(buildTimeline(0.49));
        expect(result.status).toBe('OK');
    });

    it('BOUNDARY: Exakt 0.50 -> CRITICAL (Grenzwert getroffen)', () => {
        const result = indicator.evaluate(buildTimeline(0.50));
        expect(result.status).toBe('CRITICAL');
    });

    // --- CHAOS TESTS ---
    it('CHAOS: timeline is null -> Should not throw TypeError', () => {
        const result = indicator.evaluate(null);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: currentDay is null -> Should not throw TypeError', () => {
        const result = indicator.evaluate([null]);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: missing macroGroups entirely', () => {
        const result = indicator.evaluate(buildTimeline(undefined));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: valid string instead of number -> Should safely parse', () => {
        const result = indicator.evaluate(buildTimeline("0.55"));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('0.55');
    });

    it('CHAOS: invalid string (NaN) -> Should reject cleanly', () => {
        const result = indicator.evaluate(buildTimeline("KAPUTT"));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Ungültige Daten');
    });

    it('CHAOS (Coercion): Empty string -> Should reject, not treat as 0', () => {
        const result = indicator.evaluate(buildTimeline("   "));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Leerer Wert');
    });

    it('CHAOS (Coercion): Boolean true -> Should reject, not treat as 1 (CRITICAL)', () => {
        const result = indicator.evaluate(buildTimeline(true));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Ungültiger Datentyp');
    });

    it('CHAOS (Coercion): Empty Array -> Should reject, not treat as 0', () => {
        const result = indicator.evaluate(buildTimeline([]));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Ungültiger Datentyp');
    });
});
