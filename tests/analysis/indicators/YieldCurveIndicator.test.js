import { describe, it, expect, beforeEach } from 'vitest';
import { YieldCurveIndicator } from '../../../src/analysis/indicators/YieldCurveIndicator.js';

describe('YieldCurveIndicator - HARDCORE TESTS', () => {
    let indicator;

    beforeEach(() => {
        indicator = new YieldCurveIndicator();
    });

    const buildTimeline = (past30, current, length = 2000) => {
        const arr = [];
        
        for (let i = 0; i < length; i++) {
            // Wasteland: Alles zwischen den Messpunkten wird mit kaputtem Müll verseucht
            if (i > length - 30 && i < length - 1) {
                arr.push(i % 2 === 0 ? null : { macroGroups: "KAPUTT" });
                continue;
            }

            const day = { macroGroups: { YieldCurve: { Spread10y2y: 1.0 } } }; // Noise

            if (i === length - 30) {
                if (past30 !== undefined) day.macroGroups.YieldCurve.Spread10y2y = past30;
                else day.macroGroups = null; // simulate missing
            } else if (i === length - 1) {
                if (current !== undefined) day.macroGroups.YieldCurve.Spread10y2y = current;
                else day.macroGroups.YieldCurve = null; // simulate missing
            }

            arr.push(day);
        }
        return arr;
    };

    it('INTEGRATION: UN-INVERTING (Crash-Signal) -> CRITICAL', () => {
        const result = indicator.evaluate(buildTimeline(-0.5, 0.1));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('0.10');
        expect(result.message).toContain('UN-INVERTING!');
    });

    it('INTEGRATION: Late Cycle (Invertiert) -> WARNING', () => {
        const result = indicator.evaluate(buildTimeline(-0.5, -0.2));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('-0.20');
        expect(result.message).toContain('Invertiert (Late Cycle)');
    });

    it('INTEGRATION: Normale Kurve -> OK', () => {
        const result = indicator.evaluate(buildTimeline(0.5, 0.8));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('0.80');
        expect(result.message).toContain('Normale Kurve (positiv)');
    });

    // --- RAZOR EDGE BOUNDARY TESTS ---
    it('BOUNDARY: Exakt auf der 0-Linie nach Inversion (-0.01 zu 0.00) -> CRITICAL', () => {
        const result = indicator.evaluate(buildTimeline(-0.01, 0.00));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('0.00');
    });

    it('BOUNDARY: Bleibt knapp invertiert (-0.5 zu -0.01) -> WARNING', () => {
        const result = indicator.evaluate(buildTimeline(-0.50, -0.01));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('-0.01');
    });

    it('BOUNDARY: Startet auf 0 (nicht invertiert) und bleibt bei 0 -> OK', () => {
        const result = indicator.evaluate(buildTimeline(0.00, 0.00));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('0.00');
    });

    it('BOUNDARY: Exakter Moment der Inversion (Positiv -> Negativ) -> WARNING', () => {
        // past30 war normal (>0), heute invertiert (<0). Muss WARNING (Late Cycle) sein, KEIN Critical.
        const result = indicator.evaluate(buildTimeline(0.50, -0.01));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('-0.01');
        expect(result.message).toContain('Invertiert (Late Cycle)');
    });

    // --- CHAOS TESTS ---
    it('CHAOS: timeline is too short (< 30) -> UNKNOWN', () => {
        const result = indicator.evaluate(new Array(29).fill({}));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: timeline is null -> UNKNOWN', () => {
        const result = indicator.evaluate(null);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Missing Data (past30 null) -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(undefined, 0.5));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Missing Data (current null) -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(-0.5, undefined));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Valid String parsing -> CRITICAL', () => {
        const result = indicator.evaluate(buildTimeline("-0.1", "0.2"));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('0.20');
    });

    it('CHAOS: Invalid Strings (NaN) -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(-0.5, "KAPUTT"));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS (Coercion): Empty String -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline("   ", 0.5));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS (Coercion): Boolean true -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(-0.5, true));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS (Coercion): Empty Array -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline([], 0.5));
        expect(result.status).toBe('UNKNOWN');
    });
});
