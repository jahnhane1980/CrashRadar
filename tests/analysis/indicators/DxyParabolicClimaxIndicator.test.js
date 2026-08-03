import { describe, it, expect } from 'vitest';
import { DxyParabolicClimaxIndicator } from '../../../src/analysis/indicators/DxyParabolicClimaxIndicator.js';

describe('DxyParabolicClimaxIndicator', () => {
    const indicator = new DxyParabolicClimaxIndicator();

    it('sollte UNKNOWN liefern bei zu kurzer Timeline (< 21 Tage)', () => {
        const shortTimeline = Array(15).fill({ assets: { DXY: 100 } });
        const result = indicator.evaluate(shortTimeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('sollte UNKNOWN liefern bei fehlenden DXY Asset-Daten', () => {
        const invalidTimeline = Array(25).fill({ assets: {} });
        const result = indicator.evaluate(invalidTimeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine DXY-Daten');
    });

    it('sollte OK liefern bei normalem DXY Anstieg (< +3.0%)', () => {
        const timeline = [];
        for (let i = 0; i < 25; i++) {
            // Anstieg von 100 auf 101.5 in 20 Tagen (ROC = +1.5%)
            timeline.push({
                date: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: { DXY: 100 + (i * 0.06) }
            });
        }
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte WARNING liefern bei parabolischem Anstieg (ROC >= +3.0%) ohne Erschöpfungsknick', () => {
        const timeline = [];
        for (let i = 0; i < 25; i++) {
            // Anstieg von 100 auf 107.2 in 20 Tagen (ROC = +5.9%), heute weiter gestiegen
            timeline.push({
                date: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: { DXY: 100 + (i * 0.3) }
            });
        }
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('DXY Parabel steilt an');
    });

    it('sollte CRITICAL liefern bei parabolischem Anstieg (ROC >= +3.0%) UND Erschöpfungsknick (heute tiefer als gestern)', () => {
        const timeline = [];
        for (let i = 0; i < 25; i++) {
            let dxy = 100 + (i * 0.3);
            if (i === 24) {
                // Gestern 106.9, heute Erschöpfung auf 105.0 (ROC +3.75% gegenüber Tag 4: 101.2)
                dxy = 105.0;
            }
            timeline.push({
                date: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: { DXY: dxy }
            });
        }

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.category).toBe('BOTTOM_FINDER');
        expect(result.message).toContain('DXY PARABOLIC CLIMAX');
    });

    it('sollte alternative DXY Key-Namen (DX-Y.NYB und macroGroups) unterstützen', () => {
        const timeline = [];
        for (let i = 0; i < 25; i++) {
            let dxy = 100 + (i * 0.3);
            if (i === 24) dxy = 105.0;
            timeline.push({
                date: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
                macroGroups: { FinancialConditions: { Dxy: dxy } }
            });
        }
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
    });
});
