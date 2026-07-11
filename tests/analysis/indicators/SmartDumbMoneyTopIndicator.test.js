import { describe, it, expect } from 'vitest';
import { SmartDumbMoneyTopIndicator } from '../../../src/analysis/indicators/SmartDumbMoneyTopIndicator.js';

describe('SmartDumbMoneyTopIndicator', () => {
    it('sollte korrekte Metadaten haben', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        expect(indicator.name).toBe('Smart vs Dumb Money (The Top)');
        expect(indicator.category).toBe('TRIGGER');
    });

    it('sollte UNKNOWN zurückgeben, wenn keine Timeline vorhanden ist', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        expect(indicator.evaluate(null)).toEqual({ status: 'UNKNOWN', message: 'Zu wenig Daten' });
        expect(indicator.evaluate([])).toEqual({ status: 'UNKNOWN', message: 'Zu wenig Daten' });
    });

    it('sollte UNKNOWN zurückgeben, wenn benötigte Daten fehlen', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        const timeline = [{ assets: { SKEW: 150 } }]; // AAII_Spread fehlt
        expect(indicator.evaluate(timeline)).toEqual({ status: 'UNKNOWN', message: 'Keine SKEW oder AAII Daten vorhanden' });
    });

    it('sollte UNKNOWN zurückgeben, wenn Daten keine validen Zahlen sind', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        const timeline = [{ assets: { SKEW: 'foo', AAII_Spread: 25 } }];
        expect(indicator.evaluate(timeline)).toEqual({ status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' });
    });

    it('sollte CRITICAL melden, wenn Schwellenwerte überschritten werden', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        const timeline = [{ assets: { SKEW: 146, AAII_Spread: 21 } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('SKEW:146.0|AAII:21.0%');
        expect(result.message).toContain('CRASH-FENSTER OFFEN');
    });

    it('sollte OK melden, wenn SKEW zu niedrig ist', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        const timeline = [{ assets: { SKEW: 144, AAII_Spread: 21 } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte OK melden, wenn AAII nicht euphorisch genug ist', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        const timeline = [{ assets: { SKEW: 146, AAII_Spread: 19 } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    // --- CHAOS & EDGE CASE TESTS ---

    // Boundary Edge-Case
    it('sollte OK melden, wenn Werte exakt auf der Kante liegen (Boundary-Test)', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        const timeline = [{ assets: { SKEW: 145, AAII_Spread: 20 } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    // Type Coercion & Falsy Values
    it('sollte Strings in Zahlen konvertieren und Falsy-Werte wie 0 korrekt verarbeiten', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        const timeline = [{ assets: { SKEW: '146', AAII_Spread: 0 } }]; // AAII_Spread = 0
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK'); // AAII > 20 ist nicht erfüllt
        expect(result.message).toBe('Kein Top-Setup aktiv.');
    });

    // Struktur-Chaos & O(1) Performance
    it('sollte bei 10.000 kaputten Einträgen pfeilschnell sein und fehlendes assets-Objekt abfangen', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        const timeline = new Array(10000).fill({ invalid: 'data' });
        timeline.push({ completely: 'broken', without: 'assets' }); 
        
        const start = performance.now();
        const result = indicator.evaluate(timeline);
        const end = performance.now();
        
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine SKEW oder AAII Daten vorhanden');
        expect(end - start).toBeLessThan(10); 
    });

    // --- TIEFE JS EDGE CASES ---

    // Array Type-Coercion
    it('sollte JS Array-Coercion-Macken korrekt verarbeiten', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        // JS wandelt [146] zu 146 um, also sollte es feuern.
        let timeline = [{ assets: { SKEW: [146], AAII_Spread: [21] } }];
        let result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');

        // JS wandelt [146, 147] zu NaN um, also sollte es UNKNOWN sein.
        timeline = [{ assets: { SKEW: [146, 147], AAII_Spread: 21 } }];
        result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Ungültige Daten (keine Zahlen)');
    });

    // Type-Spoofing
    it('sollte Fake-Arrays (Type Spoofing) blocken', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        // Objekt, das sich als Array tarnt
        const fakeTimeline = { length: 1, 0: { assets: { SKEW: 150, AAII_Spread: 25 } } };
        const result = indicator.evaluate(fakeTimeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Zu wenig Daten'); 
    });

    // Floating Point Mikro-Grenzen
    it('sollte Floating-Point Mikro-Grenzen korrekt behandeln', () => {
        const indicator = new SmartDumbMoneyTopIndicator();
        
        // Exakt auf der Kante
        let timeline = [{ assets: { SKEW: 145.0, AAII_Spread: 20.0 } }];
        let result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');

        // Mikroskopisch drüber
        timeline = [{ assets: { SKEW: 145.000000001, AAII_Spread: 20.000000001 } }];
        result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');

        // Mikroskopisch drunter
        timeline = [{ assets: { SKEW: 144.999999999, AAII_Spread: 19.999999999 } }];
        result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });
});
