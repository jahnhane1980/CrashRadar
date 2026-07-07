import { describe, it, expect } from 'vitest';
import { MlRegimeRadarQqqIndicator } from '../../../src/analysis/indicators/MlRegimeRadarQqqIndicator.js';

describe('MlRegimeRadarQqqIndicator', () => {
    const indicator = new MlRegimeRadarQqqIndicator();

    it('should have correct name and category', () => {
        expect(indicator.name).toBe('ML Regime Radar (QQQ)');
        expect(indicator.category).toBe('LEADING');
    });

    it('should return UNKNOWN if timeline is empty', () => {
        const result = indicator.evaluate([]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Zu wenig (oder ungültige) Daten');
    });

    it('should return UNKNOWN if mlRegimeQqq is missing', () => {
        const result = indicator.evaluate([{ date: '2023-01-01' }]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine (vollständige) ML Prognose vorhanden');
    });

    it('should return UNKNOWN if mlRegimeQqq.phase is missing', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { confidence: 0.8 } }]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine (vollständige) ML Prognose vorhanden');
    });

    it('should return CRITICAL / TOP for MACRO_TOP', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'MACRO_TOP', confidence: 0.95 } }]);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('TOP (95.0%)');
    });

    it('should return CRITICAL / TOP for CYCLE_TOP', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'CYCLE_TOP', confidence: 0.82 } }]);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('TOP (82.0%)');
    });

    it('should return WARNING / BEAR for DOWNTREND with conf > 0.6', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'DOWNTREND', confidence: 0.75 } }]);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('BEAR (75.0%)');
    });

    it('should return OK / generic phase for DOWNTREND with conf === 0.6 (boundary test)', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'DOWNTREND', confidence: 0.60 } }]);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('DOWNTREND (60.0%)');
    });

    it('should return WARNING / BEAR for BEAR_MARKET with conf > 0.6', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'BEAR_MARKET', confidence: 0.65 } }]);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('BEAR (65.0%)');
    });

    it('should return OK / generic phase for DOWNTREND with conf <= 0.6', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'DOWNTREND', confidence: 0.50 } }]);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('DOWNTREND (50.0%)');
    });

    it('should return CRITICAL / BOTTOM for MACRO_BOTTOM', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'MACRO_BOTTOM', confidence: 0.99 } }]);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('BOTTOM (99.0%)');
    });

    it('should return CRITICAL / BOTTOM for CYCLE_BOTTOM', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'CYCLE_BOTTOM', confidence: 0.81 } }]);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('BOTTOM (81.0%)');
    });

    it('should return OK / BULL for UPTREND', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'UPTREND', confidence: 0.70 } }]);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('BULL (70.0%)');
    });

    it('should return OK / BULL for BULL_MARKET', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'BULL_MARKET', confidence: 0.85 } }]);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('BULL (85.0%)');
    });

    it('should return OK / generic phase for SIDEWAYS', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'SIDEWAYS', confidence: 0.40 } }]);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('SIDEWAYS (40.0%)');
    });

    it('chaos: should return UNKNOWN for garbage string phase', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'MODEL_ERROR', confidence: 0.99 } }]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Unbekannte ML-Phase: MODEL_ERROR');
    });

    it('chaos: should return UNKNOWN for non-string phase (e.g. array)', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: ['UPTREND'], confidence: 0.99 } }]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Unbekannte ML-Phase: UPTREND');
    });

    // --- Chaos Tests ---

    it('chaos: should handle null timeline gracefully', () => {
        const result = indicator.evaluate(null);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Zu wenig (oder ungültige) Daten');
    });

    it('chaos: should handle missing current day gracefully', () => {
        const result = indicator.evaluate([null]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine (vollständige) ML Prognose vorhanden');
    });

    it('chaos: should fallback to 0.0% if confidence is missing', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'UPTREND' } }]);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('BULL (0.0%)');
    });

    it('chaos: should output negative percentage for negative confidence', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'UPTREND', confidence: -0.2 } }]);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('BULL (-20.0%)');
    });

    it('chaos: should fallback to 0.0% if confidence is missing', () => {
        const result = indicator.evaluate([{ mlRegimeQqq: { phase: 'UPTREND' } }]);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('BULL (0.0%)');
    });
});
