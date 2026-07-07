import { describe, it, expect, beforeEach } from 'vitest';
import { RateShockIndicator } from '../../../src/analysis/indicators/RateShockIndicator.js';

describe('RateShockIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new RateShockIndicator();
    });

    const buildTimeline = (length = 60, currentY = 2.5, pastY = 2.0) => {
        const arr = Array.from({ length }, (_, i) => ({
            macroGroups: {
                FinancialConditions: {
                    RealYield10y: 2.0 // Default
                }
            }
        }));

        if (arr.length >= 60) {
            arr[arr.length - 60].macroGroups.FinancialConditions.RealYield10y = pastY;
        }
        if (arr.length > 0) {
            arr[arr.length - 1].macroGroups.FinancialConditions.RealYield10y = currentY;
        }

        return arr;
    };

    it('should have correct name and category', () => {
        expect(indicator.name).toBe('Rate Shock (Real Yield Velocity)');
        expect(indicator.category).toBe('TRIGGER');
    });

    it('should return UNKNOWN if timeline < 60 days', () => {
        const result = indicator.evaluate(buildTimeline(59));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('should return OK for stable yields', () => {
        const result = indicator.evaluate(buildTimeline(60, 2.0, 2.0)); // Diff = 0.00
        expect(result.status).toBe('OK');
        expect(result.value).toBe('0.00%');
    });

    it('should return OK for negative yields (dropping rates)', () => {
        const result = indicator.evaluate(buildTimeline(60, 1.5, 2.0)); // Diff = -0.50
        expect(result.status).toBe('OK');
        expect(result.value).toBe('-0.50%');
    });

    it('should return WARNING for rapidly rising yields', () => {
        const result = indicator.evaluate(buildTimeline(60, 2.4, 2.0)); // Diff = 0.40
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('+0.40%');
    });

    it('should return CRITICAL for rate shock', () => {
        const result = indicator.evaluate(buildTimeline(60, 2.6, 2.0)); // Diff = 0.60
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('+0.60%');
    });

    // --- Boundaries ---
    it('BOUNDARY: should return OK for diff exactly 0.299', () => {
        const result = indicator.evaluate(buildTimeline(60, 2.299, 2.0));
        expect(result.status).toBe('OK');
    });

    it('BOUNDARY: should return WARNING for diff exactly 0.300 (Testing JS Float point drift 2.3-2.0)', () => {
        const result = indicator.evaluate(buildTimeline(60, 2.3, 2.0));
        expect(result.status).toBe('WARNING');
    });

    it('BOUNDARY: should return WARNING for diff exactly 0.499', () => {
        const result = indicator.evaluate(buildTimeline(60, 2.499, 2.0));
        expect(result.status).toBe('WARNING');
    });

    it('BOUNDARY: should return CRITICAL for diff exactly 0.500', () => {
        const result = indicator.evaluate(buildTimeline(60, 2.5, 2.0));
        expect(result.status).toBe('CRITICAL');
    });

    // --- Chaos Tests ---
    it('CHAOS: timeline is null', () => {
        const result = indicator.evaluate(null);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: missing data in pastDay', () => {
        const timeline = buildTimeline(60, 2.5, 2.0);
        timeline[0] = { macroGroups: {} }; // pastDay
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: missing data in currentDay', () => {
        const timeline = buildTimeline(60, 2.5, 2.0);
        timeline[59] = {}; // currentDay
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: RealYield is undefined (bypasses === null check)', () => {
        const timeline = buildTimeline(60, 2.5, 2.0);
        timeline[59].macroGroups.FinancialConditions = {}; // RealYield undefined
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: RealYield is a corrupt string (NaN)', () => {
        const timeline = buildTimeline(60, "KAPUTT", 2.0);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Ungültige Daten');
    });

    it('INTEGRATION: Deep History Test (1500 Tage Timeline)', () => {
        const timeline = buildTimeline(1500, 2.6, 2.0); // current = 2.6, past (day 1440) = 2.0
        // Setze einen völlig absurden Wert an den absoluten Anfang des Arrays (Tag 0), 
        // um zu beweisen, dass die Indexierung (length - 60) exakt an Tag 1440 liest und nicht an Tag 0.
        timeline[0].macroGroups.FinancialConditions.RealYield10y = 10.0;
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('+0.60%');
    });

    it('CHAOS: Wasteland-Test (Alles zwischen den Ankerpunkten ist korrupt)', () => {
        const timeline = buildTimeline(60, 2.5, 2.0);
        
        // Zerstöre alle Datenpunkte ZWISCHEN Tag 0 (pastDay) und Tag 59 (currentDay)
        for (let i = 1; i < 59; i++) {
            if (i % 2 === 0) {
                timeline[i] = null; // Völlig gelöscht
            } else {
                timeline[i] = {}; // Leeres Objekt ohne macroGroups
            }
        }
        
        // Der Indikator darf sich vom Rauschen nicht stören lassen, da er nur Index 0 und 59 braucht.
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('+0.50%');
    });
});
