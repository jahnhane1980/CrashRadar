import { describe, it, expect, beforeEach } from 'vitest';
import { DalioTwoStageRegimeIndicator } from '../../../src/analysis/indicators/DalioTwoStageRegimeIndicator.js';

describe('DalioTwoStageRegimeIndicator - HARDCORE & CHAOS TESTS', () => {
    let indicator;

    beforeEach(() => {
        indicator = new DalioTwoStageRegimeIndicator();
    });

    const buildTimeline = (overrides = {}) => {
        const defaultMacro = {
            FinancialConditions: { FedFundsRate: 2.0, RealYield10y: 2.5, Yield30y: 3.5, HighYieldSpread: 2.5 },
            YieldCurve: { Spread10y2y: 0.5, Spread10y3m: 0.5 },
            Liquidity: { ReverseRepo: 500 },
            Fundamentals: { GovInterestExpenses: 400, GovTaxReceipts: 2000 }
        };

        const mergedMacro = {
            FinancialConditions: { ...defaultMacro.FinancialConditions, ...overrides.FinancialConditions },
            YieldCurve: { ...defaultMacro.YieldCurve, ...overrides.YieldCurve },
            Liquidity: { ...defaultMacro.Liquidity, ...overrides.Liquidity },
            Fundamentals: { ...defaultMacro.Fundamentals, ...overrides.Fundamentals }
        };

        return [
            { macroGroups: defaultMacro },
            { macroGroups: defaultMacro },
            { macroGroups: defaultMacro },
            { macroGroups: defaultMacro },
            { macroGroups: mergedMacro }
        ];
    };

    // -----------------------------------------------------------------------
    // 1. HAPPY PATH INTEGRATION TESTS
    // -----------------------------------------------------------------------
    it('INTEGRATION: Normal State (0/4 Red) -> OK', () => {
        const timeline = buildTimeline();
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).toContain('Stabile Makro-Phase');
    });

    it('INTEGRATION: Stage 1 Watchlist Active (3/4 Red) -> WARNING', () => {
        const timeline = buildTimeline({
            FinancialConditions: { FedFundsRate: 5.25 },
            YieldCurve: { Spread10y3m: -0.5 },
            Fundamentals: { GovInterestExpenses: 1100, GovTaxReceipts: 3000 },
            Liquidity: { ReverseRepo: 200 }
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toContain('WATCHLIST');
        expect(result.message).toContain('Spätzyklus-Watchlist aktiv');
    });

    it('INTEGRATION: Stage 2 Tipping Point (3/4 Red + RRP < 20B) -> CRITICAL', () => {
        const timeline = buildTimeline({
            FinancialConditions: { FedFundsRate: 5.25 },
            YieldCurve: { Spread10y3m: -0.5 },
            Fundamentals: { GovInterestExpenses: 1100, GovTaxReceipts: 3000 },
            Liquidity: { ReverseRepo: 5 }
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toContain('KIPPPUNKT');
        expect(result.message).toContain('ALARM ROT: Dalio-Kipppunkt erreicht!');
    });

    it('INTEGRATION: Stage 2 Tipping Point via Credit Spread (3/4 Red + HYG > 4.0%) -> CRITICAL', () => {
        const timeline = buildTimeline({
            FinancialConditions: { FedFundsRate: 5.25, HighYieldSpread: 4.5 },
            YieldCurve: { Spread10y3m: -0.5 },
            Fundamentals: { GovInterestExpenses: 1100, GovTaxReceipts: 3000 },
            Liquidity: { ReverseRepo: 500 }
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toContain('KIPPPUNKT');
    });

    // -----------------------------------------------------------------------
    // 2. BOUNDARY TESTS (Scharfe Grenzwert-Tests)
    // -----------------------------------------------------------------------
    it('BOUNDARY: Exakt FedFunds 4.50 (Nicht ausgelöst) vs 4.51 (Ausgelöst)', () => {
        const resBelow = indicator.evaluate(buildTimeline({ FinancialConditions: { FedFundsRate: 4.50 } }));
        expect(resBelow.details.stage1Triggers).not.toContain('RateStress');

        const resAbove = indicator.evaluate(buildTimeline({ FinancialConditions: { FedFundsRate: 4.51 } }));
        expect(resAbove.details.stage1Triggers).toContain('RateStress');
    });

    it('BOUNDARY: Exakt YieldSpread 0.00 (Nicht invertiert) vs -0.01 (Invertiert)', () => {
        const resZero = indicator.evaluate(buildTimeline({ YieldCurve: { Spread10y3m: 0.00, Spread10y2y: 0.00 } }));
        expect(resZero.details.stage1Triggers).not.toContain('YieldInversion');

        const resNeg = indicator.evaluate(buildTimeline({ YieldCurve: { Spread10y3m: -0.01, Spread10y2y: -0.01 } }));
        expect(resNeg.details.stage1Triggers).toContain('YieldInversion');
    });

    it('BOUNDARY: Exakt ReverseRepo 20.00 (Puffer aktiv) vs 19.99 (Puffer erschöpft)', () => {
        // 3/4 Red base
        const baseOverrides = {
            FinancialConditions: { FedFundsRate: 5.25 },
            YieldCurve: { Spread10y3m: -0.5 },
            Fundamentals: { GovInterestExpenses: 1100, GovTaxReceipts: 3000 }
        };

        const res20 = indicator.evaluate(buildTimeline({ ...baseOverrides, Liquidity: { ReverseRepo: 20.00 } }));
        expect(res20.status).toBe('WARNING'); // Still Watchlist, not critical

        const res19 = indicator.evaluate(buildTimeline({ ...baseOverrides, Liquidity: { ReverseRepo: 19.99 } }));
        expect(res19.status).toBe('CRITICAL'); // Tipping Point Triggered!
    });

    it('BOUNDARY: Exakt HighYieldSpread 4.00 (Strafgrenze) vs 4.01 (Ausbruch)', () => {
        const baseOverrides = {
            FinancialConditions: { FedFundsRate: 5.25, HighYieldSpread: 4.00 },
            YieldCurve: { Spread10y3m: -0.5 },
            Fundamentals: { GovInterestExpenses: 1100, GovTaxReceipts: 3000 },
            Liquidity: { ReverseRepo: 500 }
        };

        const res40 = indicator.evaluate(buildTimeline(baseOverrides));
        expect(res40.status).toBe('WARNING');

        baseOverrides.FinancialConditions.HighYieldSpread = 4.01;
        const res401 = indicator.evaluate(buildTimeline(baseOverrides));
        expect(res401.status).toBe('CRITICAL');
    });

    it('BOUNDARY: Exakt Zinsquote 30.0% vs 30.01%', () => {
        const res30 = indicator.evaluate(buildTimeline({
            Fundamentals: { GovInterestExpenses: 300, GovTaxReceipts: 1000 } // 30.0%
        }));
        expect(res30.details.stage1Triggers).not.toContain('GovDebtBurden');

        const res301 = indicator.evaluate(buildTimeline({
            Fundamentals: { GovInterestExpenses: 301, GovTaxReceipts: 1000 } // 30.1%
        }));
        expect(res301.details.stage1Triggers).toContain('GovDebtBurden');
    });

    // -----------------------------------------------------------------------
    // 3. SINGULARITY & DIVISION-BY-ZERO TESTS
    // -----------------------------------------------------------------------
    it('SINGULARITY: GovTaxReceipts = 0 (Keine Division by Zero) -> Handles gracefully', () => {
        const timeline = buildTimeline({
            Fundamentals: { GovInterestExpenses: 500, GovTaxReceipts: 0 }
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).not.toBe('UNKNOWN');
        expect(result.details.govInterestRatio).toBe(0);
    });

    it('SINGULARITY: Negative GovInterestExpenses or TaxReceipts -> Handles gracefully', () => {
        const timeline = buildTimeline({
            Fundamentals: { GovInterestExpenses: -100, GovTaxReceipts: -500 }
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    // -----------------------------------------------------------------------
    // 4. DATA TYPE COERCION & MISSING PROPERTY TESTS (Struktur-Chaos)
    // -----------------------------------------------------------------------
    it('COERCION: Numbers as Strings ("5.25", "19.5") -> Parsed correctly', () => {
        const timeline = buildTimeline({
            FinancialConditions: { FedFundsRate: "5.25" },
            YieldCurve: { Spread10y3m: "-0.5" },
            Fundamentals: { GovInterestExpenses: "1100", GovTaxReceipts: "3000" },
            Liquidity: { ReverseRepo: "19.5" }
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
    });

    it('COERCION: Invalid Strings ("KAPUTT", "NaN", "") -> Falls back to safe default', () => {
        const timeline = buildTimeline({
            FinancialConditions: { FedFundsRate: "KAPUTT" },
            YieldCurve: { Spread10y3m: "   " },
            Liquidity: { ReverseRepo: "NaN" }
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('CHAOS: Missing macroGroups or empty object -> Handles without crash', () => {
        const timeline = [{}, {}, {}, {}, { macroGroups: null }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('CHAOS: Timeline elements are null / undefined / corrupted objects', () => {
        const timeline = [null, undefined, { macroGroups: "MÜLL" }, {}, { macroGroups: {} }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('CHAOS: Timeline length < 5 -> UNKNOWN', () => {
        expect(indicator.evaluate(null).status).toBe('UNKNOWN');
        expect(indicator.evaluate([]).status).toBe('UNKNOWN');
        expect(indicator.evaluate([{}, {}, {}, {}]).status).toBe('UNKNOWN');
    });

    // -----------------------------------------------------------------------
    // 5. NOISE ARRAY TESTING (Zufallsrauschen)
    // -----------------------------------------------------------------------
    it('CHAOS ARRAY: Timeline with random noise & structural gaps -> Evaluates last valid state', () => {
        const noisyTimeline = [];
        for (let i = 0; i < 50; i++) {
            if (i % 3 === 0) noisyTimeline.push(null);
            else if (i % 5 === 0) noisyTimeline.push({ macroGroups: { Garbage: Math.random() } });
            else noisyTimeline.push({ macroGroups: { FinancialConditions: { FedFundsRate: Math.random() * 2 } } });
        }
        
        // Add final critical day
        noisyTimeline.push({
            macroGroups: {
                FinancialConditions: { FedFundsRate: 5.5, HighYieldSpread: 2.5 },
                YieldCurve: { Spread10y3m: -0.8 },
                Fundamentals: { GovInterestExpenses: 1200, GovTaxReceipts: 3000 },
                Liquidity: { ReverseRepo: 10 }
            }
        });

        const result = indicator.evaluate(noisyTimeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toContain('KIPPPUNKT');
    });
});
