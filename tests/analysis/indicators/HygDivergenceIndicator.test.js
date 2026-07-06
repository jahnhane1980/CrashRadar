import { describe, it, expect, beforeEach } from 'vitest';
import { HygDivergenceIndicator } from '../../../src/analysis/indicators/HygDivergenceIndicator.js';

describe('HygDivergenceIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new HygDivergenceIndicator();
    });

    const createTimeline = (length) => {
        const timeline = [];
        let basePrice = 100;
        for (let i = 0; i < length; i++) {
            // Rauschen
            const noise = (Math.random() - 0.5) * 5;
            timeline.push({
                date: `2020-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: {
                    HYG: basePrice + noise
                }
            });
        }
        return timeline;
    };

    it('returns UNKNOWN if timeline is less than 30 days', () => {
        const timeline = createTimeline(29);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('returns CRITICAL if HYG drops by 3.0% or more', () => {
        const timeline = createTimeline(40);
        
        timeline[10].assets.HYG = 100; // past30 (index 40 - 30 = 10)
        timeline[39].assets.HYG = 97;  // current (index 39) -> exakt -3.0%
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('-3.0%');
    });

    it('returns WARNING if HYG drops between 1.5% and 3.0%', () => {
        const timeline = createTimeline(40);
        
        timeline[10].assets.HYG = 100;
        timeline[39].assets.HYG = 98.5;  // exakt -1.5%
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('-1.5%');
    });

    it('returns OK if HYG drop is less severe than 1.5%', () => {
        const timeline = createTimeline(40);
        
        timeline[10].assets.HYG = 100;
        timeline[39].assets.HYG = 98.6;  // -1.4%
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    // --- HARTE EDGE CASES ---

    it('returns UNKNOWN if data is undefined (missing key) to prevent NaN calculation', () => {
        const timeline = createTimeline(40);
        
        // Löschen der Eigenschaft simuliert fehlende Daten aus der API
        // Ergibt undefined, nicht null!
        delete timeline[39].assets.HYG;
        
        const result = indicator.evaluate(timeline);
        
        // Wir erwarten, dass er merkt, dass keine Daten da sind.
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Daten');
    });

    it('handles division by zero mathematically safely without crashing', () => {
        const timeline = createTimeline(40);
        
        timeline[10].assets.HYG = 0; // past30
        timeline[39].assets.HYG = 50; // current
        
        const result = indicator.evaluate(timeline);
        // (50 - 0) / 0 = Infinity. Infinity <= -1.5 is false. Returns OK.
        // Wir prüfen nur, dass er nicht abstürzt und einen String liefert.
        expect(result.status).toBe('OK');
        expect(result.value).toContain('Infinity');
    });

    it('handles negative prices correctly without throwing', () => {
        const timeline = createTimeline(40);
        
        timeline[10].assets.HYG = -100; // past30
        timeline[39].assets.HYG = -105; // current
        
        // (-105 - -100) / -100 = -5 / -100 = +0.05 = +5%
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('5.0%');
    });
});
