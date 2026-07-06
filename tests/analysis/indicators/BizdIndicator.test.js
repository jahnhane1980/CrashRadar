import { describe, it, expect, beforeEach } from 'vitest';
import { BizdIndicator } from '../../../src/analysis/indicators/BizdIndicator.js';

describe('BizdIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new BizdIndicator();
    });

    const generateTimeline = (length, overrides = {}) => {
        return Array(length).fill(0).map((_, i) => ({
            assets: {
                BIZD: overrides.bizd ? overrides.bizd(i) : 100
            }
        }));
    };

    it('sollte UNKNOWN zurückgeben, wenn die Timeline < 30 Tage ist', () => {
        const timeline = generateTimeline(29);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('< 30 Tage');
    });

    it('sollte UNKNOWN zurückgeben, wenn aktuelle Daten null sind', () => {
        const timeline = generateTimeline(35);
        timeline[34].assets.BIZD = null;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN zurückgeben, wenn vergangene Daten (past30) null sind', () => {
        const timeline = generateTimeline(35);
        timeline[5].assets.BIZD = null; // timeline.length (35) - 30 = 5
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');
    });

    it('sollte CRITICAL zurückgeben, wenn perf <= -5.0%', () => {
        const timeline = generateTimeline(35, {
            bizd: (i) => i === 5 ? 100 : (i === 34 ? 90 : 100) // -10%
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('-10.0%');
    });

    it('sollte WARNING zurückgeben, wenn perf <= -2.5% und > -5.0%', () => {
        const timeline = generateTimeline(35, {
            bizd: (i) => i === 5 ? 100 : (i === 34 ? 96.5 : 100) // -3.5%
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('-3.5%');
    });

    it('sollte OK zurückgeben, wenn perf > -2.5%', () => {
        const timeline = generateTimeline(35, {
            bizd: (i) => i === 5 ? 100 : (i === 34 ? 99 : 100) // -1.0%
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('-1.0%');
    });
});
