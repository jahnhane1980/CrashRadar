import { describe, it, expect } from 'vitest';
import { PanicCapitulationIndicator } from '../../../src/analysis/indicators/PanicCapitulationIndicator.js';

describe('PanicCapitulationIndicator - HARDCORE INTEGRATION TESTS', () => {
    let indicator;

    beforeEach(() => {
        indicator = new PanicCapitulationIndicator();
        // KEINE MOCKS MEHR! Wir testen gegen die echte MathUtils.
    });

    /**
     * Baut eine realistische 1000-Tage-Timeline mit einem simulierten Bärenmarkt.
     * Das erzeugt eine ECHTE RSI-Divergenz durch Wilder's Smoothing.
     */
    const buildRealTimeline = (overrides = {}) => {
        const length = 1000;
        const timeline = [];
        let price = 200;

        for(let i = 0; i < length; i++) {
            // Simulation eines Marktzyklus
            if (i >= 800 && i < 970) {
                price -= 0.588; // Stetiger Abfall
            } else if (i === 970) {
                price = 100.00; // EXAKTER Tiefpunkt für die prevLow-Boundary-Tests
            } else if (i > 970 && i < 999) {
                price += 0.689; // Bounce
            } else if (i === 999) {
                price = 100.00; // Trigger-Tag
            }

            timeline.push({
                assets: {
                    SPY: price,
                    VIX: 20, // Baseline VIX
                    CBOE_SPY: 1000 // Baseline Optionsvolumen
                }
            });
        }

        // Overrides für den allerletzten Tag (Trigger-Tag)
        if (overrides) {
            const last = timeline[length - 1].assets;
            if (overrides.SPY !== undefined) last.SPY = overrides.SPY;
            if (overrides.VIX !== undefined) last.VIX = overrides.VIX;
            if (overrides.CBOE_SPY !== undefined) last.CBOE_SPY = overrides.CBOE_SPY;
        }

        return timeline;
    };

    it('Sollte UNKNOWN zurückgeben, wenn weniger als 90 Tage Daten vorhanden sind', () => {
        // Schneide die Timeline auf 89 Tage ab
        const result = indicator.evaluate(buildRealTimeline().slice(0, 89));
        expect(result.status).toBe('UNKNOWN');
    });

    it('INTEGRATION: Echtes GENERATIONEN-KAUFSIGNAL mit mathematisch echter RSI Divergenz', () => {
        // VIX 35, CBOE 1500 (1.5x von 1000 Avg).
        // Preis crasht auf 100 (wie an Tag 970), was ein NewLow auslöst, aber RSI ist höher.
        const timeline = buildRealTimeline({ VIX: 35, CBOE_SPY: 1500, SPY: 100 });
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('GENERATIONEN-KAUFSIGNAL');
    });

    it('INTEGRATION: WARNING bei Panik-Spike ohne RSI Divergenz / New Low', () => {
        // Wenn der Preis nicht tief genug crasht (120), gibt es kein New Low.
        const timeline = buildRealTimeline({ VIX: 35, CBOE_SPY: 1500, SPY: 120 });
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Massiver Panik-Spike im Optionsvolumen');
    });

    // --- RAZOR-EDGE BOUNDARIES ---

    it('BOUNDARY: Scheitert bei VIX exakt 34.99 (Grenze ist 35.00)', () => {
        const timeline = buildRealTimeline({ VIX: 34.99, CBOE_SPY: 1500, SPY: 100 });
        const result = indicator.evaluate(timeline);
        // VIX zu niedrig -> OK
        expect(result.status).toBe('OK');
    });

    it('BOUNDARY: Scheitert bei CBOE exakt 1.499x SMA90 (Grenze ist 1.5x)', () => {
        // SMA90 der letzten 90 Tage (ohne letzten Tag) ist exakt 1000.
        // 1.5x ist 1500. Wir testen 1499.99.
        const timeline = buildRealTimeline({ VIX: 35.00, CBOE_SPY: 1499.99, SPY: 100 });
        const result = indicator.evaluate(timeline);
        // CBOE-Spike zu niedrig -> OK
        expect(result.status).toBe('OK');
    });

    it('BOUNDARY: Scheitert beim NewLow-Check, wenn SPY exakt 102.01 ist (Grenze ist prevLow * 1.02 = 102.00)', () => {
        // PrevLow war 100 an Tag 970. Grenze = 100 * 1.02 = 102.
        const timeline = buildRealTimeline({ VIX: 35.00, CBOE_SPY: 1500, SPY: 102.01 });
        const result = indicator.evaluate(timeline);
        // Divergenz-Bedingung fehlt -> Fällt zurück auf WARNING (da VIX und CBOE hoch sind)
        expect(result.status).toBe('WARNING');
    });

    // --- SCHWEIZER-KÄSE CHAOS TESTS (Unvollständige Arrays & NaNs) ---

    it('CHAOS: 30% der Timeline besteht aus null oder fehlenden Assets (Stresstest für echte MathUtils)', () => {
        const timeline = buildRealTimeline({ VIX: 35, CBOE_SPY: 1500, SPY: 100 });
        
        // Zerstöre zufällig 30% der Daten (außer den letzten 5 Tagen, um das Signal nicht komplett zu löschen)
        for (let i = 0; i < timeline.length - 5; i++) {
            if (Math.random() < 0.3) {
                // 3 Varianten der Zerstörung
                const rand = Math.random();
                if (rand < 0.33) timeline[i] = null;
                else if (rand < 0.66) timeline[i] = {}; // Ohne .assets
                else timeline[i].assets.SPY = "INVALID"; // String statt Number
            }
        }
        
        // Die MathUtils und die Klasse MÜSSEN das ohne abzustürzen wegfiltern.
        const result = indicator.evaluate(timeline);
        
        // Abhängig davon, welche wichtigen Tage zerstört wurden, kann das Ergebnis CRITICAL, WARNING oder OK sein,
        // aber es darf UNTER KEINEN UMSTÄNDEN ein TypeError fliegen!
        expect(['CRITICAL', 'WARNING', 'OK', 'UNKNOWN']).toContain(result.status);
    });

    it('CHAOS: Völlig leeres Timeline Array', () => {
        const result = indicator.evaluate([]);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Current Day Daten fehlen komplett', () => {
        const timeline = buildRealTimeline();
        timeline[timeline.length - 1] = null;
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('CHAOS: Current Day Daten sind korrupte Strings', () => {
        const timeline = buildRealTimeline({ VIX: "KAPUTT", CBOE_SPY: "1500", SPY: "100" });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Ungültige Daten');
    });
});
