import { describe, it, expect, beforeEach } from 'vitest';
import { MlRegimeRadarCryptoIndicator } from '../../../src/analysis/indicators/MlRegimeRadarCryptoIndicator.js';

describe('MlRegimeRadarCryptoIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new MlRegimeRadarCryptoIndicator();
    });

    const createTimeline = (mlRegime) => {
        return [{
            date: '2023-01-01',
            mlRegime: mlRegime
        }];
    };

    it('returns UNKNOWN if timeline is empty', () => {
        const result = indicator.evaluate([]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine ML Daten');
    });

    it('returns UNKNOWN if mlRegime is missing', () => {
        const timeline = [{ date: '2023-01-01' }]; // no mlRegime
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('returns UNKNOWN if mlRegime.phase is missing', () => {
        const timeline = createTimeline({ confidence: 0.9 });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('returns CRITICAL for MACRO_TOP', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'MACRO_TOP', confidence: 0.95 }));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('TOP (95.0%)');
        expect(result.message).toContain('KRYPTO-ZYKLUSENDE');
    });

    it('returns CRITICAL for MACRO_BOTTOM', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'MACRO_BOTTOM', confidence: 0.88 }));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('BOTTOM (88.0%)');
        expect(result.message).toContain('KRYPTO-BODEN');
    });

    it('returns WARNING for DOWNTREND', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'DOWNTREND', confidence: 0.75 }));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('DOWNTREND (75.0%)');
        expect(result.message).toContain('Abwärtstrend');
    });

    it('returns OK and outputs the actual phase dynamically (logical fix)', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'CHOP', confidence: 0.50 }));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('CHOP (50.0%)'); // <-- Logik gefixt!
        expect(result.message).toContain('Krypto-Zyklus intakt (oder neutral)');
    });

    it('handles missing confidence mathematically without throwing and yields 0.0%', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'MACRO_TOP' }));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('TOP (0.0%)'); // <-- Fallback greift
    });
});
