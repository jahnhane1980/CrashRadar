import { describe, it, expect } from 'vitest';
import { DarkPoolAccumulationIndicator } from '../../../src/analysis/indicators/DarkPoolAccumulationIndicator.js';

describe('DarkPoolAccumulationIndicator', () => {
    it('sollte korrekte Metadaten haben', () => {
        const indicator = new DarkPoolAccumulationIndicator();
        expect(indicator.name).toBe('Dark Pool Wal-Akkumulation (DIX)');
        expect(indicator.category).toBe('BOTTOM_FINDER');
    });

    it('sollte UNKNOWN zurückgeben, wenn keine Timeline vorhanden ist', () => {
        const indicator = new DarkPoolAccumulationIndicator();
        expect(indicator.evaluate(null)).toEqual({ status: 'UNKNOWN', message: 'Zu wenig Daten' });
        expect(indicator.evaluate([])).toEqual({ status: 'UNKNOWN', message: 'Zu wenig Daten' });
    });

    it('sollte UNKNOWN zurückgeben, wenn DIX fehlt oder ungültig ist', () => {
        const indicator = new DarkPoolAccumulationIndicator();
        expect(indicator.evaluate([{ assets: {} }])).toEqual({ status: 'UNKNOWN', message: 'Keine DIX-Daten vorhanden' });
        expect(indicator.evaluate([{ assets: { DIX: 'invalid' } }])).toEqual({ status: 'UNKNOWN', message: 'Ungültige DIX-Daten (keine Zahl)' });
    });

    it('sollte DIX normalisieren (von Dezimal 0.46 auf 46.0%)', () => {
        const indicator = new DarkPoolAccumulationIndicator();
        const timeline = [
            { assets: { DIX: 0.42 } },
            { assets: { DIX: 0.43 } },
            { assets: { DIX: 0.49 } }
        ];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toContain('DIX:49.0%');
    });

    it('sollte CRITICAL melden, wenn Tageswert >= 48% ist (starke Akkumulation)', () => {
        const indicator = new DarkPoolAccumulationIndicator();
        const timeline = [
            { assets: { DIX: 42 } },
            { assets: { DIX: 43 } },
            { assets: { DIX: 48.5 } }
        ];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('WAL-AKKUMULATION!');
    });

    it('sollte CRITICAL melden, wenn der 3-Tage-Schnitt >= 45% ist', () => {
        const indicator = new DarkPoolAccumulationIndicator();
        const timeline = [
            { assets: { DIX: 46 } },
            { assets: { DIX: 45.5 } },
            { assets: { DIX: 45 } }
        ];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toContain('3d:45.5%');
    });

    it('sollte WARNING melden, wenn Einzeltag >= 45%, aber 3-Tage-Schnitt < 45%', () => {
        const indicator = new DarkPoolAccumulationIndicator();
        const timeline = [
            { assets: { DIX: 40 } },
            { assets: { DIX: 41 } },
            { assets: { DIX: 45.5 } }
        ];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Erhöhte Dark-Pool-Käufe');
    });

    it('sollte OK melden bei normaler Aktivität (< 45%)', () => {
        const indicator = new DarkPoolAccumulationIndicator();
        const timeline = [
            { assets: { DIX: 41 } },
            { assets: { DIX: 42 } },
            { assets: { DIX: 43 } }
        ];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).toContain('normalen Bereich');
    });
});
