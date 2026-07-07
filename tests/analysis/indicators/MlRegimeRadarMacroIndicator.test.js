import { describe, it, expect } from 'vitest';
import { MlRegimeRadarMacroIndicator } from '../../../src/analysis/indicators/MlRegimeRadarMacroIndicator.js';

describe('MlRegimeRadarMacroIndicator', () => {
    const indicator = new MlRegimeRadarMacroIndicator();

    it('should have correct name and category', () => {
        expect(indicator.name).toBe('ML Regime Radar (Makro)');
        expect(indicator.category).toBe('LEADING');
    });

    it('should return UNKNOWN if timeline is empty', () => {
        const result = indicator.evaluate([]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine (oder ungültige) Daten');
    });

    it('should return UNKNOWN if mlRegime is missing', () => {
        const result = indicator.evaluate([{ date: '2023-01-01' }]);
        expect(result.status).toBe('UNKNOWN');
    });

    it('should return UNKNOWN if mlRegime.phase is missing', () => {
        const result = indicator.evaluate([{ 
            date: '2023-01-01',
            mlRegime: { confidence: 0.8 } 
        }]);
        expect(result.status).toBe('UNKNOWN');
    });

    it('should return CRITICAL / MACRO_TOP', () => {
        const result = indicator.evaluate([{ 
            date: '2023-01-01',
            mlRegime: { phase: 'MACRO_TOP', confidence: 0.95 } 
        }]);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('TOP (95.0%)');
    });

    it('should return CRITICAL / MACRO_BOTTOM', () => {
        const result = indicator.evaluate([{ 
            date: '2023-01-01',
            mlRegime: { phase: 'MACRO_BOTTOM', confidence: 0.885 } 
        }]);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('BOTTOM (88.5%)');
    });

    it('should return WARNING / DOWNTREND', () => {
        const result = indicator.evaluate([{ 
            date: '2023-01-01',
            mlRegime: { phase: 'DOWNTREND', confidence: 0.65 } 
        }]);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('DOWNTREND (65.0%)');
    });

    it('should return OK / UPTREND for any other phase', () => {
        const result = indicator.evaluate([{ 
            date: '2023-01-01',
            mlRegime: { phase: 'UPTREND', confidence: 0.72 } 
        }]);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('UPTREND (72.0%)');
        expect(result.message).toContain('intakten Aufwärtstrend');
    });

    it('chaos: should handle missing confidence gracefully without crashing and fallback to 0', () => {
        const result = indicator.evaluate([{ 
            date: '2023-01-01',
            mlRegime: { phase: 'DOWNTREND' } // confidence fehlt!
        }]);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('DOWNTREND (0.0%)'); // Neues Verhalten: Fallback auf 0
    });

    it('chaos: should handle null or invalid timeline gracefully without crashing', () => {
        const result = indicator.evaluate(null);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine (oder ungültige) Daten');
    });
});
