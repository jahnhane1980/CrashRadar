import { describe, test, expect } from 'vitest';
import { InvestingComAdapter } from '../../../../src/core/adapters/storage/InvestingComAdapter.js';

describe('InvestingComAdapter (Black-Box)', () => {
    test('getInsertQueryAndValues transforms data into correct SQL structure', () => {
        const adapter = new InvestingComAdapter();
        
        // 1. Input definieren
        const mockTask = { name: 'Challenger_Report' }; 
        const mockData = [
            { record_date: '2023-01-01', value: 45000 },
            { record_date: '2023-02-01', value: 50000 }
        ];

        // 2. Methode ausführen
        const result = adapter.getInsertQueryAndValues(mockTask, mockData);

        // 3. Erwarteten Output prüfen (Black-Box)
        
        // Prüfen, ob der Query die essenziellen SQL-Bestandteile enthält
        expect(result.query).toContain('INSERT INTO econ_challenger');
        expect(result.query).toContain('(record_date, value)');
        expect(result.query).toContain('VALUES ?');
        expect(result.query).toContain('ON DUPLICATE KEY UPDATE value = VALUES(value)');
        
        // Prüfen, ob die Values exakt in das [ [date, value], ... ] Format übersetzt wurden
        expect(result.values).toEqual([
            ['2023-01-01', 45000],
            ['2023-02-01', 50000]
        ]);
    });
});
