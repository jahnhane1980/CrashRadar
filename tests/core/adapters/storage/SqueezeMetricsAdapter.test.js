import { describe, it, expect } from 'vitest';
import { SqueezeMetricsAdapter } from '../../../../src/core/adapters/storage/SqueezeMetricsAdapter.js';

describe('SqueezeMetricsAdapter', () => {
    it('sollte einen korrekten Insert-Query und gemappte Values zurückgeben', () => {
        const adapter = new SqueezeMetricsAdapter();
        const data = [
            { record_date: '2024-01-01', price: 4700.5, dix: 45.2, gex: 2.1 },
            { record_date: '2024-01-02', price: 4750.1, dix: 46.1, gex: 2.5 }
        ];
        const task = { id: 'squeezemetrics_dix' };

        const result = adapter.getInsertQueryAndValues(task, data);

        expect(result).not.toBeNull();
        expect(result.query).toContain('INSERT INTO market_data_dix');
        expect(result.query).toContain('ON DUPLICATE KEY UPDATE');
        
        expect(result.values.length).toBe(2);
        expect(result.values[0]).toEqual(['2024-01-01', 4700.5, 45.2, 2.1]);
        expect(result.values[1]).toEqual(['2024-01-02', 4750.1, 46.1, 2.5]);
    });

    it('sollte null zurückgeben, wenn data leer, null oder undefined ist', () => {
        const adapter = new SqueezeMetricsAdapter();
        const task = { id: 'squeezemetrics_dix' };

        expect(adapter.getInsertQueryAndValues(task, null)).toBeNull();
        expect(adapter.getInsertQueryAndValues(task, undefined)).toBeNull();
        expect(adapter.getInsertQueryAndValues(task, [])).toBeNull();
    });

    it('sollte null zurückgeben, wenn die task.id falsch ist', () => {
        const adapter = new SqueezeMetricsAdapter();
        const task = { id: 'falsche_id' };
        const data = [{ record_date: '2024-01-01' }];

        expect(adapter.getInsertQueryAndValues(task, data)).toBeNull();
    });

    // --- HARTE EDGE CASES ---

    it('sollte kaputte Datensätze (fehlende Properties) sicher mit undefined mappen', () => {
        const adapter = new SqueezeMetricsAdapter();
        const task = { id: 'squeezemetrics_dix' };
        
        // Datensatz ohne Werte
        const brokenData = [{ record_date: '2024-01-01' }]; 
        
        const result = adapter.getInsertQueryAndValues(task, brokenData);
        
        expect(result.values.length).toBe(1);
        // JS mappt fehlende Object-Properties zu undefined. 
        expect(result.values[0]).toEqual(['2024-01-01', undefined, undefined, undefined]);
    });

    it('sollte 1.000.000 Datensätze (RAM-Stress) ohne OOM-Absturz mappen', () => {
        const adapter = new SqueezeMetricsAdapter();
        const task = { id: 'squeezemetrics_dix' };
        
        // Baue 1.000.000 Datensätze auf (Simuliert RAM-Last)
        const massiveData = new Array(1000000).fill({
            record_date: '2024-01-01', 
            price: 4700.0,
            dix: 45.0,
            gex: 2.0
        });
        
        const start = performance.now();
        const result = adapter.getInsertQueryAndValues(task, massiveData);
        const end = performance.now();
        
        expect(result.values.length).toBe(1000000);
        // Map über 1 Mio. Datensätze sollte in Node in unter 2500ms durchlaufen
        expect(end - start).toBeLessThan(2500);
    });
});
