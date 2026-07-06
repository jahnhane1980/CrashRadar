import { describe, it, expect, beforeEach } from 'vitest';
import { MarketPanicCapitulationIndicator } from '../../../src/analysis/indicators/MarketPanicCapitulationIndicator.js';

describe('MarketPanicCapitulationIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new MarketPanicCapitulationIndicator();
    });

    const createTimeline = (length) => {
        const timeline = [];
        for (let i = 0; i < length; i++) {
            // Normales Rauschen
            timeline.push({
                date: `2020-01-${(i + 1).toString().padStart(2, '0')}`,
                assets: {
                    VIX: 15 + Math.random() * 5,
                    SPY_Volume: 1000 + Math.random() * 100,
                    QQQ_Volume: 500 + Math.random() * 50
                }
            });
        }
        return timeline;
    };

    it('returns UNKNOWN if timeline is less than 15 days', () => {
        const timeline = createTimeline(14);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    it('returns UNKNOWN if no valid volume history exists for the 50-day lookback', () => {
        const timeline = createTimeline(65);
        
        // Lösche das Volumen der ersten 50 Tage (vor dem 15-Tage Fenster)
        for(let i = 0; i < 50; i++) {
            timeline[i].assets.SPY_Volume = 0;
            timeline[i].assets.QQQ_Volume = 0;
        }
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Keine gültigen Volumendaten');
    });

    it('gracefully handles completely missing assets object without throwing TypeError', () => {
        const timeline = createTimeline(65);
        
        // Simuliere fehlendes assets Objekt in den letzten 15 Tagen
        delete timeline[60].assets;
        
        const result = indicator.evaluate(timeline);
        // Entweder er rechnet mit 0 (und maxVol / maxVix bleibt niedrig -> OK) 
        // oder er gibt UNKNOWN zurück, Hauptsache er stürzt nicht ab.
        // Derzeit WIRD er abstürzen, weil in Zeile 24 "day.assets.VIX" steht.
        // Falls er nicht abstürzt und es ignoriert, erwarten wir OK (da MaxVix < 25 bleibt).
        expect(result.status).toBe('OK');
    });

    it('returns CRITICAL if VIX >= 28 and VolRatio >= 1.25 within the last 15 days', () => {
        const timeline = createTimeline(65);
        
        // Setup: Durchschnittliches Volumen ist ~1000 für SPY (durch unsere Noise-Funktion)
        // Wir erzwingen es exakt:
        for(let i = 0; i < 50; i++) {
            timeline[i].assets.SPY_Volume = 1000;
        }
        
        // Im 15-Tage Fenster (Index 50 bis 64)
        timeline[55].assets.VIX = 28.5; 
        timeline[55].assets.SPY_Volume = 1300; // 1300 / 1000 = 1.3x VolRatio
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('CAPITULATION ZONE');
        expect(result.value).toContain('VIX:28.5|Vol:1.3x');
    });

    it('returns WARNING if VIX >= 25 and VolRatio >= 1.2 within the last 15 days', () => {
        const timeline = createTimeline(65);
        
        for(let i = 0; i < 50; i++) {
            timeline[i].assets.SPY_Volume = 1000;
        }
        
        // Im 15-Tage Fenster (Index 50 bis 64)
        timeline[60].assets.VIX = 26; 
        timeline[60].assets.SPY_Volume = 1200; // 1.2x VolRatio
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('Blut auf den Straßen');
        expect(result.value).toContain('VIX:26.0|Vol:1.2x');
    });

    it('returns OK if VIX is high but Volume is low', () => {
        const timeline = createTimeline(65);
        for(let i = 0; i < 50; i++) timeline[i].assets.SPY_Volume = 1000;
        
        timeline[60].assets.VIX = 30; 
        timeline[60].assets.SPY_Volume = 1000; // 1.0x VolRatio
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('returns OK if Volume is high but VIX is low', () => {
        const timeline = createTimeline(65);
        for(let i = 0; i < 50; i++) timeline[i].assets.SPY_Volume = 1000;
        
        timeline[60].assets.VIX = 20; 
        timeline[60].assets.SPY_Volume = 1500; // 1.5x VolRatio
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('uses QQQ volume if SPY volume is missing', () => {
        const timeline = createTimeline(65);
        
        for(let i = 0; i < 50; i++) {
            delete timeline[i].assets.SPY_Volume;
            timeline[i].assets.QQQ_Volume = 1000; // QQQ als Fallback
        }
        
        for(let i = 50; i < 65; i++) {
            delete timeline[i].assets.SPY_Volume;
        }
        
        timeline[55].assets.VIX = 29;
        timeline[55].assets.QQQ_Volume = 1300; // 1.3x QQQ VolRatio
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toContain('VIX:29.0|Vol:1.3x');
    });
});
