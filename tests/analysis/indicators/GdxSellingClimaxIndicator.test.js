import { describe, it, expect, beforeEach } from 'vitest';
import { GdxSellingClimaxIndicator } from '../../../src/analysis/indicators/GdxSellingClimaxIndicator.js';

describe('GdxSellingClimaxIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new GdxSellingClimaxIndicator();
    });

    const createTimeline = (length) => {
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

    it('returns UNKNOWN if average volume calculation fails (robustness check)', () => {
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

    it('returns CRITICAL if Selling Climax triggers (Vol >= 3.0x AND Price <= -5%)', () => {
        const timeline = createTimeline(60);
        
        // Zwinge Durchschnittsvolumen auf exakt 1000 durch Überschreiben der letzten 50 Tage
        for(let i = 10; i < 60; i++) {
            timeline[i].assets.GDX_Volume = 1000;
        }
        
        timeline[58].assets.GDX = 100; // Vortag Preis
        timeline[59].assets.GDX = 95; // Exakt -5.0% Einbruch
        // Volumen auf 3200 setzen (zieht den SMA auf 1044 hoch, 3200/1044 = 3.06x)
        timeline[59].assets.GDX_Volume = 3200; 

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('GDX SELLING CLIMAX');
        expect(result.value).toBe('3.1x Vol, -5.0%');
    });

    it('returns OK if Volume is high but Price drop is not severe enough', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.GDX_Volume = 1000;
        
        timeline[58].assets.GDX = 100;
        timeline[59].assets.GDX = 95.1; // Nur -4.9% Einbruch (fail)
        timeline[59].assets.GDX_Volume = 5000; // 5.0x Volumen

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).not.toContain('GDX SELLING CLIMAX');
    });

    it('returns OK if Price drop is severe but Volume is below threshold', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.GDX_Volume = 1000;
        
        timeline[58].assets.GDX = 100;
        timeline[59].assets.GDX = 80; // -20% Einbruch
        timeline[59].assets.GDX_Volume = 2000; // Sicher unter 3.0x Volumen

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).not.toContain('GDX SELLING CLIMAX');
    });
    
    it('returns OK if normal market conditions', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.GDX_Volume = 1000;
        
        timeline[58].assets.GDX = 100;
        timeline[59].assets.GDX = 98; // -2% 
        timeline[59].assets.GDX_Volume = 1500; // 1.5x Volumen

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).toContain('Kein Selling Climax');
    });
});
