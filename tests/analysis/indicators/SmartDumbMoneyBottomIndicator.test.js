import { describe, it, expect } from 'vitest';
import { SmartDumbMoneyBottomIndicator } from '../../../src/analysis/indicators/SmartDumbMoneyBottomIndicator.js';

describe('SmartDumbMoneyBottomIndicator', () => {
    it('sollte korrekte Metadaten haben', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        expect(indicator.name).toBe('Smart vs Dumb Money (The Bottom)');
        expect(indicator.category).toBe('TROUGH');
    });

    it('sollte UNKNOWN zurückgeben, wenn keine Timeline vorhanden ist', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        expect(indicator.evaluate(null)).toEqual({ status: 'UNKNOWN', message: 'Zu wenig Daten' });
        expect(indicator.evaluate([])).toEqual({ status: 'UNKNOWN', message: 'Zu wenig Daten' });
    });

    it('sollte UNKNOWN zurückgeben, wenn benötigte Daten fehlen', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        const timeline = [{ assets: { VIX: 40, AAII_Spread: -20 } }]; // DIX fehlt
        expect(indicator.evaluate(timeline)).toEqual({ status: 'UNKNOWN', message: 'Keine VIX, AAII oder DIX Daten vorhanden' });
    });

    it('sollte UNKNOWN zurückgeben, wenn Daten keine validen Zahlen sind', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        const timeline = [{ assets: { VIX: 'foo', AAII_Spread: -20, DIX: 40 } }];
        expect(indicator.evaluate(timeline)).toEqual({ status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' });
    });

    it('sollte DIX normalisieren (von dezimal auf Prozent)', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        const timeline = [{ assets: { VIX: 41, AAII_Spread: -26, DIX: 0.46 } }]; // DIX 0.46 -> 46%
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toContain('DIX:46.0%');
    });

    it('sollte CRITICAL melden, wenn Schwellenwerte für Kapitulation überschritten werden', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        const timeline = [{ assets: { VIX: 41, AAII_Spread: -26, DIX: 46 } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toBe('VIX:41.0|AAII:-26.0%|DIX:46.0%');
        expect(result.message).toContain('KAPITULATION!');
    });

    it('sollte OK melden, wenn Bedingungen nicht komplett erfüllt sind (z.B. VIX zu niedrig)', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        // VIX ist nur 39 (Schwelle ist > 40)
        const timeline = [{ assets: { VIX: 39, AAII_Spread: -26, DIX: 46 } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    it('sollte OK melden, wenn Bedingungen nicht komplett erfüllt sind (z.B. AAII nicht extrem genug)', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        // AAII ist -24 (Schwelle ist < -25)
        const timeline = [{ assets: { VIX: 41, AAII_Spread: -24, DIX: 46 } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    // --- NEUE CHAOS & EDGE CASE TESTS ---

    // 1. Boundary Edge-Case
    it('sollte OK melden, wenn Werte exakt auf der Kante liegen (Boundary-Test)', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        const timeline = [{ assets: { VIX: 40, AAII_Spread: -25, DIX: 45 } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    // 2. Type Coercion & Falsy Values
    it('sollte Strings in Zahlen konvertieren und Falsy-Werte wie 0 korrekt verarbeiten', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        // VIX als String, AAII als String, DIX als 0 (falsy)
        const timeline = [{ assets: { VIX: '41', AAII_Spread: '-26', DIX: 0 } }];
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK'); // DIX 0 erfüllt > 45 nicht
        expect(result.message).toBe('Kein Bottom-Setup aktiv.');
    });

    // 3. Struktur-Chaos & O(1) Performance
    it('sollte bei 10.000 kaputten Einträgen pfeilschnell sein und fehlendes assets-Objekt abfangen', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        const timeline = new Array(10000).fill({ foo: 'bar' });
        // Letzter Tag existiert, hat aber komplett zerschossene Struktur
        timeline.push({ completely: 'broken', without: 'assets' }); 
        
        const start = performance.now();
        const result = indicator.evaluate(timeline);
        const end = performance.now();
        
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toBe('Keine VIX, AAII oder DIX Daten vorhanden');
        expect(end - start).toBeLessThan(10); // Sollte praktisch sofort fertig sein (< 10ms)
    });

    // 4. Extreme DIX-Normalisierung
    it('sollte extreme DIX-Werte bei der Normalisierung korrekt handhaben', () => {
        const indicator = new SmartDumbMoneyBottomIndicator();
        
        // Genau 1 (sollte zu 100% werden)
        let result = indicator.evaluate([{ assets: { VIX: 41, AAII_Spread: -26, DIX: 1 } }]);
        expect(result.status).toBe('CRITICAL');
        expect(result.value).toContain('DIX:100.0%');

        // Negativ oder 0 (sollte nicht multipliziert werden, sondern unverändert bleiben)
        result = indicator.evaluate([{ assets: { VIX: 41, AAII_Spread: -26, DIX: -0.5 } }]);
        expect(result.status).toBe('OK'); 
    });
});
