import { describe, it, expect, beforeEach } from 'vitest';
import { CbPolicyErrorIndicator } from '../../../src/analysis/indicators/CbPolicyErrorIndicator.js';

describe('CbPolicyErrorIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new CbPolicyErrorIndicator();
    });

    const generateTimeline = (length, overrides = {}) => {
        return Array(length).fill(0).map((_, i) => ({
            macroGroups: {
                FinancialConditions: {
                    FedFundsRate: overrides.dff !== undefined ? overrides.dff(i) : 5.0,
                    DXY: overrides.dxy !== undefined ? overrides.dxy(i) : 100.0
                },
                Leading: {
                    BreakevenInflation: overrides.t10 !== undefined ? overrides.t10(i) : 2.0
                }
            }
        }));
    };

    it('sollte UNKNOWN zurückgeben, wenn die Timeline < 60 Tage ist', () => {
        const timeline = generateTimeline(59);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('< 60 Tage');
    });

    it('sollte UNKNOWN zurückgeben, wenn irgendein benötigter Datenpunkt fehlt', () => {
        // past ist an Index timeline.length - 60 = 60 - 60 = 0
        // current ist an Index 59
        const baseTimeline = () => generateTimeline(60);

        let timeline = baseTimeline();
        timeline[0].macroGroups.FinancialConditions.FedFundsRate = null;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');

        timeline = baseTimeline();
        timeline[59].macroGroups.FinancialConditions.DXY = undefined;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');

        timeline = baseTimeline();
        timeline[0].macroGroups.Leading.BreakevenInflation = null;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');
    });

    it('sollte CRITICAL auslösen: DFF sinkt stark (< -0.25), Inflation steigt (> 0.10), DXY schwach', () => {
        const timeline = generateTimeline(60, {
            dff: (i) => i === 0 ? 5.0 : (i === 59 ? 4.6 : 5.0),    // -0.40
            t10: (i) => i === 0 ? 2.0 : (i === 59 ? 2.2 : 2.0),    // +0.20
            dxy: (i) => i === 0 ? 100 : (i === 59 ? 101 : 100)     // +1% (<= 2.0)
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('Fiat-Flucht detektiert');
    });

    it('sollte WARNING auslösen: DFF sinkt, Inflation steigt, ABER DXY ist zu stark (> 2.0%)', () => {
        const timeline = generateTimeline(60, {
            dff: (i) => i === 0 ? 5.0 : (i === 59 ? 4.6 : 5.0),    // -0.40
            t10: (i) => i === 0 ? 2.0 : (i === 59 ? 2.2 : 2.0),    // +0.20
            dxy: (i) => i === 0 ? 100 : (i === 59 ? 103 : 100)     // +3% (> 2.0)
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('starker US-Dollar blockiert Gold-Ausbruch');
    });

    it('sollte WARNING (Trust loss) auslösen, wenn die Schwellenwerte für CRITICAL knapp verfehlt werden', () => {
        const timeline = generateTimeline(60, {
            dff: (i) => i === 0 ? 5.0 : (i === 59 ? 4.85 : 5.0),   // -0.15 (< -0.10)
            t10: (i) => i === 0 ? 2.0 : (i === 59 ? 2.08 : 2.0),   // +0.08 (> 0.05)
            dxy: (i) => 100 // Spielt hier keine Rolle
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Vertrauensverlust droht');
    });

    it('sollte WARNING (Trust loss) auslösen bei exakten Threshold-Treffern für CRITICAL', () => {
        const timeline = generateTimeline(60, {
            dff: (i) => i === 0 ? 5.0 : (i === 59 ? 4.75 : 5.0),   // exakt -0.25 (DFF < -0.25 ist false!)
            t10: (i) => i === 0 ? 2.0 : (i === 59 ? 2.10 : 2.0),   // exakt +0.10 (T10 > 0.10 ist false!)
            dxy: (i) => 100
        });
        // Da -0.25 nicht < -0.25 ist, und 0.10 nicht > 0.10, springt es in den Else-If Block:
        // dffChange (-0.25) < -0.10 (TRUE)
        // t10yieChange (0.10) > 0.05 (TRUE)
        // Resultat: WARNING
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Vertrauensverlust droht');
    });

    it('sollte OK zurückgeben, wenn DFF steigt', () => {
        const timeline = generateTimeline(60, {
            dff: (i) => i === 0 ? 5.0 : (i === 59 ? 5.2 : 5.0),    // +0.20
            t10: (i) => i === 0 ? 2.0 : (i === 59 ? 2.15 : 2.0),   // +0.15
            dxy: (i) => 100
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte mathematische Division durch 0 bei DXY abfangen', () => {
        const timeline = generateTimeline(60, {
            dff: (i) => i === 0 ? 5.0 : (i === 59 ? 4.6 : 5.0),    // -0.40
            t10: (i) => i === 0 ? 2.0 : (i === 59 ? 2.2 : 2.0),    // +0.20
            dxy: (i) => i === 0 ? 0 : (i === 59 ? 10 : 0)          // DXY Return = Infinity
        });
        const result = indicator.evaluate(timeline);
        // Infinity > 2.0 ist true
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('starker US-Dollar blockiert');
    });
});
