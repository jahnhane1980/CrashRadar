import { describe, it, expect, beforeEach } from 'vitest';
import { BtcTrailingStopIndicator } from '../../../src/analysis/indicators/BtcTrailingStopIndicator.js';

describe('BtcTrailingStopIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new BtcTrailingStopIndicator();
    });

    // Erstellt eine Timeline mit 200+ Einträgen. Standardmäßig ist MSTR = 100.
    const generateTimeline = (length, overrides = {}) => {
        return Array(length).fill(0).map((_, i) => ({
            assets: {
                MSTR: overrides.mstr !== undefined ? overrides.mstr(i) : 100
            }
        }));
    };

    it('sollte UNKNOWN zurückgeben, wenn die Timeline < 200 Tage ist', () => {
        const timeline = generateTimeline(199);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('< 200 Tage');
    });

    it('sollte UNKNOWN zurückgeben, wenn aktuelle Daten fehlen (mstr = null)', () => {
        const timeline = generateTimeline(205);
        timeline[204].assets.MSTR = null;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');
        expect(indicator.evaluate(timeline).message).toContain('Keine MSTR Daten');
    });

    it('sollte OK zurückgeben, auch wenn mittendrin ein historischer Datenpunkt fehlt (MathUtils ist resilient)', () => {
        const timeline = generateTimeline(205);
        // Wir löschen ein Datum vor 150 Tagen. MathUtils ignoriert das und berechnet den SMA trotzdem.
        timeline[50].assets.MSTR = null;
        expect(indicator.evaluate(timeline).status).toBe('OK');
    });

    it('sollte CRITICAL auslösen: Frischer Death Cross (MSTR fällt heute unter SMA 200)', () => {
        const timeline = generateTimeline(205, {
            // Alle Tage 100, nur heute stürzt er auf 90 ab.
            // Gestern (Index 203) = 100 (>= SMA 100)
            // Heute (Index 204) = 90 (< SMA 99.95)
            mstr: (i) => i === 204 ? 90 : 100
        });

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('VERLIERT SMA 200');
        expect(Number(result.value.replace(/[^-\d.]/g, ''))).toBeLessThan(0);
    });

    it('sollte WARNING auslösen: MSTR bleibt dauerhaft unter SMA 200', () => {
        const timeline = generateTimeline(205, {
            // MSTR ist seit 5 Tagen bei 90, SMA ist ca. 99.
            // Gestern (Index 203) = 90 (< SMA)
            // Heute (Index 204) = 90 (< SMA)
            mstr: (i) => i >= 200 ? 90 : 100
        });

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('MSTR bleibt unter SMA 200');
    });

    it('sollte WARNING zurückgeben (Edge Case): prevMstr fehlt, aber mstr stürzt ab', () => {
        const timeline = generateTimeline(205, {
            mstr: (i) => {
                if (i === 203) return null; // Gestern fehlt
                if (i === 204) return 90;   // Heute da
                return 100;
            }
        });
        // Wenn prevMstr null ist, schlägt der CRITICAL-Check fehl (null >= 100 ist false).
        // Daher fällt er in den WARNING-Check zurück, was korrekt ist, da mstr < SMA ist.
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
    });

    it('sollte OK zurückgeben: MSTR liegt stabil über SMA 200', () => {
        const timeline = generateTimeline(205, {
            // Alle Tage 100, heute 110. SMA ist ca. 100.05. MSTR > SMA.
            mstr: (i) => i === 204 ? 110 : 100
        });

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).toContain('MSTR intakt');
    });

    it('sollte komplexe Volatilität (Sinus-Kurve) verarbeiten und ein echtes Death Cross erkennen', () => {
        // Wir generieren 205 Tage Markt-Rauschen. 
        // Basis-Wert ist 100, plus eine Sinus-Welle mit Amplitude 20, plus deterministisches Noise.
        const timeline = generateTimeline(205, {
            mstr: (i) => {
                const wave = Math.sin(i / 100 * Math.PI * 2) * 20; 
                const noise = (i % 3) - 1; // (-1, 0, +1)
                
                // Am letzten Tag erzwingen wir einen massiven Crash unter den SMA
                if (i === 204) return 10; 
                // Gestern erzwingen wir, dass er definitiv über dem SMA war
                if (i === 203) return 200; 
                
                return 100 + wave + noise;
            }
        });
        
        // Da gestern 200 war (weit über dem Durchschnitt) und heute 10 ist (weit darunter),
        // muss der Indikator zwingend ein CRITICAL feuern und sich nicht von der Vola stören lassen.
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('VERLIERT SMA 200');
    });

    it('sollte OK zurückgeben, wenn der Kurs die SMA-Linie auf den Cent exakt berührt (Gleichstand)', () => {
        // Timeline durchgehend auf exakt 100
        const timeline = generateTimeline(205, {
            mstr: (i) => 100
        });
        // SMA200 ist exakt 100. Heute (Index 204) ist exakt 100.
        // Bedingung: mstr (100) < mstrSma200 (100) ist FALSE. Es darf keine Panik geben.
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte bei einem extremen Gap-Down korrekte Drop-Prozentwerte berechnen', () => {
        const timeline = generateTimeline(205, {
            // Alle Historien-Werte sind 200. Heute stürzt er aus dem Nichts auf 50 ab.
            mstr: (i) => i === 204 ? 50 : 200
        });
        
        // SMA200 von heute: (199 * 200 + 1 * 50) / 200 = 199.25
        // Drop = ((50 - 199.25) / 199.25) * 100 = -74.905...% -> gerundet -74.9%
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toContain('-74.9%');
    });
});
