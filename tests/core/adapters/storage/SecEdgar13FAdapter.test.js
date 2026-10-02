import { describe, it, expect, beforeEach } from 'vitest';
import { SecEdgar13FAdapter } from '../../../../src/core/adapters/storage/SecEdgar13FAdapter.js';

describe('SecEdgar13FAdapter (Storage)', () => {
    let adapter;

    beforeEach(() => {
        adapter = new SecEdgar13FAdapter();
    });

    it('sollte { query: null, values: [] } zurückgeben, wenn die Daten leer sind', () => {
        const task = { id: 'sec_13f_0001067983' };
        
        expect(adapter.getInsertQueryAndValues(task, null)).toEqual({ query: null, values: [] });
        expect(adapter.getInsertQueryAndValues(task, [])).toEqual({ query: null, values: [] });
    });

    it('sollte { query: null, values: [] } zurückgeben, wenn die Task ID nicht zu 13F passt', () => {
        const task = { id: 'some_other_task' };
        const data = [{ cik: '123' }];
        
        expect(adapter.getInsertQueryAndValues(task, data)).toEqual({ query: null, values: [] });
    });

    it('sollte ein korrektes Query und Values-Array für neue chunked 13F Tasks zurückgeben', () => {
        const task = { id: 'sec_13f_0001423053' }; // Chunked Task ID
        const data = [{
            cik: '0001423053',
            report_date: '2026-03-31',
            filing_date: '2026-05-15',
            cusip: '037833100',
            put_call: 'PUT',
            issuer_name: 'APPLE INC',
            shares: 1000,
            value: 50000
        }];

        const result = adapter.getInsertQueryAndValues(task, data);

        expect(result).not.toBeNull();
        expect(result.query).toContain('INSERT INTO fund_13f_holdings');
        expect(result.query).toContain('ON DUPLICATE KEY UPDATE');
        
        // Values array must be a 2D array mapping the properties correctly
        expect(result.values).toHaveLength(1);
        expect(result.values[0]).toEqual([
            '0001423053',
            '2026-03-31',
            '2026-05-15',
            '037833100',
            'PUT',
            'APPLE INC',
            1000,
            50000
        ]);
    });

    it('sollte ein korrektes Query und Values-Array für sec_edgar_13f zurückgeben', () => {
        const task = { id: 'sec_edgar_13f' };
        const data = [{
            cik: '0001423053',
            report_date: '2026-03-31',
            filing_date: '2026-05-15',
            cusip: '037833100',
            put_call: 'PUT',
            issuer_name: 'APPLE INC',
            shares: 1000,
            value: 50000
        }];

        const result = adapter.getInsertQueryAndValues(task, data);

        expect(result.query).toContain('INSERT INTO fund_13f_holdings');
        expect(result.values).toHaveLength(1);
        expect(result.values[0][0]).toBe('0001423053');
    });
});
