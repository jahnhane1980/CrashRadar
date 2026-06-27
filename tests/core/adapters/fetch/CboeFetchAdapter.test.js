import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CboeFetchAdapter } from '../../../../../src/core/adapters/fetch/CboeFetchAdapter.js';
import fs from 'fs';

// Mock fs to avoid writing actual files during tests
vi.mock('fs');

describe('CboeFetchAdapter', () => {
    let adapter;
    let mockGet;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGet = vi.fn();
        adapter = new CboeFetchAdapter();
        // Override the internal ky instance with our mock
        adapter.api = {
            get: mockGet
        };
        
        fs.existsSync.mockReturnValue(true); // Pretend dir exists
    });

    it('sollte valides CSV parsen und lokal speichern (Happy Path)', async () => {
        const csvContent = `Trade Date,Options Class,Underlying,Product Type,Exchange,Volume
2026/06/01,SPY,SPY,S,CBOE,994008
2026/06/02,SPY,SPY,S,CBOE,1000000`;

        mockGet.mockReturnValue({
            text: vi.fn().mockResolvedValue(csvContent)
        });

        const task = { ticker: 'SPY' };
        const result = await adapter.fetch(task, {}, '2026-06-01');

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            symbol: 'SPY',
            record_date: '2026-06-01',
            volume: 994008
        });

        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(fs.writeFileSync.mock.calls[0][1]).toBe(csvContent);
    });

    it('sollte leere Arrays zurückgeben, wenn keine Daten gefunden werden (Grenzfall)', async () => {
        mockGet.mockReturnValue({
            text: vi.fn().mockResolvedValue('No data found for this range')
        });

        const result = await adapter.fetch({ ticker: 'SPY' }, {}, '2026-06-01');
        expect(result).toEqual([]);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('sollte Fehler sauber abfangen und leeres Array zurückgeben (Ausfall)', async () => {
        mockGet.mockImplementation(() => {
            throw new Error('Network timeout');
        });

        const result = await adapter.fetch({ ticker: 'SPY' }, {}, '2026-06-01');
        expect(result).toEqual([]);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
});
