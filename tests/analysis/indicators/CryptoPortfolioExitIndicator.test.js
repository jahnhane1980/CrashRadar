import { describe, it, expect, beforeEach } from 'vitest';
import { CryptoPortfolioExitIndicator } from '../../../src/analysis/indicators/CryptoPortfolioExitIndicator.js';

describe('CryptoPortfolioExitIndicator', () => {
    let indicator;
    let mockGetCycleConfig;

    beforeEach(() => {
        mockGetCycleConfig = () => ({
            MACRO_CYCLE: {
                lastBtcBottomDate: '2022-11-21',
                dangerWindowStartDays: 970
            }
        });
        indicator = new CryptoPortfolioExitIndicator(mockGetCycleConfig);
    });

    const createTimeline = (length, overrides = {}) => {
        const timeline = [];
        const baseDate = new Date('2022-11-21'); // same as bottom
        
        for (let i = 0; i < length; i++) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + i + (overrides.startOffsetDays || 0));
            
            // Chaos-Daten: Rauschen für Preis und Volumen
            const noise = (Math.random() - 0.5) * 10;
            
            timeline.push({
                date: date.toISOString().split('T')[0],
                assets: {
                    MSTR: 200 + noise,
                    COIN: 100 + noise,
                    MSTR_Volume: 1000 + Math.random() * 200,
                    COIN_Volume: 500 + Math.random() * 100
                }
            });
        }
        return timeline;
    };

    it('returns UNKNOWN if timeline is less than 50 days', () => {
        const timeline = createTimeline(49);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('returns UNKNOWN if config or lastBtcBottomDate is missing', () => {
        const indicatorNoConfig = new CryptoPortfolioExitIndicator(() => ({}));
        const result1 = indicatorNoConfig.evaluate(createTimeline(60));
        expect(result1.status).toBe('UNKNOWN');

        const indicatorNoBottom = new CryptoPortfolioExitIndicator(() => ({ MACRO_CYCLE: {} }));
        const result2 = indicatorNoBottom.evaluate(createTimeline(60));
        expect(result2.status).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for invalid dates', () => {
        const indicatorBadConfig = new CryptoPortfolioExitIndicator(() => ({
            MACRO_CYCLE: { lastBtcBottomDate: 'invalid-date' }
        }));
        const result = indicatorBadConfig.evaluate(createTimeline(60));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Ungültiges Datum');
    });

    it('returns OK if inside safe zone (e.g. 800 days since bottom), even with a crash', () => {
        // Tag 800 (unter 970)
        const timeline = createTimeline(60, { startOffsetDays: 740 });
        
        // Simuliere gewaltigen Crash, der theoretisch alles triggern würde
        timeline[58].assets.MSTR = 1000; 
        timeline[59].assets.MSTR = 10;
        timeline[59].assets.MSTR_Volume = 100000;

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).toContain('sicheren Zeitfenster');
    });

    it('returns WARNING if in danger zone but no trigger occurs', () => {
        // Tag 1000 (über 970)
        const timeline = createTimeline(60, { startOffsetDays: 940 });
        
        // Preis geht hoch statt runter, also kein Cross Down
        timeline[58].assets.MSTR = 200;
        timeline[59].assets.MSTR = 250;
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Gefahrenzone');
    });

    it('returns CRITICAL when MSTR and COIN break SMA50 with high volume in danger zone', () => {
        const timeline = createTimeline(60, { startOffsetDays: 940 });
        
        // MSTR Cross Down + hohes Volumen
        timeline[58].assets.MSTR = 500;
        timeline[59].assets.MSTR = 50; 
        timeline[59].assets.MSTR_Volume = 50000; 
        
        // COIN Cross Down + hohes Volumen
        timeline[58].assets.COIN = 300;
        timeline[59].assets.COIN = 20;
        timeline[59].assets.COIN_Volume = 30000;
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('MSTR bricht SMA 50');
        expect(result.message).toContain('COIN bricht SMA 50');
    });

    it('returns CRITICAL if only MSTR triggers, handles exact thresholds for COIN', () => {
        const timeline = createTimeline(60, { startOffsetDays: 940 });
        
        // MSTR bricht extrem ein
        timeline[58].assets.MSTR = 500;
        timeline[59].assets.MSTR = 50; 
        timeline[59].assets.MSTR_Volume = 50000; 

        // COIN bricht ein, hat aber normales Volumen (<= 1.2x)
        timeline[58].assets.COIN = 300;
        timeline[59].assets.COIN = 20;
        timeline[59].assets.COIN_Volume = 500; 
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('MSTR bricht SMA 50');
        expect(result.message).not.toContain('COIN bricht SMA 50');
    });

    it('gracefully handles completely missing asset data without crashing', () => {
        const timeline = createTimeline(60, { startOffsetDays: 940 });
        // Let's remove MSTR and COIN from all days to see if the engine survives
        for(let t of timeline) {
            delete t.assets.MSTR;
            delete t.assets.COIN;
        }
        
        const result = indicator.evaluate(timeline);
        
        // Since no alarm can trigger without data, it should fallback to WARNING
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Warten auf SMA 50 Bruch');
    });
});
