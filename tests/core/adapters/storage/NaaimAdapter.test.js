import { describe, it, expect } from 'vitest';
import { NaaimAdapter } from '../../../../src/core/adapters/storage/NaaimAdapter.js';

describe('NaaimAdapter', () => {
    it('sollte einen korrekten Insert-Query und gemappte Values zurückgeben', () => {
        const adapter = new NaaimAdapter();
        const data = [
            { record_date: '2024-01-01', exposure_index: 85.5 },
            { record_date: '2024-01-02', exposure_index: 90.1 }
        ];
        const task = { id: 'naaim_exposure' };

        const result = adapter.getInsertQueryAndValues(task, data);

        expect(result).not.toBeNull();
        expect(result.query).toContain('INSERT INTO market_data_naaim');
        expect(result.query).toContain('ON DUPLICATE KEY UPDATE');
        
        expect(result.values.length).toBe(2);
        expect(result.values[0]).toEqual(['2024-01-01', 85.5]);
        expect(result.values[1]).toEqual(['2024-01-02', 90.1]);
    });

    it('sollte null zurückgeben, wenn data leer, null oder undefined ist', () => {
        const adapter = new NaaimAdapter();
        const task = { id: 'naaim_exposure' };

        expect(adapter.getInsertQueryAndValues(task, null)).toBeNull();
        expect(adapter.getInsertQueryAndValues(task, undefined)).toBeNull();
        expect(adapter.getInsertQueryAndValues(task, [])).toBeNull();
    });

    it('sollte null zurückgeben, wenn die task.id falsch ist', () => {
        const adapter = new NaaimAdapter();
        const task = { id: 'falsche_id' };
        const data = [{ record_date: '2024-01-01' }];

        expect(adapter.getInsertQueryAndValues(task, data)).toBeNull();
    });

    // --- HARTE EDGE CASES ---

    it('sollte kaputte Datensätze (fehlende Properties) sicher mit undefined mappen', () => {
        const adapter = new NaaimAdapter();
        const task = { id: 'naaim_exposure' };
        
        // Datensatz ohne Werte
        const brokenData = [{ record_date: '2024-01-01' }]; 
        
        const result = adapter.getInsertQueryAndValues(task, brokenData);
        
        expect(result.values.length).toBe(1);
        expect(result.values[0]).toEqual(['2024-01-01', undefined]);
    });

    it('sollte 1.000.000 Datensätze (RAM-Stress) ohne OOM-Absturz mappen', () => {
        const adapter = new NaaimAdapter();
        const task = { id: 'naaim_exposure' };
        
        // Baue 1.000.000 Datensätze auf (Simuliert RAM-Last)
        const massiveData = new Array(1000000).fill({
            record_date: '2024-01-01', 
            exposure_index: 85.5
        });
        
        const start = performance.now();
        const result = adapter.getInsertQueryAndValues(task, massiveData);
        const end = performance.now();
        
        expect(result.values.length).toBe(1000000);
        // Map über 1 Mio. Datensätze sollte in Node in unter 2500ms durchlaufen
        expect(end - start).toBeLessThan(2500);
    });
});
