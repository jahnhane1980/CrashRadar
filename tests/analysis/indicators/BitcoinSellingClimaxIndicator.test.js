import { describe, it, expect, beforeEach } from 'vitest';
import { BitcoinSellingClimaxIndicator } from '../../../src/analysis/indicators/BitcoinSellingClimaxIndicator.js';

describe('BitcoinSellingClimaxIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new BitcoinSellingClimaxIndicator();
    });

    const generateTimeline = (length, overrides = {}) => {
        return Array(length).fill(0).map((_, i) => ({
            assets: {
                BTC: overrides.btc ? overrides.btc(i) : 60000,
                BTC_Volume: overrides.vol ? overrides.vol(i) : 1000
            }
        }));
    };

    it('sollte UNKNOWN zurückgeben, wenn die Timeline < 30 Tage ist', () => {
        const timeline = generateTimeline(29);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('sollte UNKNOWN zurückgeben, wenn aktuelle Preis- oder Volumendaten fehlen', () => {
        let timeline = generateTimeline(35);
        timeline[34].assets.BTC = null;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');

        timeline = generateTimeline(35);
        timeline[33].assets.BTC = null; // prevDay
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');

        timeline = generateTimeline(35);
        timeline[34].assets.BTC_Volume = null;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN zurückgeben, wenn keine gültigen Volumendaten (count === 0) in den letzten 30 Tagen vorliegen', () => {
        // Ein negativer Volumenwert umgeht die !currentBtcVol Prüfung (da -1 truthy ist), 
        // wird aber im Loop bei (v > 0) verworfen -> count bleibt 0.
        const timelineDeadCode = generateTimeline(35, {
            vol: () => -1 
        });
        const result = indicator.evaluate(timelineDeadCode);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine gültigen Volumendaten');
    });

    it('sollte CRITICAL auslösen (Selling Climax): Volumen >= 4x, Preis <= -5%', () => {
        const timeline = generateTimeline(35, {
            btc: (i) => i === 34 ? 55000 : 60000,
            vol: (i) => i === 34 ? 5000 : 1000 
        });

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('SELLING CLIMAX');
    });

    it('sollte OK zurückgeben: Volumen-Spike, aber kein massiver Preissturz', () => {
        const timeline = generateTimeline(35, {
            btc: (i) => i === 34 ? 59000 : 60000, // nur -1.6%
            vol: (i) => i === 34 ? 5000 : 1000
        });

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte OK zurückgeben: Preis crasht, aber ohne Volumen (Kein Kapitulations-Volumen)', () => {
        const timeline = generateTimeline(35, {
            btc: (i) => i === 34 ? 50000 : 60000, // -16.6%
            vol: (i) => 1000 
        });

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });
});
