import { describe, it, expect, beforeEach } from 'vitest';
import { MaturityWallIndicator } from '../../../src/analysis/indicators/MaturityWallIndicator.js';

describe('MaturityWallIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new MaturityWallIndicator();
    });

    const createTimeline = (length, maturityPct) => {
        const timeline = [];
        for (let i = 0; i < length; i++) {
            timeline.push({
                date: `2020-01-${(i + 1).toString().padStart(2, '0')}`,
                macroGroups: {
                    Leading: {
                        MaturityWallPct: maturityPct
                    }
                }
            });
        }
        return timeline;
    };

    it('returns UNKNOWN if timeline is less than 1 day', () => {
        const timeline = [];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('returns UNKNOWN if MaturityWallPct is missing', () => {
        const timeline = createTimeline(1, undefined);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Daten');
    });

    it('gracefully handles missing macroGroups object without throwing TypeError', () => {
        const timeline = createTimeline(1, 10);
        
        // Simuliere fehlendes macroGroups Objekt für den aktuellen Tag
        delete timeline[0].macroGroups;
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Daten');
    });

    it('returns CRITICAL if MaturityWallPct > 21', () => {
        const timeline = createTimeline(1, 25.55);
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('Roter Alarm');
        expect(result.value).toBe('25.55%');
    });

    it('returns WARNING if MaturityWallPct is between 15 and 21', () => {
        const timeline = createTimeline(1, 18.20);
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('System beginnt zu ächzen');
        expect(result.value).toBe('18.20%');
    });

    it('returns OK if MaturityWallPct is <= 15', () => {
        const timeline = createTimeline(1, 10.50);
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('OK');
        expect(result.message).toContain('Normale Baseline');
        expect(result.value).toBe('10.50%');
    });

    it('handles exact boundary condition for CRITICAL (e.g. exactly 21)', () => {
        // threshold ist > 21, also sollte 21.0 WARNING sein
        const timeline = createTimeline(1, 21.0);
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('21.00%');
    });

    it('handles exact boundary condition for WARNING (e.g. exactly 15)', () => {
        // threshold ist > 15, also sollte 15.0 OK sein
        const timeline = createTimeline(1, 15.0);
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('OK');
        expect(result.value).toBe('15.00%');
    });
});
