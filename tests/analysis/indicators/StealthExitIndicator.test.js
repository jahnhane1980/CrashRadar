import { describe, it, expect } from 'vitest';
import { StealthExitIndicator } from '../../../src/analysis/indicators/StealthExitIndicator.js';

describe('StealthExitIndicator', () => {
    it('sollte korrekte Metadaten haben', () => {
        const indicator = new StealthExitIndicator();
        expect(indicator.name).toBe('Stealth Exit (DIX Dark Pool Divergenz)');
        expect(indicator.category).toBe('LEADING');
    });

    it('sollte UNKNOWN zurückgeben, wenn keine Timeline vorhanden ist oder zu kurz ist', () => {
        const indicator = new StealthExitIndicator();
        expect(indicator.evaluate(null)).toEqual({ status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' });
        expect(indicator.evaluate([])).toEqual({ status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' });
        
        const shortTimeline = new Array(29).fill({ assets: { DIX: 42.0, SPY: 400.0 } });
        expect(indicator.evaluate(shortTimeline)).toEqual({ status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' });
    });

    it('sollte UNKNOWN zurückgeben, wenn DIX Daten fehlen', () => {
        const indicator = new StealthExitIndicator();
        const timeline = new Array(30).fill({ assets: { SPY: 400.0 } }); // DIX fehlt
        expect(indicator.evaluate(timeline)).toEqual({ status: 'UNKNOWN', message: 'Keine DIX Daten vorhanden' });
    });

    it('sollte UNKNOWN zurückgeben, wenn DIX-Daten keine validen Zahlen sind', () => {
        const indicator = new StealthExitIndicator();
        const timeline = new Array(30).fill({ assets: { DIX: 'invalid', SPY: 400.0 } });
        expect(indicator.evaluate(timeline)).toEqual({ status: 'UNKNOWN', message: 'Ungültige DIX Daten' });
    });

    it('sollte WARNING melden, wenn DIX < 40% und SPY Daten fehlen', () => {
        const indicator = new StealthExitIndicator();
        const timeline = new Array(30).fill({ assets: { DIX: 39.5 } });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('DIX:39.5%');
        expect(result.message).toContain('Trendbestätigung');
    });

    it('sollte OK melden, wenn DIX >= 40% und SPY Daten fehlen', () => {
        const indicator = new StealthExitIndicator();
        const timeline = new Array(30).fill({ assets: { DIX: 40.5 } });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
        expect(result.value).toBe('DIX:40.5%');
    });

    it('sollte Dezimal-DIX automatisch in Prozent konvertieren', () => {
        const indicator = new StealthExitIndicator();
        const timeline = new Array(30).fill({ assets: { DIX: 0.385, SPY: 400.0 } });
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL'); // 0.385 * 100 = 38.5% < 40%
        expect(result.value).toContain('DIX:38.5%');
    });

    it('sollte CRITICAL melden, wenn DIX < 40% und SPY nahe dem 30-Tage-Hoch ist (Drawdown >= -3.0%)', () => {
        const indicator = new StealthExitIndicator();
        const timeline = [];
        for (let i = 0; i < 29; i++) {
            timeline.push({ assets: { DIX: 42.0, SPY: 400.0 } }); // Hoch ist 400
        }
        // Letzter Tag: DIX < 40% und SPY bei 392 (Drawdown ist -2.0% -> nahe Hoch)
        timeline.push({ assets: { DIX: 38.0, SPY: 392.0 } });
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('DIX:38.0%|SPY_DD:-2.0%');
        expect(result.message).toContain('STEALTH EXIT AKTIV');
    });

    it('sollte WARNING melden, wenn DIX < 40%, aber der Markt bereits stärker korrigiert hat (Drawdown < -3.0%)', () => {
        const indicator = new StealthExitIndicator();
        const timeline = [];
        for (let i = 0; i < 29; i++) {
            timeline.push({ assets: { DIX: 42.0, SPY: 400.0 } }); // Hoch ist 400
        }
        // Letzter Tag: DIX < 40% und SPY bei 380 (Drawdown ist -5.0% -> nicht nahe Hoch)
        timeline.push({ assets: { DIX: 38.0, SPY: 380.0 } });
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('WARNING');
        expect(result.value).toBe('DIX:38.0%|SPY_DD:-5.0%');
        expect(result.message).toContain('bereits in einer Korrektur');
    });

    it('sollte OK melden, wenn DIX >= 40% und SPY nahe dem Hoch ist', () => {
        const indicator = new StealthExitIndicator();
        const timeline = [];
        for (let i = 0; i < 29; i++) {
            timeline.push({ assets: { DIX: 42.0, SPY: 400.0 } });
        }
        timeline.push({ assets: { DIX: 41.5, SPY: 398.0 } }); // Drawdown = -0.5%, DIX = 41.5%
        
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    // --- CHAOS & EDGE CASES ---
    
    it('sollte bei 10.000 Einträgen sehr schnell auswerten', () => {
        const indicator = new StealthExitIndicator();
        const timeline = [];
        for (let i = 0; i < 9999; i++) {
            timeline.push({ assets: { DIX: 42.0, SPY: 400.0 } });
        }
        timeline.push({ assets: { DIX: 38.0, SPY: 395.0 } });
        
        const start = performance.now();
        const result = indicator.evaluate(timeline);
        const end = performance.now();
        
        expect(result.status).toBe('CRITICAL');
        expect(end - start).toBeLessThan(10);
    });

    it('sollte exakt an der Floating-Point Kante korrekt arbeiten', () => {
        const indicator = new StealthExitIndicator();
        
        // 1. Genau auf der Kante DIX = 40.0% und SPY DD = -3.0%
        const timelineEdge = [];
        for (let i = 0; i < 29; i++) {
            timelineEdge.push({ assets: { DIX: 42.0, SPY: 100.0 } }); // Max is 100
        }
        timelineEdge.push({ assets: { DIX: 40.0, SPY: 97.0 } }); // DD is exactly -3.0%
        
        let result = indicator.evaluate(timelineEdge);
        // Da DIX < 40.0% gefordert ist, sollte DIX=40.0% OK sein
        expect(result.status).toBe('OK');

        // 2. Mikroskopisch drunter (DIX = 39.99999%, SPY DD = -2.99999%)
        const timelineBelow = [];
        for (let i = 0; i < 29; i++) {
            timelineBelow.push({ assets: { DIX: 42.0, SPY: 100.0 } });
        }
        timelineBelow.push({ assets: { DIX: 39.9999999, SPY: 97.0000001 } }); // DD is slightly above -3% (closer to 0)
        result = indicator.evaluate(timelineBelow);
        expect(result.status).toBe('CRITICAL');
    });

    it('sollte Struktur-Chaos (fehlende assets-Objekte in historischen Daten) ohne Crash verarbeiten', () => {
        const indicator = new StealthExitIndicator();
        const timeline = [];
        for (let i = 0; i < 28; i++) {
            timeline.push({ assets: { DIX: 42.0, SPY: 100.0 } });
        }
        // Struktur-Chaos: Ein Eintrag ohne assets
        timeline.push({ completely: 'broken', without: 'assets' });
        // Letzter Tag
        timeline.push({ assets: { DIX: 38.0, SPY: 98.0 } });

        // Sollte nicht crashen und korrekt auswerten
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
    });

    it('sollte Daten-Gaps (einzelne Tage mit null/undefined SPY-Werten) robust handhaben', () => {
        const indicator = new StealthExitIndicator();
        const timeline = [];
        for (let i = 0; i < 28; i++) {
            timeline.push({ assets: { DIX: 42.0, SPY: 100.0 } });
        }
        // Daten-Gap: SPY ist null
        timeline.push({ assets: { DIX: 42.0, SPY: null } });
        // Letzter Tag
        timeline.push({ assets: { DIX: 38.0, SPY: 98.0 } });

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
    });

    it('sollte Extremwerte von DIX (z.B. 0 oder negativ) sicher verarbeiten', () => {
        const indicator = new StealthExitIndicator();
        const timeline = [];
        for (let i = 0; i < 29; i++) {
            timeline.push({ assets: { DIX: 42.0, SPY: 100.0 } });
        }
        // DIX = 0.0
        timeline.push({ assets: { DIX: 0.0, SPY: 98.0 } });

        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('DIX:0.0%|SPY_DD:-2.0%');
    });
});
