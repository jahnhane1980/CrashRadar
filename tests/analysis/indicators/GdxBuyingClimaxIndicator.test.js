import { describe, it, expect, beforeEach } from 'vitest';
import { GdxBuyingClimaxIndicator } from '../../../src/analysis/indicators/GdxBuyingClimaxIndicator.js';

describe('GdxBuyingClimaxIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new GdxBuyingClimaxIndicator();
    });

    const createTimeline = (length, overrides = {}) => {
        const timeline = [];
        let basePrice = 100;
        
        for (let i = 0; i < length; i++) {
            // Chaos-Daten einbauen
            const noisePrice = (Math.random() - 0.5) * 10;
            const noiseVol = (Math.random() - 0.5) * 200;
            
            timeline.push({
                date: `2020-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: {
                    GDX: basePrice + noisePrice,
                    GDX_Volume: 1000 + noiseVol
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

    it('returns UNKNOWN if GDX price or volume is missing on current or previous day', () => {
        const timeline = createTimeline(60);
        
        // Remove currentVol
        delete timeline[59].assets.GDX_Volume;
        let result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Volumen/Preis-Daten');

        // Restore and remove currentPrice
        timeline[59].assets.GDX_Volume = 1000;
        delete timeline[59].assets.GDX;
        result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');

        // Restore and remove prevPrice
        timeline[59].assets.GDX = 100;
        delete timeline[58].assets.GDX;
        result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('returns UNKNOWN if average volume calculation fails (returns null)', () => {
        const timeline = createTimeline(60);
        
        // Lösche Volumen für alle Tage (außer heute)
        for(let i = 0; i < 59; i++) {
            delete timeline[i].assets.GDX_Volume;
        }
        
        // Setze das heutige Volumen auf einen negativen Wert.
        // Das besteht den truthiness-Check im Indikator (!currentVol ist false),
        // wird aber von getAverageForSlice ignoriert (da v > 0 gefordert wird).
        // Dadurch ist count = 0 und getAverageForSlice gibt null zurück!
        timeline[59].assets.GDX_Volume = -1;
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine gültigen Volumendaten');
    });

    it('returns WARNING if Buying Climax triggers (Vol >= 3.0x AND Price >= 5%)', () => {
        const timeline = createTimeline(60);
        
        // Zwinge Durchschnittsvolumen auf exakt 1000 durch Überschreiben der letzten 50 Tage
        for(let i = 10; i < 60; i++) {
            timeline[i].assets.GDX_Volume = 1000;
        }
        
        // Letzter Tag (Tag 59) und Vortag (Tag 58) Setup
        timeline[58].assets.GDX = 100; // Vortag Preis
        timeline[59].assets.GDX = 105; // Exakt 5.0% Anstieg
        timeline[59].assets.GDX_Volume = 3200; // >3.0x Volumen (SMA Drift berücksichtigt)

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('GDX BUYING CLIMAX');
        expect(result.value).toBe('3.1x Vol, +5.0%');
    });

    it('returns OK if Volume is high but Price rise is below threshold', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.GDX_Volume = 1000;
        
        timeline[58].assets.GDX = 100;
        timeline[59].assets.GDX = 104.9; // Nur 4.9% Anstieg
        timeline[59].assets.GDX_Volume = 5000; // 5.0x Volumen (ausreichend)

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).not.toContain('GDX BUYING CLIMAX');
    });

    it('returns OK if Price rise is high but Volume is below threshold', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.GDX_Volume = 1000;
        
        timeline[58].assets.GDX = 100;
        timeline[59].assets.GDX = 120; // 20% Anstieg (ausreichend)
        timeline[59].assets.GDX_Volume = 2000; // Sicher unter 3.0x Volumen

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).not.toContain('GDX BUYING CLIMAX');
    });
    
    it('returns OK if normal market conditions (both below thresholds)', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.GDX_Volume = 1000;
        
        timeline[58].assets.GDX = 100;
        timeline[59].assets.GDX = 102; // 2% Anstieg
        timeline[59].assets.GDX_Volume = 1500; // 1.5x Volumen

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).toContain('Kein Buying Climax');
    });
});
