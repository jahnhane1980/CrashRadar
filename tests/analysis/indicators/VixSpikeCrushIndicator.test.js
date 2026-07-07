import { describe, it, expect, beforeEach } from 'vitest';
import { VixSpikeCrushIndicator } from '../../../src/analysis/indicators/VixSpikeCrushIndicator.js';

describe('VixSpikeCrushIndicator - HARDCORE TESTS', () => {
    let indicator;

    beforeEach(() => {
        indicator = new VixSpikeCrushIndicator();
    });

    const buildTimeline = (maxVix, currentVix, length = 2000) => {
        const arr = [];
        
        for (let i = 0; i < length; i++) {
            // Noise & Chaos vor den letzten 30 Tagen
            if (i < length - 30) {
                if (i % 10 === 0) arr.push(null);
                else if (i % 10 === 1) arr.push({ assets: { VIX: "KAPUTT" } });
                else arr.push({ assets: { VIX: 15 } }); // Normaler VIX
                continue;
            }

            // Letzte 30 Tage
            // Chaos einstreuen, aber den maxVix an Tag -15 garantieren
            if (i === length - 15) {
                arr.push({ assets: { VIX: maxVix } });
                continue;
            }
            if (i === length - 1) {
                if (currentVix !== undefined) arr.push({ assets: { VIX: currentVix } });
                else arr.push({ assets: null });
                continue;
            }

            // Mehr Chaos in den letzten 30 Tagen
            if (i === length - 10) { arr.push(null); continue; }
            if (i === length - 5) { arr.push({ assets: { VIX: "MÜLL" } }); continue; }
            if (i === length - 3) { arr.push({ assets: { VIX: "" } }); continue; }
            if (i === length - 2) { arr.push({ assets: { VIX: true } }); continue; }
            if (i === length - 4) { arr.push({ assets: { VIX: [] } }); continue; }

            arr.push({ assets: { VIX: 20 } }); // Sicher unter maxVix
        }
        return arr;
    };

    it('INTEGRATION: VIX CRUSH (KAUFSIGNAL) -> CRITICAL', () => {
        // max >= 40, current < max * 0.8 -> 50 * 0.8 = 40. current = 39 < 40
        const result = indicator.evaluate(buildTimeline(50, 39));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('39.0');
        expect(result.message).toContain('KAUFSIGNAL!');
    });

    it('INTEGRATION: VIX CRUSH WARNING (Bodenbildung) -> WARNING', () => {
        // max >= 35, current < max * 0.85 -> 38 * 0.85 = 32.3. current = 32 < 32.3
        // Aber NICHT CRITICAL (da maxVix30 < 40)
        const result = indicator.evaluate(buildTimeline(38, 32));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('32.0');
        expect(result.message).toContain('Bodenbildung läuft');
    });

    it('INTEGRATION: Extreme Panik (kein Abbau) -> WARNING', () => {
        // max >= 35, current NICHT < max * 0.85 -> 38 * 0.85 = 32.3. current = 36 > 32.3
        const result = indicator.evaluate(buildTimeline(38, 36));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('36.0');
        expect(result.message).toContain('Extreme Panik am Markt');
    });

    it('INTEGRATION: Normaler Markt -> OK', () => {
        // max < 35 -> 25
        const result = indicator.evaluate(buildTimeline(25, 20));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('20.0');
        expect(result.message).toContain('Normaler Markt');
    });

    // --- RAZOR EDGE BOUNDARIES (Floating points) ---
    it('BOUNDARY: Exakt VIX_SPIKE (40) und Crush Boundary (32.00) -> WARNING (knapp verfehlt)', () => {
        // max = 40. Crush limit < 32.0 (40 * 0.8 = 32). current = 32.0 -> NOT < 32.0. So it falls to WARNING Crush limit (40 * 0.85 = 34). 32.0 < 34 -> WARNING!
        const result = indicator.evaluate(buildTimeline(40, 32.0));
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Bodenbildung läuft');
    });

    it('BOUNDARY: Exakt VIX_SPIKE (40) und Crush erreicht (31.99) -> CRITICAL', () => {
        const result = indicator.evaluate(buildTimeline(40, 31.99));
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('KAUFSIGNAL!');
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

    it('CHAOS: Missing Data (currentVix null) -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(50, undefined));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Valid String parsing -> OK/CRITICAL', () => {
        const result = indicator.evaluate(buildTimeline("50.5", "30.5"));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('30.5');
    });

    it('CHAOS: Invalid Strings (NaN) in currentVix -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(50, "KAPUTT"));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS (Coercion): Empty String in currentVix -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(50, "   "));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS (Coercion): Boolean true in currentVix -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(50, true));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS (Coercion): Empty Array in currentVix -> UNKNOWN', () => {
        const result = indicator.evaluate(buildTimeline(50, []));
        expect(result.status).toBe('UNKNOWN');
    });

    // --- EXTREME VALUES (ZERO & NEGATIVE) & DATA GAPS ---
    it('EXTREME: VIX fällt auf 0.0 -> KAUFSIGNAL (CRITICAL)', () => {
        // max = 50, current = 0. 0 < 50 * 0.8 (40).
        const result = indicator.evaluate(buildTimeline(50, 0));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('0.0');
    });

    it('EXTREME: VIX fällt auf negativen Wert (API Bug) -> KAUFSIGNAL (CRITICAL)', () => {
        const result = indicator.evaluate(buildTimeline(50, -10));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('-10.0');
    });

    it('EXTREME: Letzte 29 Tage fehlen, nur heute hat Daten -> OK (maxVix = currentVix)', () => {
        // Wenn alle Tage außer heute kaputt sind, ist maxVix30 = currentVix (z.B. 20).
        // 20 ist nicht >= 35, also OK.
        const arr = new Array(2000).fill(null);
        arr[1999] = { assets: { VIX: 20 } }; // Nur der heutige Tag existiert
        const result = indicator.evaluate(arr);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('20.0');
    });

    it('EXTREME: Spike-Limit exakt auf der Kante (maxVix30 = 35.0, current = 35.0) -> WARNING', () => {
        const result = indicator.evaluate(buildTimeline(35.0, 35.0));
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Extreme Panik');
    });
});
