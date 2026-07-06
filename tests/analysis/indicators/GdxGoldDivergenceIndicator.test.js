import { describe, it, expect, beforeEach } from 'vitest';
import { GdxGoldDivergenceIndicator } from '../../../src/analysis/indicators/GdxGoldDivergenceIndicator.js';

describe('GdxGoldDivergenceIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new GdxGoldDivergenceIndicator();
    });

    const createTimeline = (length) => {
        const timeline = [];
        for (let i = 0; i < length; i++) {
            // Rauschen hinzufügen, um "glatte" Daten zu vermeiden
            const noise = (Math.random() - 0.5) * 5;
            timeline.push({
                date: `2020-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: {
                    Gold: 1500 + noise,
                    GDX: 30 + noise
                }
            });
        }
        return timeline;
    };

    it('returns UNKNOWN if timeline is less than 30 days', () => {
        const timeline = createTimeline(29);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('returns UNKNOWN if current Gold or GDX data is missing', () => {
        const timeline = createTimeline(40);
        
        // Remove currentGold
        delete timeline[39].assets.Gold;
        let result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Daten');

        // Restore and remove currentGdx
        timeline[39].assets.Gold = 1500;
        delete timeline[39].assets.GDX;
        result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('returns UNKNOWN if max data calculation returns null (edge case bypass)', () => {
        const timeline = createTimeline(40);
        
        // Delete Gold for all previous 30 days
        for(let i = 10; i < 39; i++) {
            delete timeline[i].assets.Gold;
        }
        
        // Set currentGold to a truthy string that fails > -Infinity math comparison
        timeline[39].assets.Gold = "broken_string_data";
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Max-Daten');
    });

    it('returns WARNING if Gold is at top, GDX is diverging, and drawdown is <= -3%', () => {
        const timeline = createTimeline(40);
        
        // Gold top at day 37 (2 days ago, which is <= 5)
        timeline[37].assets.Gold = 2000;
        timeline[39].assets.Gold = 1950;
        
        // GDX top at day 25 (14 days ago, which is >= 10)
        timeline[25].assets.GDX = 50;
        
        // GDX current must be <= -3.0% drawdown from 50.
        // -3.0% of 50 is 1.5. So 50 - 1.5 = 48.5. 
        // We set it to 48.0 (which is -4%)
        timeline[39].assets.GDX = 48;

        // Make sure no other days overwrite the tops
        for(let i=10; i<40; i++) {
            if(i !== 37 && i !== 39) timeline[i].assets.Gold = 1500;
            if(i !== 25 && i !== 39) timeline[i].assets.GDX = 30;
        }

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('GDX toppt vor Gold');
        expect(result.value).toContain('GDX -4.0% vom Hoch');
    });

    it('returns OK if Gold top is older than 5 days', () => {
        const timeline = createTimeline(40);
        
        // Gold top 6 days ago (fails <= 5)
        timeline[33].assets.Gold = 2000;
        for(let i=10; i<40; i++) {
            if(i !== 33) timeline[i].assets.Gold = 1500;
            timeline[i].assets.GDX = 30;
        }
        
        // Diverging GDX and enough drawdown
        timeline[25].assets.GDX = 50;
        timeline[39].assets.GDX = 48;

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('returns OK if GDX top is more recent than 10 days', () => {
        const timeline = createTimeline(40);
        
        timeline[37].assets.Gold = 2000;
        for(let i=10; i<40; i++) {
            if(i !== 37) timeline[i].assets.Gold = 1500;
            timeline[i].assets.GDX = 30;
        }
        
        // GDX top 9 days ago (fails >= 10)
        timeline[30].assets.GDX = 50;
        timeline[39].assets.GDX = 48;

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('returns OK if GDX drawdown is less severe than -3.0%', () => {
        const timeline = createTimeline(40);
        
        timeline[37].assets.Gold = 2000;
        for(let i=10; i<40; i++) {
            if(i !== 37) timeline[i].assets.Gold = 1500;
            timeline[i].assets.GDX = 30;
        }
        
        timeline[25].assets.GDX = 50;
        // -2.8% drawdown from 50 is 50 - 1.4 = 48.6
        timeline[39].assets.GDX = 48.6;

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });
});
