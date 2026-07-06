import { describe, it, expect, beforeEach } from 'vitest';
import { BankReservesIndicator } from '../../../src/analysis/indicators/BankReservesIndicator.js';

describe('BankReservesIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new BankReservesIndicator();
    });

    const generateTimeline = (reservesValue) => {
        return [
            {
                macroGroups: {
                    BankingHealth: {
                        TotalReserves: reservesValue
                    }
                }
            }
        ];
    };

    it('sollte UNKNOWN zurückgeben, wenn die Timeline leer ist', () => {
        const result = indicator.evaluate([]);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('sollte CRITICAL zurückgeben, wenn die Reserven < 2800 sind', () => {
        const timeline = generateTimeline(2700);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('2700B');
    });

    it('sollte WARNING zurückgeben, wenn die Reserven < 3000 sind', () => {
        const timeline = generateTimeline(2900);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('2900B');
    });

    it('sollte OK zurückgeben, wenn die Reserven >= 3000 sind', () => {
        const timeline = generateTimeline(3500);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('3500B');
    });

    it('sollte UNKNOWN zurückgeben, wenn die Reserven-Daten null sind', () => {
        const timeline = generateTimeline(null);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Daten');
    });
});
