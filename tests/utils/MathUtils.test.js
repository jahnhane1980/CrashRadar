import { describe, it, expect } from 'vitest';
import { MathUtils } from '../../src/utils/MathUtils.js';

describe('MathUtils - Härtetests & Edge Cases', () => {

    const createTimeline = (values) => values.map(v => ({ val: v }));
    const extract = (t) => t.val;

    describe('getSma', () => {
        it('gibt null zurück, wenn timeline fehlt oder zu kurz ist', () => {
            expect(MathUtils.getSma(null, extract, 10)).toBeNull();
            expect(MathUtils.getSma(createTimeline([1, 2]), extract, 5)).toBeNull();
        });

        it('ignoriert null/undefined Werte, und gibt null zurück wenn danach zu kurz', () => {
            const t = createTimeline([10, null, undefined, 20]);
            expect(MathUtils.getSma(t, extract, 3)).toBeNull(); 
        });

        it('berechnet den exakten SMA ohne Offset bei Floating-Point Chaos', () => {
            const t = createTimeline([0.1, 0.2, 0.3, 0.1, 0.2]);
            const sma = MathUtils.getSma(t, extract, 3);
            expect(sma).toBeCloseTo(0.2, 5);
        });

        it('berechnet den SMA mit Offset in großen Arrays', () => {
            const arr = Array(500).fill(0).map((_, i) => i);
            const t = createTimeline(arr);
            expect(MathUtils.getSma(t, extract, 50, 10)).toBe(464.5);
        });
    });

    describe('getRsi', () => {
        it('gibt null zurück bei ungültiger oder zu kurzer Timeline', () => {
            expect(MathUtils.getRsi(null, extract, 14)).toBeNull();
            expect(MathUtils.getRsi(createTimeline([1, 2, 3]), extract, 14)).toBeNull();
        });

        it('gibt null zurück, wenn nach dem Filtern zu wenig Daten übrig sind', () => {
            const t = createTimeline(Array(15).fill(null));
            expect(MathUtils.getRsi(t, extract, 14)).toBeNull();
        });

        it('berechnet einen gültigen RSI bei extremer Volatilität', () => {
            const crashAndPump = [];
            for(let i=0; i<100; i++) crashAndPump.push(1000 - (i*10)); 
            for(let i=0; i<20; i++) crashAndPump.push(10 + (i*100));   

            const t = createTimeline(crashAndPump);
            const rsi = MathUtils.getRsi(t, extract, 14);
            expect(typeof rsi).toBe('number');
            expect(rsi).toBeGreaterThan(70);
            expect(rsi).toBeLessThanOrEqual(100);
        });
    });

    describe('getRsiArray', () => {
        it('gibt leeres Array zurück bei ungültiger oder zu kurzer Timeline', () => {
            expect(MathUtils.getRsiArray(null, extract, 14)).toEqual([]);
            expect(MathUtils.getRsiArray(createTimeline([1, 2]), extract, 14)).toEqual([]);
        });

        it('gibt leeres Array zurück, wenn nach dem Filtern zu wenig Daten übrig sind', () => {
            const t = createTimeline(Array(15).fill(null));
            expect(MathUtils.getRsiArray(t, extract, 14)).toEqual([]);
        });

        it('berechnet das gepaddete RSI-Array und füllt es exakt auf', () => {
            const arr = Array(100).fill(0).map((_, i) => Math.sin(i) * 100 + 100); 
            const t = createTimeline(arr);
            const rsiArray = MathUtils.getRsiArray(t, extract, 14);
            expect(rsiArray.length).toBe(100);
            expect(rsiArray[0]).toBe(0);
            expect(rsiArray[13]).toBe(0);
            expect(rsiArray[14]).toBeGreaterThan(0); 
            expect(rsiArray[99]).toBeGreaterThan(0);
        });
    });

    describe('getDrawdownFromMax', () => {
        it('gibt null zurück bei ungültiger oder kurzer Timeline', () => {
            expect(MathUtils.getDrawdownFromMax(null, extract, 5)).toBeNull();
            expect(MathUtils.getDrawdownFromMax(createTimeline([1]), extract, 5)).toBeNull();
        });

        it('gibt null zurück, wenn der aktuelle Wert null ist', () => {
            const t = createTimeline([10, 20, 30, 40, null]);
            expect(MathUtils.getDrawdownFromMax(t, extract, 5)).toBeNull();
        });

        it('gibt 0 zurück, wenn das Maximum -Infinity oder 0 ist', () => {
            const t = createTimeline([null, null, 0]);
            expect(MathUtils.getDrawdownFromMax(t, extract, 3)).toBe(0);
        });

        it('findet das versteckte Maximum tief in einem gigantischen Array', () => {
            const arr = Array(1000).fill(100);
            arr[850] = 5000; 
            arr[999] = 1000; 
            const t = createTimeline(arr);
            const drop = MathUtils.getDrawdownFromMax(t, extract, 200);
            expect(drop).toBe(-80);
        });

        it('verarbeitet negative Werte (Maximum ist negativ)', () => {
            const t = createTimeline([-50, -20, -30, -40, -25]);
            const drop = MathUtils.getDrawdownFromMax(t, extract, 5);
            expect(drop).toBe(25);
        });
    });

    describe('getRateOfChangePct', () => {
        it('gibt null zurück, wenn Werte fehlen', () => {
            expect(MathUtils.getRateOfChangePct(null, 10)).toBeNull();
            expect(MathUtils.getRateOfChangePct(10, null)).toBeNull();
        });

        it('fängt Division durch Null ab', () => {
            expect(MathUtils.getRateOfChangePct(0, 10)).toBeNull();
        });

        it('berechnet RoC mit Float-Werten korrekt', () => {
            const roc = MathUtils.getRateOfChangePct(0.1, 0.3);
            expect(roc).toBeCloseTo(200.0, 5);
        });
    });

    describe('getVolumeMultiplier', () => {
        it('gibt 0 zurück bei fehlenden Werten oder avg=0', () => {
            expect(MathUtils.getVolumeMultiplier(null, 100)).toBe(0);
            expect(MathUtils.getVolumeMultiplier(100, null)).toBe(0);
            expect(MathUtils.getVolumeMultiplier(100, 0)).toBe(0);
        });

        it('berechnet den Multiplikator präzise', () => {
            expect(MathUtils.getVolumeMultiplier(3900000, 1300000)).toBeCloseTo(3.0, 5);
        });
    });

    describe('getAverage', () => {
        it('gibt 0 zurück bei ungültigen Arrays', () => {
            expect(MathUtils.getAverage(null)).toBe(0);
            expect(MathUtils.getAverage([])).toBe(0);
        });

        it('bewältigt Javascript Float-Math Fehler (0.1 + 0.2)', () => {
            const avg = MathUtils.getAverage([0.1, 0.2]);
            expect(avg).toBeCloseTo(0.15, 5);
        });
    });

    describe('getAverageForSlice', () => {
        it('gibt null zurück bei zu kurzer Timeline', () => {
            expect(MathUtils.getAverageForSlice(null, extract, 5)).toBeNull();
            expect(MathUtils.getAverageForSlice(createTimeline([1, 2]), extract, 5)).toBeNull();
        });

        it('gibt null zurück, wenn kein gültiger Wert gefunden wurde (count=0)', () => {
            const t = createTimeline([-10, 0, null, undefined, -5]);
            expect(MathUtils.getAverageForSlice(t, extract, 5)).toBeNull();
        });

        it('ignoriert konsequent negative Werte und Nullen (Volumen-Logik)', () => {
            const arr = [-1000, 0, null, 50, -50, 150];
            const t = createTimeline(arr);
            expect(MathUtils.getAverageForSlice(t, extract, 6)).toBe(100);
        });
    });

    describe('getMaxWithIndex', () => {
        it('gibt null zurück bei zu kurzer Timeline', () => {
            expect(MathUtils.getMaxWithIndex(null, extract, 5)).toBeNull();
            expect(MathUtils.getMaxWithIndex(createTimeline([1]), extract, 5)).toBeNull();
        });

        it('gibt null zurück, wenn keine gültigen Werte vorhanden sind', () => {
            const t = createTimeline([null, undefined, null, null]);
            expect(MathUtils.getMaxWithIndex(t, extract, 4)).toBeNull();
        });

        it('findet das korrekte Maximum in einem rein negativen Array', () => {
            const t = createTimeline([-500, -100, -300, -200, -400]);
            const res = MathUtils.getMaxWithIndex(t, extract, 5);
            expect(res.maxValue).toBe(-100);
            expect(res.daysAgo).toBe(3);
        });
    });
});
