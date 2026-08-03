import { describe, it, expect } from 'vitest';
import { GdxGoldDivergenceIndicator } from '../../../src/analysis/indicators/GdxGoldDivergenceIndicator.js';

describe('GdxGoldDivergenceIndicator', () => {
    const indicator = new GdxGoldDivergenceIndicator();

    it('sollte UNKNOWN liefern bei zu kurzer Timeline (< 30 Tage)', () => {
        const shortTimeline = Array(15).fill({ assets: { Gold: 2000, GDX: 30 } });
        const result = indicator.evaluate(shortTimeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('sollte UNKNOWN liefern bei fehlenden Gold/GDX Asset-Daten', () => {
        const invalidTimeline = Array(35).fill({ assets: {} });
        const result = indicator.evaluate(invalidTimeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Daten');
    });

    it('sollte OK liefern bei synchroner Preisbewegung ohne Divergenz', () => {
        const timeline = [];
        for (let i = 0; i < 35; i++) {
            timeline.push({
                date: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: { Gold: 2000 + i, GDX: 30 + (i * 0.1) }
            });
        }
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte WARNING liefern bei bearischer Top-Divergenz (GDX toppt vor Gold)', () => {
        const timeline = [];
        for (let i = 0; i < 35; i++) {
            let gold = 2000;
            let gdx = 30;

            if (i === 15) {
                gdx = 40.0; // GDX Hoch an Tag 15 (19 Tage her)
            } else if (i < 15) {
                gdx = 30 + i;
            } else {
                gdx = 32.0; // GDX gefallen um > 3%
            }

            if (i === 34) {
                gold = 2500; // Gold am Hoch an Tag 34 (heute, <= 5 Tage)
            } else {
                gold = 2000 + i;
            }

            timeline.push({
                date: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: { Gold: gold, GDX: gdx }
            });
        }

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('GDX toppt vor Gold');
    });

    it('sollte CRITICAL liefern bei bullischer Boden-Divergenz (GDX erholt sich während Gold Tief testet)', () => {
        const timeline = [];
        for (let i = 0; i < 35; i++) {
            let gold = 2000;
            let gdx = 30;

            // GDX Tiefstpunkt an Tag 10 (24 Tage her)
            if (i === 10) {
                gdx = 20.0;
            } else if (i > 10) {
                gdx = 25.0; // GDX hat sich um +25% vom Tief erholt (>= +3.0%)
            } else {
                gdx = 30;
            }

            // Gold Tiefstpunkt heute (Tag 34, <= 5 Tage her)
            if (i === 34) {
                gold = 1500; // Gold am neuen Tiefststand
            } else {
                gold = 2000;
            }

            timeline.push({
                date: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: { Gold: gold, GDX: gdx }
            });
        }

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.category).toBe('BOTTOM_FINDER');
        expect(result.message).toContain('BULLISCHE MINEN-DIVERGENZ');
    });
});
