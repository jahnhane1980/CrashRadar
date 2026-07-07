import { describe, it, expect, beforeEach } from 'vitest';
import { TechCycleRadarIndicator } from '../../../src/analysis/indicators/TechCycleRadarIndicator.js';

describe('TechCycleRadarIndicator - HARDCORE TESTS', () => {
    let indicator;

    beforeEach(() => {
        indicator = new TechCycleRadarIndicator();
    });

    const buildTimeline = (scenario, length = 120) => {
        const arr = [];
        
        for (let i = 0; i < length; i++) {
            // Noise/Chaos injections
            if (i === 10) { arr.push(null); continue; }
            if (i === 20) { arr.push({ assets: { SMH: "KAPUTT", IGV: 100 } }); continue; }
            if (i === 30) { arr.push({ assets: { SMH: 100, IGV: 0 } }); continue; } // Div by zero
            if (i === 40) { arr.push({ assets: { SMH: [], IGV: true } }); continue; } // Coercion trap
            if (i === 50) { arr.push({}); continue; }

            let smh = 100;
            let igv = 100;
            let cibr = 50;
            let spy = 100;

            if (scenario === 'DISTRIBUTION') {
                smh = 120; igv = 100;
                if (i >= 100 && i < 115) { smh = 150; igv = 100; }
                if (i >= 115) { smh = 130; igv = 100; }
                if (i === length - 15) { cibr = 50; spy = 100; }
                if (i === length - 1) { cibr = 60; spy = 100; }
            } else if (scenario === 'HARDWARE_START') {
                smh = 100; igv = 100; 
                if (i >= 100 && i < 115) { smh = 90; igv = 100; } 
                if (i >= 115) { smh = 200; igv = 100; } 
            } else if (scenario === 'SOFTWARE_START') {
                smh = 100; igv = 100; 
                if (i >= 100 && i < 115) { smh = 110; igv = 100; } 
                if (i >= 115) { smh = 50; igv = 100; } 
            } else if (scenario === 'HARDWARE_DOMINANZ') {
                smh = 120; igv = 100;
                if (i >= 100 && i < 115) { smh = 130; igv = 100; }
                if (i >= 115) { smh = 140; igv = 100; } 
            } else if (scenario === 'ACCUMULATION') {
                smh = 100; igv = 100;
                if (i >= 100 && i < 115) { smh = 50; igv = 100; }
                if (i >= 115) { smh = 80; igv = 100; } 
            } else if (scenario === 'SOFTWARE_DOMINANZ') {
                smh = 100; igv = 100;
                if (i >= 100 && i < 115) { smh = 50; igv = 100; }
                if (i >= 115) { smh = 40; igv = 100; } 
            }

            arr.push({ assets: { SMH: smh, IGV: igv, CIBR: cibr, SPY: spy } });
        }
        
        return arr;
    };

    it('INTEGRATION: DISTRIBUTION (Hardware wackelt, CIBR flüchtet)', () => {
        const result = indicator.evaluate(buildTimeline('DISTRIBUTION'));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('DISTRIBUTION');
        expect(result.message).toContain('Hardware wackelt');
        expect(result.message).toContain('Defensives Geld flüchtet massiv in Cybersecurity');
    });

    it('INTEGRATION: HARDWARE START (Golden Cross)', () => {
        const result = indicator.evaluate(buildTimeline('HARDWARE_START'));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('HARDWARE START');
    });

    it('INTEGRATION: SOFTWARE START (Death Cross)', () => {
        const result = indicator.evaluate(buildTimeline('SOFTWARE_START'));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('SOFTWARE START');
    });

    it('INTEGRATION: HARDWARE DOMINANZ', () => {
        const result = indicator.evaluate(buildTimeline('HARDWARE_DOMINANZ'));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('HARDWARE DOMINANZ');
    });

    it('INTEGRATION: ACCUMULATION (Hardware sammelt Momentum)', () => {
        const result = indicator.evaluate(buildTimeline('ACCUMULATION'));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('ACCUMULATION');
    });

    it('INTEGRATION: SOFTWARE DOMINANZ', () => {
        const result = indicator.evaluate(buildTimeline('SOFTWARE_DOMINANZ'));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('SOFTWARE DOMINANZ');
    });

    // --- CHAOS TESTS ---
    it('CHAOS: timeline is too short (< 100) -> UNKNOWN', () => {
        const result = indicator.evaluate(new Array(99).fill({}));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: timeline is null -> UNKNOWN', () => {
        const result = indicator.evaluate(null);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Missing SMH/IGV Data entirely -> UNKNOWN', () => {
        const result = indicator.evaluate(new Array(120).fill({ assets: {} }));
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Coercion und Typen-Müll ([], true, leere Strings) -> ignoriert kaputte Tage', () => {
        const arr = [];
        for(let i=0; i<120; i++) {
            // Fülle mit extremem Müll, der durch die Coercion-Checks fallen muss
            arr.push({ assets: { SMH: "", IGV: 100 } });
            arr.push({ assets: { SMH: 100, IGV: "" } });
            arr.push({ assets: { SMH: [], IGV: true } });
            arr.push({ assets: { SMH: false, IGV: {} } });
            arr.push({ assets: { SMH: "NaN", IGV: "100" } });
        }
        const result = indicator.evaluate(arr);
        // Da alle Tage aussortiert werden, gibt es keinen MA -> UNKNOWN
        expect(result.status).toBe('UNKNOWN');
    });
});
