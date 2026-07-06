import { describe, it, expect, beforeEach } from 'vitest';
import { BklnIndicator } from '../../../src/analysis/indicators/BklnIndicator.js';

describe('BklnIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new BklnIndicator();
    });

    const generateTimeline = (length, overrides = {}) => {
        return Array(length).fill(0).map((_, i) => ({
            assets: {
                BKLN: overrides.bkln !== undefined ? overrides.bkln(i) : 100
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
        const timeline = generateTimeline(40);
        timeline[39].assets.BKLN = null;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN zurückgeben, wenn historische Daten (past30) fehlen', () => {
        const timeline = generateTimeline(40);
        timeline[10].assets.BKLN = null; // 40 - 30 = 10 (Index 10)
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');
    });

    it('sollte CRITICAL zurückgeben, wenn perf exakt dem Threshold entspricht (-2.0%)', () => {
        // past30 (Index 10) = 100, current (Index 39) = 98 -> exakt -2.0%
        const timeline = generateTimeline(40, {
            bkln: (i) => i === 10 ? 100 : (i === 39 ? 98 : 100)
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('-2.0%');
    });

    it('sollte WARNING zurückgeben, wenn perf tiefer als -1.0% aber höher als -2.0% ist', () => {
        const timeline = generateTimeline(40, {
            bkln: (i) => i === 10 ? 100 : (i === 39 ? 98.5 : 100) // -1.5%
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('-1.5%');
    });

    it('sollte WARNING zurückgeben, wenn perf exakt dem Threshold entspricht (-1.0%)', () => {
        const timeline = generateTimeline(40, {
            bkln: (i) => i === 10 ? 100 : (i === 39 ? 99 : 100) // -1.0%
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('-1.0%');
    });

    it('sollte OK zurückgeben, wenn BKLN steigt (positiv)', () => {
        const timeline = generateTimeline(40, {
            bkln: (i) => i === 10 ? 100 : (i === 39 ? 105 : 100) // +5.0%
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('5.0%');
    });

    // Mathematischer Edge-Case: Division durch Null
    it('sollte mathematische Extremwerte (Division durch 0) abfangen', () => {
        // past30 = 0, current = -5 -> Perf = -Infinity -> CRITICAL
        const timelineInfinity = generateTimeline(40, {
            bkln: (i) => i === 10 ? 0 : (i === 39 ? -5 : 100)
        });
        const result = indicator.evaluate(timelineInfinity);
        // Da Javascript bei (-5 / 0) = -Infinity ausgibt und -Infinity <= -2.0 ist:
        expect(result.status).toBe('CRITICAL');
        
        // past30 = 0, current = 0 -> Perf = NaN -> false bei <= -> OK
        const timelineNaN = generateTimeline(40, {
            bkln: (i) => i === 10 ? 0 : (i === 39 ? 0 : 100)
        });
        const resultNaN = indicator.evaluate(timelineNaN);
        expect(resultNaN.status).toBe('OK');
        expect(resultNaN.value).toBe('NaN%');
    });
});
