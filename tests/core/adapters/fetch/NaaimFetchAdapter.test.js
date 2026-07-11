import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NaaimFetchAdapter } from '../../../../src/core/adapters/fetch/NaaimFetchAdapter.js';
import * as xlsx from 'xlsx';

vi.mock('xlsx', () => ({
    read: vi.fn(),
    utils: {
        sheet_to_json: vi.fn()
    }
}));

describe('NaaimFetchAdapter', () => {
    let adapter;
    let mockRequestManager;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new NaaimFetchAdapter();
        mockRequestManager = {
            fetch: vi.fn().mockImplementation(async (url) => {
                if (url.includes('exposure-index')) {
                    // HTML Response
                    return `<html><body><a href="/wp-content/uploads/2024/01/NAAIM-Data-2024.xlsx">Excel</a></body></html>`;
                }
                // Excel Buffer Response
                return new ArrayBuffer(8);
            })
        };
        
        xlsx.read.mockReturnValue({
            SheetNames: ['Sheet1'],
            Sheets: { 'Sheet1': {} }
        });
    });

    it('sollte URL dynamisch aus HTML scrapen und Excel laden', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'X', 'Y', 'NAAIM Number'],
            ['2024-01-01', 0, 0, 80]
        ]);

        const result = await adapter.fetch({ provider: 'naaim' }, 'naaim', null, mockRequestManager);
        expect(result.length).toBe(1);
        expect(result[0].record_date).toBe('2024-01-01');
        expect(result[0].exposure_index).toBe(80);
        
        // Check if correct URL was scraped and fetched
        expect(mockRequestManager.fetch).toHaveBeenCalledWith('https://www.naaim.org/wp-content/uploads/2024/01/NAAIM-Data-2024.xlsx', 'naaim', expect.any(Object));
    });

    it('sollte leeres Array zurückgeben, wenn kein Link im HTML gefunden wird', async () => {
        mockRequestManager.fetch.mockResolvedValue(`<html><body>No Excel Here</body></html>`);
        const result = await adapter.fetch({ provider: 'naaim' }, 'naaim', null, mockRequestManager);
        expect(result).toEqual([]);
    });

    it('sollte dynamisch die Spalte NAAIM Number finden', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'NAAIM Number', 'Something Else'], // column 1
            ['2024-01-01', 95, 10]
        ]);

        const result = await adapter.fetch({ provider: 'naaim' }, 'naaim', null, mockRequestManager);
        expect(result[0].exposure_index).toBe(95);
    });

    it('sollte auf Spalte 8 zurückfallen, wenn kein Header gefunden wurde', async () => {
        // Keine Header-Zeile mit "date"
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['2024-01-01', 0, 0, 0, 0, 0, 0, 0, 75] // Index 8 ist 75
        ]);

        const result = await adapter.fetch({ provider: 'naaim' }, 'naaim', null, mockRequestManager);
        expect(result[0].exposure_index).toBe(75);
    });

    it('sollte Excel-Datumswerte korrekt verarbeiten', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'NAAIM Number'],
            [44927, 85]
        ]);

        const result = await adapter.fetch({ provider: 'naaim' }, 'naaim', null, mockRequestManager);
        expect(result[0].record_date).toBe('2023-01-01');
    });

    // --- TIEFE JS EDGE CASES & PERFORMANCE ---

    it('sollte kaputte Floats (Infinity, europäische Kommas) sicher behandeln', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'NAAIM Number'],
            ['2024-01-01', 'Infinity']
        ]);

        const result = await adapter.fetch({ provider: 'naaim' }, 'naaim', null, mockRequestManager);
        
        // Infinity crasht später MySQL. Wir erwarten, dass es geblockt wird (z.B. Fallback auf 0).
        expect(result[0].exposure_index).toBe(0);
    });

    it('sollte astronomische Excel-Zahlen ohne RangeError abfangen', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'NAAIM Number'],
            [1e15, 80] 
        ]);
        const result = await adapter.fetch({ provider: 'naaim' }, 'naaim', null, mockRequestManager);
        expect(result.length).toBe(0);
    });

    it('sollte 100.000 Zeilen ohne Event-Loop Blockade pfeilschnell verarbeiten', async () => {
        const massiveData = [['Date', 'NAAIM Number']];
        for(let i=0; i<99999; i++) massiveData.push([null, null]);
        massiveData.push(['2024-01-01', 80]);

        xlsx.utils.sheet_to_json.mockReturnValue(massiveData);

        const start = performance.now();
        const result = await adapter.fetch({ provider: 'naaim' }, 'naaim', null, mockRequestManager);
        const end = performance.now();

        expect(result.length).toBe(1);
        expect(end - start).toBeLessThan(150);
    });
});
