import { describe, it, expect, beforeEach } from 'vitest';
import { BitcoinDivergenceIndicator } from '../../../src/analysis/indicators/BitcoinDivergenceIndicator.js';

describe('BitcoinDivergenceIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new BitcoinDivergenceIndicator();
    });

    // Generiert eine realistische Timeline, um MathUtils.getDrawdownFromMax herauszufordern
    const generateTimeline = (length, spyGenerator, btcGenerator) => {
        return Array(length).fill(0).map((_, i) => {
            return {
                assets: {
                    SPY: spyGenerator ? spyGenerator(i) : 500,
                    BTC: btcGenerator ? btcGenerator(i) : 60000
                }
            };
        });
    };

    it('sollte UNKNOWN zurückgeben, wenn die Timeline < 30 Tage ist', () => {
        const timeline = generateTimeline(29, () => 500, () => 60000);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('< 30 Tage');
    });

    it('sollte UNKNOWN zurückgeben, wenn aktuelle Daten fehlen (SPY null)', () => {
        const timeline = generateTimeline(40, () => 500, () => 60000);
        timeline[39].assets.SPY = null;
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Daten');
    });

    it('sollte UNKNOWN zurückgeben, wenn aktuelle Daten fehlen (BTC null)', () => {
        const timeline = generateTimeline(40, () => 500, () => 60000);
        timeline[39].assets.BTC = null;
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('sollte WARNING auslösen: SPY nahe ATH (Drawdown >= -2%), BTC crasht (Drawdown <= -10%)', () => {
        // Timeline von 50 Tagen.
        // SPY: Bleibt stabil bei 500 (Max 500, Current 495 -> -1%)
        // BTC: Max bei Tag 20 ist 70000, Current ist 60000 -> -14.2%
        const timeline = generateTimeline(50, 
            (i) => i === 49 ? 495 : 500, // SPY Max=500, Current=495
            (i) => i === 20 ? 70000 : (i === 49 ? 60000 : 65000) // BTC Max=70000, Current=60000
        );

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Liquiditäts-Staubsauger aktiv');
        expect(result.value).toContain('SPY -1.0%');
        expect(result.value).toContain('BTC -14.3%');
    });

    it('sollte OK zurückgeben: SPY crasht ebenfalls (Drawdown < -2%)', () => {
        // SPY fällt von 500 auf 400 (-20%)
        // BTC fällt auf 60000 (-14.2%)
        const timeline = generateTimeline(50, 
            (i) => i === 49 ? 400 : 500, 
            (i) => i === 20 ? 70000 : (i === 49 ? 60000 : 65000)
        );

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte OK zurückgeben: BTC bleibt stabil (Drawdown > -10%)', () => {
        // SPY stabil bei 500
        // BTC fällt nur von 70000 auf 68000 (-2.8%)
        const timeline = generateTimeline(50, 
            (i) => 500, 
            (i) => i === 20 ? 70000 : (i === 49 ? 68000 : 65000)
        );

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });
});
