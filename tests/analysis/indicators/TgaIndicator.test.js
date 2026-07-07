import { describe, it, expect, beforeEach } from 'vitest';
import { TgaIndicator } from '../../../src/analysis/indicators/TgaIndicator.js';

describe('TgaIndicator - HARDCORE TESTS', () => {
    let indicator;

    beforeEach(() => {
        indicator = new TgaIndicator();
    });

    const buildTimeline = (pastTGA, currentTGA, length = 2000) => {
        const arr = [];
        
        for (let i = 0; i < length; i++) {
            // Wasteland: Alles zwischen den Messpunkten wird mit kaputtem Müll verseucht
            if (i > length - 30 && i < length - 1) {
                arr.push(i % 2 === 0 ? null : { macroGroups: "KAPUTT" });
                continue;
            }

            const day = { macroGroups: { NetLiquidity: { TGA: 500 } } }; // Noise

            if (i === length - 30) {
                if (pastTGA !== undefined) day.macroGroups.NetLiquidity.TGA = pastTGA;
                else day.macroGroups = null; // simulate missing
            } else if (i === length - 1) {
                if (currentTGA !== undefined) day.macroGroups.NetLiquidity.TGA = currentTGA;
                else day.macroGroups.NetLiquidity = null; // simulate missing
            }

            arr.push(day);
        }
        return arr;
    };

    it('INTEGRATION: Starker Anstieg > 100B -> WARNING', () => {
        const result = indicator.evaluate(buildTimeline(500, 601)); // Diff = 101
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('601B');
        expect(result.message).toContain('Starker Anstieg (+101B');
    });

    it('INTEGRATION: Rasanter Fall < -100B -> OK (Stimulus)', () => {
        const result = indicator.evaluate(buildTimeline(500, 399)); // Diff = -101
        expect(result.status).toBe('OK');
        expect(result.value).toBe('399B');
        expect(result.message).toContain('Rasanter Fall (-101B');
    });

    it('INTEGRATION: Neutrale Seitwärtsbewegung -> OK', () => {
        const result = indicator.evaluate(buildTimeline(500, 550)); // Diff = 50
        expect(result.status).toBe('OK');
        expect(result.message).toContain('Neutrale Seitwärtsbewegung');
    });

    // --- RAZOR EDGE BOUNDARY TESTS (FLOATING POINTS) ---
    it('BOUNDARY: Exakt +100B -> OK (knapp verfehlt, muss > 100 sein)', () => {
        const result = indicator.evaluate(buildTimeline(500, 600)); // Diff = 100
        expect(result.status).toBe('OK');
    });

    it('BOUNDARY: Exakt -100B -> OK (knapp verfehlt, muss < -100 sein)', () => {
        const result = indicator.evaluate(buildTimeline(500, 400)); // Diff = -100
        expect(result.status).toBe('OK');
    });

    it('BOUNDARY (Micro): +100.01B -> WARNING (löst Alarm aus)', () => {
        const result = indicator.evaluate(buildTimeline(500.00, 600.01)); // Diff = 100.01
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Starker Anstieg (+100B'); // toFixed(0) rundet hier ab, aber Alarm feuert!
    });

    it('BOUNDARY (Micro): -100.01B -> OK (Kaufsignal feuert)', () => {
        const result = indicator.evaluate(buildTimeline(500.00, 399.99)); // Diff = -100.01
        expect(result.status).toBe('OK');
        expect(result.message).toContain('Rasanter Fall (-100B'); // toFixed(0) rundet
    });

    // --- EXTREME VALUES (ZERO & NEGATIVE) ---
    it('EXTREME: TGA fällt auf exakt 0 -> OK (Stimulus)', () => {
        const result = indicator.evaluate(buildTimeline(150, 0)); // Diff = -150
        expect(result.status).toBe('OK');
        expect(result.value).toBe('0B');
    });

    it('EXTREME: TGA ist 0 und steigt auf 150 -> WARNING', () => {
        const result = indicator.evaluate(buildTimeline(0, 150)); // Diff = 150
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('150B');
    });

    it('EXTREME: TGA wird negativ (Overdrawn) -> OK', () => {
        const result = indicator.evaluate(buildTimeline(10, -100)); // Diff = -110
        expect(result.status).toBe('OK');
        expect(result.value).toBe('-100B');
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

    it('CHAOS: Missing Data (pastTGA null) -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(undefined, 500));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Missing Data (currentTGA null) -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(500, undefined));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Invalid Strings (NaN) -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(500, "KAPUTT"));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS (Coercion): Empty String -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline("   ", 500));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS (Coercion): Boolean true -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(true, 500));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS (Coercion): Empty Array -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(500, []));
        expect(result.status).toBe('UNKNOWN');
    });
});
