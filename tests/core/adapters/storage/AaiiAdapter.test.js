import { describe, it, expect } from 'vitest';
import { AaiiAdapter } from '../../../../src/core/adapters/storage/AaiiAdapter.js';

describe('AaiiAdapter', () => {
    it('sollte einen korrekten Insert-Query und gemappte Values zurückgeben', () => {
        const adapter = new AaiiAdapter();
        const data = [
            { record_date: '2024-01-01', bullish: 0.5, neutral: 0.2, bearish: 0.3, spread: 0.2 },
            { record_date: '2024-01-02', bullish: 0.4, neutral: 0.3, bearish: 0.3, spread: 0.1 }
        ];
        const task = { id: 'aaii_sentiment' };

        const result = adapter.getInsertQueryAndValues(task, data);

        expect(result).not.toBeNull();
        expect(result.query).toContain('INSERT INTO market_data_aaii');
        expect(result.query).toContain('ON DUPLICATE KEY UPDATE');
        
        expect(result.values.length).toBe(2);
        expect(result.values[0]).toEqual(['2024-01-01', 0.5, 0.2, 0.3, 0.2]);
        expect(result.values[1]).toEqual(['2024-01-02', 0.4, 0.3, 0.3, 0.1]);
    });

    it('sollte null zurückgeben, wenn data leer, null oder undefined ist', () => {
        const adapter = new AaiiAdapter();
        const task = { id: 'aaii_sentiment' };

        expect(adapter.getInsertQueryAndValues(task, null)).toBeNull();
        expect(adapter.getInsertQueryAndValues(task, undefined)).toBeNull();
        expect(adapter.getInsertQueryAndValues(task, [])).toBeNull();
    });

    it('sollte null zurückgeben, wenn die task.id falsch ist', () => {
        const adapter = new AaiiAdapter();
        const task = { id: 'falsche_id' };
        const data = [{ record_date: '2024-01-01' }];

        expect(adapter.getInsertQueryAndValues(task, data)).toBeNull();
    });

    // --- HARTE EDGE CASES ---

    it('sollte kaputte Datensätze (fehlende Properties) sicher mit undefined mappen', () => {
        const adapter = new AaiiAdapter();
        const task = { id: 'aaii_sentiment' };
        
        // Datensatz ohne Werte
        const brokenData = [{ record_date: '2024-01-01' }]; 
        
        const result = adapter.getInsertQueryAndValues(task, brokenData);
        
        expect(result.values.length).toBe(1);
        // JS mappt fehlende Object-Properties zu undefined. 
        // Für den mysql2 Treiber ist undefined im Array absolut unproblematisch (wird zu SQL NULL).
        expect(result.values[0]).toEqual(['2024-01-01', undefined, undefined, undefined, undefined]);
    });

    it('sollte 1.000.000 Datensätze (RAM-Stress) ohne OOM-Absturz mappen', () => {
        const adapter = new AaiiAdapter();
        const task = { id: 'aaii_sentiment' };
        
        // Baue 1.000.000 Datensätze auf (Simuliert RAM-Last)
        const massiveData = new Array(1000000).fill({
            record_date: '2024-01-01', 
            bullish: 0.5, 
            neutral: 0.2, 
            bearish: 0.3, 
            spread: 0.2
        });
        
        const start = performance.now();
        const result = adapter.getInsertQueryAndValues(task, massiveData);
        const end = performance.now();
        
        expect(result.values.length).toBe(1000000);
        // Map über 1 Mio. Datensätze sollte in Node in unter 2500ms durchlaufen
        expect(end - start).toBeLessThan(2500);
    });
});
