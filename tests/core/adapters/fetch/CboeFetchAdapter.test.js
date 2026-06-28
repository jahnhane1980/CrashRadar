import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CboeFetchAdapter } from '../../../../../src/core/adapters/fetch/CboeFetchAdapter.js';
import fs from 'fs';

// Mock fs to avoid writing actual files during tests
vi.mock('fs');
vi.mock('yahoo-finance2', () => {
    const mockOptions = vi.fn();
    const mockConstructor = function() {
        return { options: mockOptions };
    };
    mockConstructor.options = mockOptions;
    return { default: mockConstructor };
});
import yahooFinance from 'yahoo-finance2';

describe('CboeFetchAdapter', () => {
    let adapter;
    let mockRequestManager;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRequestManager = { fetch: vi.fn() };
        adapter = new CboeFetchAdapter();
        
        fs.existsSync.mockReturnValue(true); // Pretend dir exists
    });

    it('sollte valides CSV parsen und lokal speichern (Happy Path)', async () => {
        const csvContent = `Trade Date,Options Class,Underlying,Product Type,Exchange,Volume
2026/06/01,SPY,SPY,S,CBOE,994008
2026/06/02,SPY,SPY,S,CBOE,1000000`;

        mockRequestManager.fetch.mockResolvedValue(csvContent);

        const task = { ticker: 'SPY' };
        const result = await adapter.fetch(task, {}, '2026-06-01', mockRequestManager);

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
        mockRequestManager.fetch.mockResolvedValue('No data found for this range');

        const result = await adapter.fetch({ ticker: 'SPY' }, {}, '2026-06-01', mockRequestManager);
        expect(result).toEqual([]);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('sollte Fehler sauber abfangen und leeres Array zurückgeben (Ausfall)', async () => {
        mockRequestManager.fetch.mockRejectedValue(new Error('Network timeout'));

        const result = await adapter.fetch({ ticker: 'SPY' }, {}, '2026-06-01', mockRequestManager);
        expect(result).toEqual([]);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    describe('dataset === pcr (Melt-Up Filter)', () => {
        it('sollte das lokale Archiv lesen und YahooFinance für neue Daten aufrufen (Happy Path)', async () => {
            fs.existsSync.mockImplementation((pathStr) => pathStr.includes('pcr.csv'));
            fs.readFileSync.mockReturnValue(`record_date,total_pcr\n2024-01-01,0.95`);
            
            yahooFinance.options.mockResolvedValue({
                options: [{
                    expirationDate: '2024-01-02',
                    puts: [{ volume: 1500 }],
                    calls: [{ volume: 2000 }]
                }]
            });

            const result = await adapter.fetch({ dataset: 'pcr' }, {}, '2024-01-01', mockRequestManager);
            
            // Should contain 1 from CSV and 1 from Yahoo (1500/2000 = 0.75)
            expect(result).toHaveLength(2);
            expect(result[0].record_date).toBe('2024-01-01');
            expect(result[0].total_pcr).toBe(0.95);
            
            expect(result[1].total_pcr).toBe(0.75); // 1500/2000
        });

        it('sollte fehlende YahooFinance Daten sicher abfangen (Fehlerbehandlung)', async () => {
            fs.existsSync.mockImplementation((pathStr) => pathStr.includes('pcr.csv'));
            fs.readFileSync.mockReturnValue(`record_date,total_pcr\n2024-01-01,0.95`);
            
            yahooFinance.options.mockRejectedValue(new Error('Yahoo down'));

            const result = await adapter.fetch({ dataset: 'pcr' }, {}, '2024-01-01', mockRequestManager);
            
            expect(result).toHaveLength(1);
            expect(result[0].record_date).toBe('2024-01-01');
            expect(result[0].total_pcr).toBe(0.95);
        });

        it('sollte leeres Array zurückgeben, wenn Archiv fehlt und Yahoo fehlschlägt (Grenzfall)', async () => {
            fs.existsSync.mockReturnValue(false);
            
            yahooFinance.options.mockResolvedValue(null);

            const result = await adapter.fetch({ dataset: 'pcr' }, {}, '2024-01-01', mockRequestManager);
            expect(result).toHaveLength(0);
        });
    });
});
