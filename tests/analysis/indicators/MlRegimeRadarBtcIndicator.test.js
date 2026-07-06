import { describe, it, expect, beforeEach } from 'vitest';
import { MlRegimeRadarBtcIndicator } from '../../../src/analysis/indicators/MlRegimeRadarBtcIndicator.js';

describe('MlRegimeRadarBtcIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new MlRegimeRadarBtcIndicator();
    });

    const createTimeline = (mlRegimeBtc) => {
        return [{
            date: '2023-01-01',
            mlRegimeBtc: mlRegimeBtc
        }];
    };

    it('returns UNKNOWN if timeline is empty', () => {
        const result = indicator.evaluate([]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('returns UNKNOWN if mlRegimeBtc is missing', () => {
        const timeline = [{ date: '2023-01-01' }]; // no mlRegimeBtc
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine ML Prognose');
    });

    // --- CRITICAL PATHS (TOP / BOTTOM) ---
    it('returns CRITICAL for MACRO_TOP', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'MACRO_TOP', confidence: 0.95 }));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('TOP (95.0%)');
        expect(result.message).toContain('Verteilungsphase');
    });

    it('returns CRITICAL for CYCLE_TOP', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'CYCLE_TOP', confidence: 0.88 }));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('TOP (88.0%)');
    });

    it('returns CRITICAL for MACRO_BOTTOM', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'MACRO_BOTTOM', confidence: 0.92 }));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('BOTTOM (92.0%)');
        expect(result.message).toContain('Kaufgelegenheit');
    });

    it('returns CRITICAL for CYCLE_BOTTOM', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'CYCLE_BOTTOM', confidence: 0.80 }));
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('BOTTOM (80.0%)');
    });

    // --- WARNING PATHS ---
    it('returns WARNING for BEAR_MARKET with high confidence (> 0.6)', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'BEAR_MARKET', confidence: 0.65 }));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('BEAR (65.0%)');
    });

    it('returns WARNING for DOWNTREND with high confidence (> 0.6)', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'DOWNTREND', confidence: 0.61 }));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('BEAR (61.0%)');
    });

    it('returns WARNING for BEAR_RALLY (regardless of confidence)', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'BEAR_RALLY', confidence: 0.30 }));
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('BEAR RALLY (30.0%)');
        expect(result.message).toContain('Dead Cat Bounce');
    });

    // --- FALLBACK TO NEUTRAL FOR LOW CONFIDENCE BEAR ---
    it('returns OK (Neutral) for BEAR_MARKET with low confidence (<= 0.6)', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'BEAR_MARKET', confidence: 0.60 }));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('BEAR_MARKET (60.0%)');
        expect(result.message).toContain('Neutrales');
    });

    // --- OK PATHS ---
    it('returns OK for BULL_MARKET', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'BULL_MARKET', confidence: 0.90 }));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('BULL (90.0%)');
    });

    it('returns OK for UPTREND', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'UPTREND', confidence: 0.70 }));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('BULL (70.0%)');
    });

    it('returns OK for BULL_CORRECTION', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'BULL_CORRECTION', confidence: 0.50 }));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('CORRECTION (50.0%)');
    });

    it('returns OK for unknown phases (fallback)', () => {
        const result = indicator.evaluate(createTimeline({ phase: 'CHOP', confidence: 0.45 }));
        expect(result.status).toBe('OK');
        expect(result.value).toBe('CHOP (45.0%)');
    });

    // --- HARTE EDGE CASES ---
    it('handles malformed objects (missing confidence) without crashing but returns NaN%', () => {
        // API liefert Phase, vergisst aber Confidence
        const result = indicator.evaluate(createTimeline({ phase: 'CHOP' }));
        expect(result.status).toBe('OK');
        // undefined * 100 = NaN -> NaN.toFixed(1) = "NaN" -> "NaN%"
        expect(result.value).toBe('CHOP (NaN%)');
    });
});
