import { describe, it, expect, beforeEach } from 'vitest';
import { MarginDebtIndicator } from '../../../src/analysis/indicators/MarginDebtIndicator.js';

describe('MarginDebtIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new MarginDebtIndicator();
    });

    const createTimeline = (length, baseDebt = 800000) => {
        const timeline = [];
        for (let i = 0; i < length; i++) {
            // Rauschen generieren (z.B. +/- 5000)
            const noise = (Math.random() - 0.5) * 10000;
            timeline.push({
                date: `2020-01-${(i + 1).toString().padStart(2, '0')}`,
                macroGroups: {
                    Leading: {
                        MarginDebt: baseDebt + noise
                    }
                }
            });
        }
        return timeline;
    };

    it('returns UNKNOWN if timeline is less than 180 days', () => {
        const timeline = createTimeline(179);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('returns UNKNOWN if MarginDebt data is missing completely on current day', () => {
        const timeline = createTimeline(180);
        
        // Simuliere fehlendes MarginDebt
        delete timeline[179].macroGroups.Leading.MarginDebt;
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Daten');
    });

    it('gracefully handles missing macroGroups object on current day without throwing TypeError', () => {
        const timeline = createTimeline(180);
        
        // Simuliere eine kaputte API-Antwort, bei der macroGroups komplett fehlt
        delete timeline[179].macroGroups;
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Daten');
    });

    it('returns WARNING (Severe) if drawdown is -5.0% or worse', () => {
        const timeline = createTimeline(180, 800000); // base = 800000
        
        // Max Debt an Tag 100
        timeline[100].macroGroups.Leading.MarginDebt = 900000;
        
        // Current Debt an Tag 179 (Drawdown = -5.0% von 900000 -> 855000)
        // Wir setzen auf 850000 (ca. -5.55%)
        timeline[179].macroGroups.Leading.MarginDebt = 850000;

        // Sicherstellen, dass keine anderen Werte das Max überschreiben
        for(let i=0; i<180; i++) {
            if(i !== 100 && i !== 179) timeline[i].macroGroups.Leading.MarginDebt = 800000;
        }

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('rasant Hebel ab');
        expect(result.value).toContain('%');
        // 850000 / 900000 = 0.9444 -> -5.55%
        expect(result.value).toBe('-5.6%');
    });

    it('returns WARNING (Moderate) if drawdown is between -2.0% and -5.0%', () => {
        const timeline = createTimeline(180, 800000);
        
        timeline[100].macroGroups.Leading.MarginDebt = 900000;
        // -3.0% Drawdown -> 900000 * 0.97 = 873000
        timeline[179].macroGroups.Leading.MarginDebt = 873000;

        for(let i=0; i<180; i++) {
            if(i !== 100 && i !== 179) timeline[i].macroGroups.Leading.MarginDebt = 800000;
        }

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Kreditlinien');
        expect(result.value).toBe('-3.0%');
    });

    it('returns OK if drawdown is less severe than -2.0% (e.g. -1.0%)', () => {
        const timeline = createTimeline(180, 800000);
        
        timeline[100].macroGroups.Leading.MarginDebt = 900000;
        // -1.0% Drawdown -> 900000 * 0.99 = 891000
        timeline[179].macroGroups.Leading.MarginDebt = 891000;

        for(let i=0; i<180; i++) {
            if(i !== 100 && i !== 179) timeline[i].macroGroups.Leading.MarginDebt = 800000;
        }

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).toContain('Hebel (Margin Debt) steigt');
        expect(result.value).toBe('891000M');
    });

    it('returns OK if currently at All-Time High (Drawdown 0%)', () => {
        const timeline = createTimeline(180, 800000);
        
        // Current IS the max
        timeline[179].macroGroups.Leading.MarginDebt = 1000000;

        for(let i=0; i<180; i++) {
            if(i !== 179) timeline[i].macroGroups.Leading.MarginDebt = 800000;
        }

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('1000000M');
    });

    it('handles dead code path mathematically (drawdownPct === null branch check)', () => {
        const timeline = createTimeline(180, 0);
        // Wir übergeben komplett leere Arrays, aber current ist valide
        // Damit MathUtils.getDrawdownFromMax null liefert, müsste timeline.length < 180 sein (wird oben gefangen)
        // oder current null/undefined sein (wird oben gefangen).
        // Wenn max 0 ist, gibt MathUtils 0 zurück, nicht null!
        // Der Branch if (drawdownPct === null) ist somit extrem schwer/gar nicht erreichbar.
        // Wir testen den Fall: max = 0
        for(let i=0; i<180; i++) timeline[i].macroGroups.Leading.MarginDebt = 0;
        
        const result = indicator.evaluate(timeline);
        // Da MathUtils bei max=0 -> 0 zurückgibt, ist der Drawdown 0%.
        // Das bedeutet 0 <= -5 ist false, 0 <= -2 ist false -> OK.
        expect(result.status).toBe('OK');
        expect(result.value).toBe('0M');
    });
});
