import { describe, it, expect, beforeEach } from 'vitest';
import { RedAlertIndicator } from '../../../src/analysis/indicators/RedAlertIndicator.js';

describe('RedAlertIndicator - HARDCORE TESTS', () => {
    let indicator;

    beforeEach(() => {
        indicator = new RedAlertIndicator();
    });

    const buildTimeline = (overrides = {}, length = 1) => {
        const arr = [];
        
        // Fülle die Historie mit Störgeräuschen
        for (let i = 0; i < length - 1; i++) {
            // Extrem hohe oder niedrige Werte, kaputte Daten, nulls
            if (i % 3 === 0) {
                arr.push(null);
            } else if (i % 3 === 1) {
                arr.push({});
            } else {
                arr.push({
                    assets: { SKEW: 200 }, // False Positive Alarm in der Historie!
                    SPY_ShortVolumeRatio: 0.10,
                    TotalPCR: 0.5
                });
            }
        }

        // Der entscheidende aktuelle Tag
        const currentDay = {
            assets: { SKEW: 130 },
            SPY_ShortVolumeRatio: 0.60,
            TotalPCR: 1.0
        };
        
        // Apply overrides für den aktuellen Tag
        if (overrides.SKEW !== undefined) currentDay.assets.SKEW = overrides.SKEW;
        if (overrides.SPY_ShortVolumeRatio !== undefined) currentDay.SPY_ShortVolumeRatio = overrides.SPY_ShortVolumeRatio;
        if (overrides.TotalPCR !== undefined) currentDay.TotalPCR = overrides.TotalPCR;
        if ('assets' in overrides && overrides.assets === null) currentDay.assets = null;
        
        arr.push(currentDay);
        return arr;
    };

    it('INTEGRATION: SKEW > 145, Short < 0.45, PCR < 0.75 -> CRITICAL', () => {
        const result = indicator.evaluate(buildTimeline({ SKEW: 150, SPY_ShortVolumeRatio: 0.40, TotalPCR: 0.70 }));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('SKEW:150.0|Short:40.0%|PCR:0.70');
    });

    it('INTEGRATION: SKEW > 145, Short < 0.45, PCR >= 0.75 -> WARNING', () => {
        const result = indicator.evaluate(buildTimeline({ SKEW: 150, SPY_ShortVolumeRatio: 0.40, TotalPCR: 0.80 }));
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Melt-Up Phase ist noch aktiv');
    });

    it('INTEGRATION: SKEW > 140, Short < 0.50 -> WARNING', () => {
        const result = indicator.evaluate(buildTimeline({ SKEW: 142, SPY_ShortVolumeRatio: 0.48, TotalPCR: 1.0 }));
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Spannung baut sich auf');
    });

    it('INTEGRATION: Normales Marktumfeld (SKEW <= 140, Short >= 0.50) -> OK', () => {
        const result = indicator.evaluate(buildTimeline()); // uses defaults SKEW: 130, Short: 0.60
        expect(result.status).toBe('OK');
    });

    // --- DEEP HISTORY & WASTELAND TEST ---
    it('INTEGRATION: 2000-Tage Timeline mit massivem Rauschen in der Historie', () => {
        // Die 1999 Tage davor enthalten null, {} und False-Positives. 
        // Der Indikator darf sich davon nicht ablenken lassen.
        const timeline = buildTimeline({ SKEW: 146, SPY_ShortVolumeRatio: 0.40, TotalPCR: 0.70 }, 2000);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        // Er hat exakt Tag 2000 ausgewertet!
    });

    // --- RAZOR-EDGE BOUNDARY TESTS ---
    it('BOUNDARY: SKEW genau 145.0, Short genau 0.45 -> WARNING (nicht CRITICAL)', () => {
        const result = indicator.evaluate(buildTimeline({ SKEW: 145.0, SPY_ShortVolumeRatio: 0.45, TotalPCR: 0.70 }));
        expect(result.status).toBe('WARNING'); // SKEW muss > 145 sein, 145.0 reicht nicht
    });

    it('BOUNDARY: SKEW exakt 145.01, Short exakt 0.449 -> CRITICAL (Razor-Edge passed)', () => {
        const result = indicator.evaluate(buildTimeline({ SKEW: 145.01, SPY_ShortVolumeRatio: 0.449, TotalPCR: 0.70 }));
        expect(result.status).toBe('CRITICAL');
    });

    // --- PCR FALLBACK ASSERTION ---
    it('FALLBACK: Wenn PCR fehlt, wird 1.0 angenommen und "(Kein PCR)" ausgegeben', () => {
        const result = indicator.evaluate(buildTimeline({ SKEW: 150, SPY_ShortVolumeRatio: 0.40, TotalPCR: null }));
        // SKEW > 145, Short < 0.45. Da PCR fehlt, wird es 1.0. Daher pcrVal >= 0.75 -> WARNING
        expect(result.status).toBe('WARNING');
        expect(result.value).toContain('(Kein PCR)');
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

    it('CHAOS: Data are valid strings instead of numbers -> Should safely parse and handle', () => {
        const result = indicator.evaluate(buildTimeline({ SKEW: "150.5", SPY_ShortVolumeRatio: "0.4", TotalPCR: "0.7" }));
        expect(result.status).toBe('CRITICAL'); // string should be parsed
        expect(result.value).toContain('SKEW:150.5|Short:40.0%|PCR:0.70');
    });

    it('CHAOS: Data are completely invalid strings (NaN) -> Should reject', () => {
        const result = indicator.evaluate(buildTimeline({ SKEW: "KAPUTT", SPY_ShortVolumeRatio: 0.40, TotalPCR: 1.0 }));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Ungültige Daten (keine Zahlen)');
    });

    it('CHAOS: Missing assets object entirely', () => {
        const timeline = buildTimeline();
        delete timeline[0].assets;
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });
});
