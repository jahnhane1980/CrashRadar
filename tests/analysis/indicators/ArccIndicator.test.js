import { describe, it, expect, beforeEach } from 'vitest';
import { ArccIndicator } from '../../../src/analysis/indicators/ArccIndicator.js';

describe('ArccIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new ArccIndicator();
    });

    const generateTimeline = (length, overrides = {}) => {
        return Array(length).fill(0).map((_, i) => {
            return {
                macroGroups: {
                    Fundamentals: {
                        ARCC_InterestExpense: 100,
                        ...overrides
                    }
                }
            };
        });
    };

    it('sollte UNKNOWN zurückgeben, wenn die Timeline kürzer als 90 Tage ist', () => {
        const timeline = generateTimeline(89);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('< 90 Tage');
    });

    it('sollte CRITICAL zurückgeben, wenn das Wachstum >= 15% ist', () => {
        const timeline = generateTimeline(91);
        timeline[0].macroGroups.Fundamentals.ARCC_InterestExpense = 100; // Tag -90 (Index 0, wenn Length 91 ist? Nein, 91 - 90 = 1. Machen wir es sicher:)
        timeline[timeline.length - 90].macroGroups.Fundamentals.ARCC_InterestExpense = 100;
        timeline[timeline.length - 1].macroGroups.Fundamentals.ARCC_InterestExpense = 115; // +15%
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
    });

    it('sollte WARNING zurückgeben, wenn das Wachstum >= 5% und < 15% ist', () => {
        const timeline = generateTimeline(91);
        timeline[timeline.length - 90].macroGroups.Fundamentals.ARCC_InterestExpense = 100;
        timeline[timeline.length - 1].macroGroups.Fundamentals.ARCC_InterestExpense = 106; // +6%
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
    });

    it('sollte OK zurückgeben, wenn das Wachstum < 5% ist (positiv)', () => {
        const timeline = generateTimeline(91);
        timeline[timeline.length - 90].macroGroups.Fundamentals.ARCC_InterestExpense = 100;
        timeline[timeline.length - 1].macroGroups.Fundamentals.ARCC_InterestExpense = 102; // +2%
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.value).toContain('+2.0%');
    });

    it('sollte UNKNOWN zurückgeben, wenn die Fundamentaldaten fehlen', () => {
        const timeline = generateTimeline(91);
        delete timeline[timeline.length - 1].macroGroups.Fundamentals.ARCC_InterestExpense;
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Fundamentaldaten');
    });

    it('sollte OK zurückgeben und das Plus-Zeichen weglassen, wenn das Wachstum negativ ist', () => {
        const timeline = generateTimeline(91);
        timeline[timeline.length - 90].macroGroups.Fundamentals.ARCC_InterestExpense = 100;
        timeline[timeline.length - 1].macroGroups.Fundamentals.ARCC_InterestExpense = 95; // -5%
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('-5.0%');
    });
});
