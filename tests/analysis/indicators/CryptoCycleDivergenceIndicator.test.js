import { describe, it, expect, beforeEach } from 'vitest';
import { CryptoCycleDivergenceIndicator } from '../../../src/analysis/indicators/CryptoCycleDivergenceIndicator.js';

describe('CryptoCycleDivergenceIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new CryptoCycleDivergenceIndicator();
    });

    const generateTimeline = (length, overrides = {}) => {
        return Array(length).fill(0).map((_, i) => ({
            assets: {
                BTC: overrides.btc !== undefined ? overrides.btc(i) : 60000,
                MSTR: overrides.mstr !== undefined ? overrides.mstr(i) : 1000,
                COIN: overrides.coin !== undefined ? overrides.coin(i) : 200
            }
        }));
    };

    it('sollte UNKNOWN zurückgeben, wenn die Timeline < 30 Tage ist', () => {
        const timeline = generateTimeline(29);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('< 30 Tage');
    });

    it('sollte UNKNOWN zurückgeben, wenn BTC fehlt', () => {
        const timeline = generateTimeline(40);
        timeline[39].assets.BTC = null;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN zurückgeben, wenn sowohl MSTR als auch COIN fehlen', () => {
        const timeline = generateTimeline(40);
        timeline[39].assets.MSTR = null;
        timeline[39].assets.COIN = undefined;
        expect(indicator.evaluate(timeline).status).toBe('UNKNOWN');
        expect(indicator.evaluate(timeline).message).toContain('Keine Proxy-Daten');
    });

    it('sollte WARNING auslösen: BTC stabil, MSTR und COIN crashen', () => {
        // BTC: ATH = 60000, Current = 59400 -> -1.0% (>= -2.0)
        // MSTR: ATH = 1000, Current = 800 -> -20.0% (<= -15.0)
        // COIN: ATH = 200, Current = 150 -> -25.0%
        const timeline = generateTimeline(40, {
            btc: (i) => i === 39 ? 59400 : 60000,
            mstr: (i) => i === 39 ? 800 : 1000,
            coin: (i) => i === 39 ? 150 : 200
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        // Proxy ist der schlechtere von beiden, also Math.min(-20, -25) = -25.0
        expect(result.value).toContain('BTC -1.0%');
        expect(result.value).toContain('Proxy -25.0%');
    });

    it('sollte WARNING auslösen bei exaktem Threshold-Treffer (Gleichstand)', () => {
        // BTC: ATH = 60000, Current = 58800 -> exakt -2.0%
        // MSTR: ATH = 1000, Current = 850 -> exakt -15.0%
        // COIN: ATH = 200, Current = 200 -> 0%
        // proxyDrawdown = Math.min(-15.0, 0) = -15.0
        const timeline = generateTimeline(40, {
            btc: (i) => i === 39 ? 58800 : 60000,
            mstr: (i) => i === 39 ? 850 : 1000,
            coin: (i) => 200
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toContain('BTC -2.0%');
        expect(result.value).toContain('Proxy -15.0%');
    });

    it('sollte OK zurückgeben, wenn BTC knapp unter den Threshold rutscht (-2.1%)', () => {
        // MSTR ist auf -20% (crashing)
        // BTC ist auf -2.1% (knapp verfehlt)
        const timeline = generateTimeline(40, {
            btc: (i) => i === 39 ? 58740 : 60000, // -2.1%
            mstr: (i) => i === 39 ? 800 : 1000
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte OK zurückgeben, wenn Proxy knapp über dem Threshold bleibt (-14.9%)', () => {
        // BTC stabil bei 0%
        // MSTR: ATH = 1000, Current = 851 -> -14.9%
        const timeline = generateTimeline(40, {
            btc: (i) => 60000,
            mstr: (i) => i === 39 ? 851 : 1000,
            coin: (i) => 200
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte den Fallback (|| 0) für Drawdowns nutzen, wenn ein Proxy komplett fehlt', () => {
        // COIN ist dauerhaft null. getDrawdownFromMax gibt null zurück, 
        // was durch `|| 0` aufgefangen wird. 
        // MSTR crasht auf -20%.
        // Math.min(-20, 0) = -20 -> WARNING.
        const timeline = generateTimeline(40, {
            btc: (i) => 60000,
            mstr: (i) => i === 39 ? 800 : 1000,
            coin: (i) => null
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toContain('Proxy -20.0%');
    });

    it('sollte den Fallback (|| 0) auch für MSTR nutzen, wenn MSTR komplett fehlt', () => {
        // MSTR ist dauerhaft null.
        // COIN crasht auf -30%.
        // Math.min(0, -30) = -30 -> WARNING.
        const timeline = generateTimeline(40, {
            btc: (i) => 60000,
            mstr: (i) => null,
            coin: (i) => i === 39 ? 140 : 200
        });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toContain('Proxy -30.0%');
    });

    it('sollte komplexe Volatilität (versteckte Allzeithochs in der Timeline) fehlerfrei verarbeiten', () => {
        const timeline = generateTimeline(40, {
            btc: (i) => {
                if (i === 25) return 70000; // Verstecktes ATH in der Mitte des Arrays
                if (i === 39) return 69300; // Heute: Exakt -1.0% Drawdown vom ATH (69300 / 70000)
                return 50000;               // Bedeutungsloses Rauschen
            },
            mstr: (i) => {
                if (i === 20) return 1000;  // ATH
                if (i === 39) return 800;   // Heute: -20.0% Drawdown
                return 500;
            },
            coin: (i) => {
                if (i === 30) return 200;   // ATH
                if (i === 39) return 140;   // Heute: -30.0% Drawdown
                return 100;
            }
        });
        
        // Die Logik muss die Arrays durchsuchen, die unterschiedlichen ATH-Indizes finden 
        // und den korrekten Drawdown berechnen. 
        // BTC ist stark (-1.0% >= -2.0%), Proxies schwach (-30.0% <= -15.0%).
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toContain('BTC -1.0%');
        expect(result.value).toContain('Proxy -30.0%');
    });
});
