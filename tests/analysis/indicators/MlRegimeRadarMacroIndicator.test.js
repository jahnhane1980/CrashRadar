import { describe, it, expect } from 'vitest';
import { MlRegimeRadarMacroIndicator } from '../../../src/analysis/indicators/MlRegimeRadarMacroIndicator.js';

describe('MlRegimeRadarMacroIndicator', () => {
    const indicator = new MlRegimeRadarMacroIndicator();

    it('should have correct name and category', () => {
        expect(indicator.name).toBe('ML Regime Radar (Makro)');
        expect(indicator.category).toBe('EARLY_WARNING');
    });

    it('should return UNKNOWN if timeline is empty', () => {
        const result = indicator.evaluate([]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine (oder ungültige) Daten');
    });

    it('should return UNKNOWN if mlRegime and macroGroups are missing', () => {
        const result = indicator.evaluate([{ date: '2023-01-01' }]);
        expect(result.status).toBe('UNKNOWN');
    });

    it('should return UNKNOWN if mlRegime.phase is missing and no macroGroups exist', () => {
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

    it('should evaluate live macroGroups timeline data via MacroMlService', () => {
        const timeline = [{
            date: '2026-08-22',
            assets: {
                SPY: 765.72,
                VIX: 15.13,
                SKEW: 143.9,
                DIX: 0.463,
                SPY_ShortVolumeRatio: 0.557,
                TotalPCR: 1.16,
                Gold: 4661.6,
                DXY: 98.84
            },
            macroGroups: {
                YieldCurve: { Spread10y2y: 0.50, Spread10y3m: 0.50 },
                FinancialConditions: { RealYield10y: 2.16, FedFundsRate: 4.33, ChicagoFedIndex: -0.559, DXY: 98.84 },
                BankingHealth: { TotalReserves: 3018.8, BankReserves: 2935300, EmergencyBorrowing: 0 },
                NetLiquidity: { TGA: 935.1, RRPONTSYD: 0.2, WALCL: 6745.7 },
                Leading: { MaturityWallPct: 11.78, MarginDebt: 1417225, Challenger: 40000 }
            }
        }];

        const result = indicator.evaluate(timeline);
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('value');
        expect(result).toHaveProperty('message');
        expect(['OK', 'WARNING', 'CRITICAL']).toContain(result.status);
        expect(result.value).toContain('% Risk');
    });

    it('should support mock MacroMlService returning CRITICAL / ACUTE_CRASH_RISK', () => {
        const mockService = {
            predict: () => ({
                probability: 0.864,
                riskPct: 86.4,
                regime: 'ACUTE_CRASH_RISK',
                topDrivers: [{ feature: 'Labor_CE16OV_Delta3M' }, { feature: 'DIX_DarkPool_Pct' }]
            })
        };

        const customIndicator = new MlRegimeRadarMacroIndicator(mockService);
        const result = customIndicator.evaluate([{
            date: '2026-08-22',
            macroGroups: { YieldCurve: { Spread10y2y: -0.5 } }
        }]);

        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('86.4% Risk');
        expect(result.message).toContain('Akutes Crash-Risiko');
    });

    it('chaos: should handle missing confidence gracefully without crashing and fallback to 0', () => {
        const result = indicator.evaluate([{ 
            date: '2023-01-01',
            mlRegime: { phase: 'DOWNTREND' }
        }]);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('DOWNTREND (0.0%)');
    });

    it('chaos: should handle null or invalid timeline gracefully without crashing', () => {
        const result = indicator.evaluate(null);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine (oder ungültige) Daten');
    });
});
