import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AaiiFetchAdapter } from '../../../../src/core/adapters/fetch/AaiiFetchAdapter.js';
import * as xlsx from 'xlsx';

vi.mock('xlsx', () => ({
    read: vi.fn(),
    utils: {
        sheet_to_json: vi.fn()
    }
}));

describe('AaiiFetchAdapter', () => {
    let adapter;
    let mockRequestManager;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new AaiiFetchAdapter();
        mockRequestManager = {
            fetch: vi.fn().mockResolvedValue(new ArrayBuffer(8))
        };
        
        xlsx.read.mockReturnValue({
            SheetNames: ['Sheet1'],
            Sheets: { 'Sheet1': {} }
        });
    });

    it('sollte Excel-Zahlen als Datum (Excel 1900 Bug) korrekt umwandeln', async () => {
        // Excel Wert 44927 -> 2023-01-01
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'Bullish', 'Neutral', 'Bearish', 'Total', 'Mov Avg', 'Spread'],
            [44927, 0.40, 0.30, 0.30, 1, 0, 0.10]
        ]);

        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        expect(result.length).toBe(1);
        expect(result[0].record_date).toBe('2023-01-01'); // 1899-12-30 + 44927 Tage = 2023-01-01
        expect(result[0].bullish).toBe(0.4);
        expect(result[0].spread).toBe(0.1);
    });

    it('sollte normale Datums-Strings korrekt verarbeiten', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'Bullish'],
            ['2024-05-15', 0.50, 0.20, 0.30, 1, 0, 0.20]
        ]);

        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        expect(result.length).toBe(1);
        expect(result[0].record_date).toBe('2024-05-15');
    });

    it('sollte invalide Zeilen (kein Datum) ignorieren', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'Bullish'],
            ['NotADate', 0.50, 0.20, 0.30, 1, 0, 0.20],
            [null, 0.50],
            [] // leere zeile
        ]);

        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        expect(result.length).toBe(0);
    });

    it('sollte unvollständige Zahlen (NaN / undefined) mit 0 Fallback abfangen', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'Bullish', 'Neutral', 'Bearish', 'Total', 'Mov Avg', 'Spread'],
            ['2024-01-01', 'foo', null, undefined, 1, 0, 'bar']
        ]);

        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        expect(result[0].bullish).toBe(0);
        expect(result[0].neutral).toBe(0);
        expect(result[0].bearish).toBe(0);
        expect(result[0].spread).toBe(0);
    });

    it('sollte Datensätze vor dem startDate ausfiltern (Cursor-Logik)', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'Bullish'],
            ['2023-12-31', 0.1],
            ['2024-01-01', 0.2], // startDate
            ['2024-01-02', 0.3]
        ]);

        const result = await adapter.fetch({}, 'aaii', '2024-01-01', mockRequestManager);
        expect(result.length).toBe(2);
        expect(result[0].record_date).toBe('2024-01-01');
        expect(result[1].record_date).toBe('2024-01-02');
    });

    it('sollte bei fehlendem Header trotzdem ab Zeile 0 versuchen zu parsen', async () => {
        // Wort "Date" taucht nie auf
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['2024-01-01', 0.50, 0.20, 0.30, 1, 0, 0.20]
        ]);

        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        expect(result.length).toBe(1);
        expect(result[0].record_date).toBe('2024-01-01');
    });

    it('sollte bei Netzwerk/Fetch Fehler ein leeres Array zurückgeben und nicht crashen', async () => {
        mockRequestManager.fetch.mockRejectedValue(new Error('Network Down'));
        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        expect(result).toEqual([]);
    });

    it('sollte chronologisch sortieren', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'Bullish'],
            ['2024-02-01', 0.5],
            ['2024-01-01', 0.3]
        ]);

        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        expect(result[0].record_date).toBe('2024-01-01');
        expect(result[1].record_date).toBe('2024-02-01');
    });

    // --- TIEFE JS EDGE CASES & PERFORMANCE ---

    // 1. Infinity & Float Problem
    it('sollte kaputte Floats (Infinity, europäische Kommas) sicher behandeln', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'Bullish', 'Neutral', 'Bearish', 'Total', 'Mov Avg', 'Spread'],
            ['2024-01-01', 'Infinity', '0,5', 'NaN', 1, 0, '10e5']
        ]);

        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        
        // Die kaputten Werte müssen nun sicher bereinigt werden
        expect(result[0].bullish).toBe(0); // Infinity wird geblockt
        expect(result[0].neutral).toBe(0.5); // "0,5" wird sicher als 0.5 gelesen
        expect(result[0].bearish).toBe(0); // NaN wird geblockt
        expect(result[0].spread).toBe(1000000); // 10e5 bleibt valide
    });

    // 2. Extreme Time-Travel (RangeError-Check)
    it('sollte astronomische Excel-Zahlen ohne RangeError abfangen', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            ['Date', 'Bullish'],
            [1e15, 0.5] // Riesige Zahl, die bei Date-Umrechnung zum RangeError führen KÖNNTE
        ]);

        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        
        // Die isNaN(date.getTime()) Prüfung im Code sollte das erfolgreich fangen 
        // und die Zeile ignorieren (es kommt also ein leeres Array zurück, kein Absturz).
        expect(result.length).toBe(0);
    });

    // 3. Performance & RAM (100.000 Zeilen)
    it('sollte 100.000 Zeilen ohne Event-Loop Blockade pfeilschnell verarbeiten', async () => {
        const massiveData = [['Date', 'Bullish', 'Neutral', 'Bearish', 'Total', 'Mov Avg', 'Spread']];
        // 99.999 kaputte Zeilen, 1 gültige am Ende
        for(let i=0; i<99999; i++) {
            massiveData.push([null, null]); // Leere/ungültige Zeile
        }
        massiveData.push(['2024-01-01', 0.5, 0.2, 0.3, 1, 0, 0.2]);

        xlsx.utils.sheet_to_json.mockReturnValue(massiveData);

        const start = performance.now();
        const result = await adapter.fetch({}, 'aaii', null, mockRequestManager);
        const end = performance.now();

        expect(result.length).toBe(1);
        expect(result[0].record_date).toBe('2024-01-01');
        
        // Dauer sollte bei < 150ms liegen für diese simple Schleife
        expect(end - start).toBeLessThan(150);
    });
});
