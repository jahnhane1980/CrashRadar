import { describe, test, expect, beforeEach } from 'vitest';
import { InterestRateCycleIndicator } from '../../../src/analysis/indicators/InterestRateCycleIndicator.js';

describe('InterestRateCycleIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new InterestRateCycleIndicator();
    });

    const buildTimeline = (days) => {
        const tl = [];
        for (let i = 0; i < days; i++) {
            tl.push({
                date: `2024-01-01`, // Date string is not used in logic
                macroGroups: {
                    FinancialConditions: { 
                        RealYield10y: 1.0, 
                        FedFundsRate: 5.0 
                    },
                    Leading: { 
                        BreakevenInflation: 2.0 
                    },
                    Fundamentals: { 
                        ARCC_InterestExpense: 100 
                    }
                }
            });
        }
        return tl;
    };

    test('should return UNKNOWN if timeline has less than 180 days', () => {
        const tl = buildTimeline(179);
        const result = indicator.evaluate(tl);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toMatch(/Zu wenig Daten/);
    });

    test('should return OK if timeline is flat (no triggers)', () => {
        const tl = buildTimeline(200);
        const result = indicator.evaluate(tl);
        expect(result.status).toBe('OK');
    });

    test('should trigger EARLY_WARNING if only RateShock occurs', () => {
        const tl = buildTimeline(200);
        // Rate shock: +0.5% in 60 days
        tl[140].macroGroups.FinancialConditions.RealYield10y = 1.0;
        tl[200 - 1].macroGroups.FinancialConditions.RealYield10y = 1.5; // Trigger at i=199 compared to i=139 (Wait, 199-60 = 139)
        
        const result = indicator.evaluate(tl);
        expect(result.status).toBe('EARLY_WARNING');
        expect(result.message).toContain('RateShock');
    });

    test('should trigger WARNING if RateShock AND ARCC occurs', () => {
        const tl = buildTimeline(200);
        // Rate shock at i=199 (compared to 139)
        tl[139].macroGroups.FinancialConditions.RealYield10y = 1.0;
        tl[199].macroGroups.FinancialConditions.RealYield10y = 1.5;
        
        // ARCC shock at i=180 (compared to 90) => +15%
        tl[90].macroGroups.Fundamentals.ARCC_InterestExpense = 100;
        tl[180].macroGroups.Fundamentals.ARCC_InterestExpense = 116;

        const result = indicator.evaluate(tl);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('RateShock');
        expect(result.message).toContain('ARCC');
    });

    test('should trigger CRITICAL if all 3 phases occur within 180 days', () => {
        const tl = buildTimeline(250);
        
        // 1. RateShock triggers at i=100 (compared to 40)
        tl[40].macroGroups.FinancialConditions.RealYield10y = 1.0;
        tl[100].macroGroups.FinancialConditions.RealYield10y = 1.6;
        
        // 2. PolicyError triggers at i=150 (compared to 90)
        // DFF drops < -0.25, T10YIE rises > +0.10
        tl[90].macroGroups.FinancialConditions.FedFundsRate = 5.0;
        tl[90].macroGroups.Leading.BreakevenInflation = 2.0;
        tl[150].macroGroups.FinancialConditions.FedFundsRate = 4.7; // -0.3
        tl[150].macroGroups.Leading.BreakevenInflation = 2.2; // +0.2
        
        // 3. ARCC shock at i=249 (compared to 159)
        tl[159].macroGroups.Fundamentals.ARCC_InterestExpense = 100;
        tl[249].macroGroups.Fundamentals.ARCC_InterestExpense = 115;

        // Current evaluation is at i=249. Memory is 180 days (looks back to i=69).
        // RateShock at i=100 is within [69, 249].
        // PolicyError at i=150 is within [69, 249].
        // ARCC at i=249 is within [69, 249].
        const result = indicator.evaluate(tl);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('CODE RED');
    });

    test('EDGE CASE: Memory Drop-Off - Trigger older than 180 days is forgotten', () => {
        const tl = buildTimeline(300);
        
        // RateShock triggers at i=100
        tl[40].macroGroups.FinancialConditions.RealYield10y = 1.0;
        tl[100].macroGroups.FinancialConditions.RealYield10y = 1.6;
        
        // We evaluate at i=299. Memory goes back to 299 - 180 = 119.
        // The trigger at i=100 should not be seen!
        const result = indicator.evaluate(tl);
        expect(result.status).toBe('OK');
    });

    test('EDGE CASE: Missing Data (Null/Undefined) does not crash and ignores trigger', () => {
        const tl = buildTimeline(200);
        
        // Corrupt data at i=199
        tl[199].macroGroups.FinancialConditions = undefined;
        tl[199].macroGroups.Fundamentals = null;

        expect(() => {
            const result = indicator.evaluate(tl);
            expect(result.status).toBe('OK');
        }).not.toThrow();
    });

    test('EDGE CASE: Negative values or zero in ARCC base does not crash (Divide by zero)', () => {
        const tl = buildTimeline(200);
        
        // ARCC previous is 0
        tl[100].macroGroups.Fundamentals.ARCC_InterestExpense = 0;
        tl[190].macroGroups.Fundamentals.ARCC_InterestExpense = 50; // Infinity % gain

        // The logic requires pExp > 0, so this should gracefully be ignored, no crash
        const result = indicator.evaluate(tl);
        expect(result.status).toBe('OK');
    });

    test('EDGE CASE: Policy Error requires BOTH conditions', () => {
        const tl = buildTimeline(200);
        
        // Only DFF drops, but inflation stays flat (Good scenario, not policy error)
        tl[139].macroGroups.FinancialConditions.FedFundsRate = 5.0;
        tl[139].macroGroups.Leading.BreakevenInflation = 2.0;
        tl[199].macroGroups.FinancialConditions.FedFundsRate = 4.0; // -1.0
        tl[199].macroGroups.Leading.BreakevenInflation = 2.0; // 0.0 change

        const result1 = indicator.evaluate(tl);
        expect(result1.status).toBe('OK');

        // Only Inflation rises, but DFF rises too (Normal hiking cycle)
        tl[199].macroGroups.FinancialConditions.FedFundsRate = 5.5; // +0.5
        tl[199].macroGroups.Leading.BreakevenInflation = 2.5; // +0.5

        const result2 = indicator.evaluate(tl);
        expect(result2.status).toBe('OK');
    });
});
