import { describe, it, expect } from 'vitest';
import { TradeSetupEngine } from '../../src/analysis/TradeSetupEngine.js';

describe('TradeSetupEngine Tranchen-Skalierung', () => {
    const engine = new TradeSetupEngine();

    it('sollte targetAsset korrekt ableiten', () => {
        expect(engine._determineTargetAsset({ name: 'Gold Kapitulations Indikator' })).toBe('GOLD');
        expect(engine._determineTargetAsset({ name: 'GDX Selling Climax' })).toBe('GOLD');
        expect(engine._determineTargetAsset({ name: 'Bitcoin Divergenz' })).toBe('BTC');
        expect(engine._determineTargetAsset({ name: 'Tech-Zyklus Radar' })).toBe('QQQ');
        expect(engine._determineTargetAsset({ targetAsset: 'CUSTOM_ASSET', name: 'Random' })).toBe('CUSTOM_ASSET');
    });

    it('sollte Tranche 1 (33%) bei 1 aktiven Gold-Boden-Signal zuweisen', () => {
        // Ein einzelner Indikator schlägt an
        const mockIndicator = {
            name: 'Gold Kapitulations Indikator',
            category: 'BOTTOM_FINDER',
            evaluate: () => ({ status: 'CRITICAL', message: 'Healing' })
        };

        const customEngine = new TradeSetupEngine();
        customEngine.indicators = [mockIndicator];

        const groupedData = {
            '2026-01-01': { assets: { Gold: 2000 } }
        };

        const actions = customEngine.evaluate(groupedData, {});
        const dayActions = actions['2026-01-01'];

        expect(dayActions).toHaveLength(1);
        expect(dayActions[0].targetAsset).toBe('GOLD');
        expect(dayActions[0].confluenceScore).toBe(1);
        expect(dayActions[0].trancheLevel).toBe(1);
        expect(dayActions[0].targetAllocationPct).toBe(33);
    });

    it('sollte Tranche 2 (66%) bei 2 aktiven Gold-Boden-Signalen zuweisen', () => {
        const mock1 = {
            name: 'Gold Kapitulations Indikator',
            category: 'BOTTOM_FINDER',
            evaluate: () => ({ status: 'CRITICAL', message: 'Healing' })
        };
        const mock2 = {
            name: 'GDX vs Gold Divergenz',
            category: 'BOTTOM_FINDER',
            evaluate: () => ({ status: 'CRITICAL', message: 'Bullish divergence' })
        };

        const customEngine = new TradeSetupEngine();
        customEngine.indicators = [mock1, mock2];

        const groupedData = {
            '2026-01-01': { assets: { Gold: 2000, GDX: 30 } }
        };

        const actions = customEngine.evaluate(groupedData, {});
        const dayActions = actions['2026-01-01'];

        expect(dayActions).toHaveLength(2);
        expect(dayActions[0].confluenceScore).toBe(2);
        expect(dayActions[0].trancheLevel).toBe(2);
        expect(dayActions[0].targetAllocationPct).toBe(66);
        expect(dayActions[1].trancheLevel).toBe(2);
        expect(dayActions[1].targetAllocationPct).toBe(66);
    });

    it('sollte Tranche 3 (100% Full Buy) bei 3 oder mehr aktiven Gold-Boden-Signalen zuweisen', () => {
        const mock1 = {
            name: 'Gold Kapitulations Indikator',
            category: 'BOTTOM_FINDER',
            evaluate: () => ({ status: 'CRITICAL', message: 'Healing' })
        };
        const mock2 = {
            name: 'GDX vs Gold Divergenz',
            category: 'BOTTOM_FINDER',
            evaluate: () => ({ status: 'CRITICAL', message: 'Bullish divergence' })
        };
        const mock3 = {
            name: 'DXY Parabolic Climax (Dollar-Erschöpfung)',
            category: 'BOTTOM_FINDER',
            targetAsset: 'GOLD',
            evaluate: () => ({ status: 'CRITICAL', message: 'Macro turning point' })
        };

        const customEngine = new TradeSetupEngine();
        customEngine.indicators = [mock1, mock2, mock3];

        const groupedData = {
            '2026-01-01': { assets: { Gold: 2000, GDX: 30, DXY: 105 } }
        };

        const actions = customEngine.evaluate(groupedData, {});
        const dayActions = actions['2026-01-01'];

        expect(dayActions).toHaveLength(3);
        expect(dayActions[0].confluenceScore).toBe(3);
        expect(dayActions[0].trancheLevel).toBe(3);
        expect(dayActions[0].targetAllocationPct).toBe(100);
    });

    it('sollte nur aktive Trade-Indikatoren instanziieren und nach reportOrder sortieren', () => {
        const config = [
            {
                id: 'gold_capitulation',
                name: '[INVEST] Gold Capitulation & Healing (2-Step)',
                className: 'GoldCapitulationIndicator',
                reportOrder: 1,
                enabled: true
            },
            {
                id: 'btc_trailing_stop',
                name: 'BTC Trailing Stop Warnung (Makro-Radar)',
                className: 'BtcTrailingStopIndicator',
                reportOrder: 2,
                enabled: false
            }
        ];

        const customEngine = new TradeSetupEngine(undefined, config);
        expect(customEngine.indicators.length).toBe(1);
        expect(customEngine.indicators[0].name).toBe('[INVEST] Gold Capitulation & Healing (2-Step)');
    });
});
