import { describe, it, expect, beforeEach } from 'vitest';
import { GoldVolumeClimaxIndicator } from '../../../src/analysis/indicators/GoldVolumeClimaxIndicator.js';

describe('GoldVolumeClimaxIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new GoldVolumeClimaxIndicator();
    });

    const createTimeline = (length) => {
        const timeline = [];
        let basePrice = 1800;
        
        for (let i = 0; i < length; i++) {
            const noisePrice = (Math.random() - 0.5) * 5;
            const noiseVol = (Math.random() - 0.5) * 100;
            
            timeline.push({
                date: `2020-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: {
                    Gold: basePrice + noisePrice,
                    Gold_Volume: 1000 + noiseVol
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

    it('returns UNKNOWN if Gold price or volume is missing on current or previous day', () => {
        const timeline = createTimeline(60);
        
        // Remove currentVol
        delete timeline[59].assets.Gold_Volume;
        let result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine Volumen/Preis-Daten');

        // Restore and remove currentPrice
        timeline[59].assets.Gold_Volume = 1000;
        delete timeline[59].assets.Gold;
        result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');

        // Restore and remove prevPrice
        timeline[59].assets.Gold = 1800;
        delete timeline[58].assets.Gold;
        result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    it('returns UNKNOWN if average volume calculation fails (robustness check)', () => {
        const timeline = createTimeline(60);
        
        // Lösche Volumen für alle vergangenen Tage (0 bis 58)
        for(let i = 0; i < 59; i++) {
            delete timeline[i].assets.Gold_Volume;
        }
        
        // Setze das heutige Volumen auf einen negativen Wert.
        // Das besteht den truthiness-Check (!currentVol), 
        // wird aber von getAverageForSlice (v > 0) ignoriert -> avgVol = null
        timeline[59].assets.Gold_Volume = -1;
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine gültigen Volumendaten');
    });

    it('returns CRITICAL SELLING CLIMAX if Vol >= 5.0x AND Price <= -2.0%', () => {
        const timeline = createTimeline(60);
        
        // Zwinge Durchschnittsvolumen auf exakt 1000 durch Überschreiben der letzten 50 Tage
        for(let i = 10; i < 60; i++) {
            timeline[i].assets.Gold_Volume = 1000;
        }
        
        timeline[58].assets.Gold = 1800; // Vortag Preis
        timeline[59].assets.Gold = 1764; // Exakt -2.0% Einbruch
        // Volumen auf 5500 setzen (SMA driftet auf 1090, 5500/1090 = 5.04x)
        timeline[59].assets.Gold_Volume = 5500; 

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('SELLING CLIMAX');
        expect(result.value).toBe('5.0x Vol, -2.0%');
    });

    it('returns CRITICAL BUYING CLIMAX if Vol >= 5.0x AND Price >= +2.0%', () => {
        const timeline = createTimeline(60);
        
        for(let i = 10; i < 60; i++) timeline[i].assets.Gold_Volume = 1000;
        
        timeline[58].assets.Gold = 1800;
        timeline[59].assets.Gold = 1836; // Exakt +2.0% Anstieg
        timeline[59].assets.Gold_Volume = 5500; 

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('BUYING CLIMAX');
        expect(result.value).toBe('5.0x Vol, +2.0%');
    });

    it('returns OK if Volume is high but Price movement is in the middle (e.g. +1%)', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.Gold_Volume = 1000;
        
        timeline[58].assets.Gold = 1800;
        timeline[59].assets.Gold = 1818; // +1.0% (nicht genug für Climax)
        timeline[59].assets.Gold_Volume = 5500; // 5.0x Volumen

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.message).toContain('Normales Gold-Handelsvolumen');
    });

    it('returns OK if Price drops heavily but Volume is below threshold', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.Gold_Volume = 1000;
        
        timeline[58].assets.Gold = 1800;
        timeline[59].assets.Gold = 1700; // Schwerer Einbruch
        timeline[59].assets.Gold_Volume = 4000; // Nur ca 3.x Volumen (unter 5.0)

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('returns OK if Price rises heavily but Volume is below threshold', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.Gold_Volume = 1000;
        
        timeline[58].assets.Gold = 1800;
        timeline[59].assets.Gold = 1900; // Schwerer Anstieg
        timeline[59].assets.Gold_Volume = 4000; // Unter 5.0 Volumen

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });
    
    it('returns OK under normal market conditions', () => {
        const timeline = createTimeline(60);
        for(let i = 10; i < 60; i++) timeline[i].assets.Gold_Volume = 1000;
        
        timeline[58].assets.Gold = 1800;
        timeline[59].assets.Gold = 1800; // Keine Änderung
        timeline[59].assets.Gold_Volume = 1000; // Normales Volumen

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });
});
