import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqueezeMetricsFetchAdapter } from '../../../../src/core/adapters/fetch/SqueezeMetricsFetchAdapter.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('SqueezeMetricsFetchAdapter', () => {
    let adapter;
    let mockRequestManager;
    let task;

    beforeEach(() => {
        adapter = new SqueezeMetricsFetchAdapter();
        mockRequestManager = {
            fetch: vi.fn()
        };
        task = {
            id: 'squeezemetrics_dix',
            provider: 'SqueezeMetrics'
        };
    });

    it('sollte saubere CSV-Daten korrekt parsen und filtern (Happy Path)', async () => {
        const validCsv = `date,price,dix,gex
2026-07-01,7500.50,0.45,8000000.5
2026-07-02,7520.10,0.47,8100000.0
`;
        mockRequestManager.fetch.mockResolvedValue(validCsv);

        const result = await adapter.fetch(task, 'SqueezeMetrics', '2026-07-01', mockRequestManager);

        expect(result.length).toBe(2);
        expect(result[0]).toEqual({
            record_date: '2026-07-01',
            price: 7500.5,
            dix: 0.45,
            gex: 8000000.5
        });
    });

    it('sollte bei einem Download-Fehler den Fehler weiterwerfen (Fail-Fast)', async () => {
        mockRequestManager.fetch.mockRejectedValue(new Error('Network Timeout'));

        await expect(adapter.fetch(task, 'SqueezeMetrics', null, mockRequestManager))
            .rejects.toThrow('Network Timeout');
    });

    it('sollte unvollständige oder kaputte Zeilen herausfiltern (Chaos-Test)', async () => {
        // Chaos Daten: 
        // - Zeile 2: fehlendes Datum
        // - Zeile 3: korrupter Preis (wird null/0)
        // - Zeile 4: leere Felder für DIX und GEX
        const brokenCsv = `date,price,dix,gex
2026-07-01,7500.50,0.45,8000000.5
,7500.50,0.45,8000000.5
2026-07-03,BROKEN,0.47,8100000.0
2026-07-04,7550.00,,
`;
        mockRequestManager.fetch.mockResolvedValue(brokenCsv);

        const result = await adapter.fetch(task, 'SqueezeMetrics', null, mockRequestManager);

        expect(result.length).toBe(2);
        
        // Erstes valides Ergebnis
        expect(result[0].record_date).toBe('2026-07-01');
        
        // Viertes Datum, Preis ist da, Rest leer (wird Fallback 0)
        expect(result[1].record_date).toBe('2026-07-04');
        expect(result[1].price).toBe(7550.0);
        expect(result[1].dix).toBe(0);
        expect(result[1].gex).toBe(0);
    });

    it('sollte CSV direkt in-memory parsen ohne fs-Operationen (kein writeFileSync, createReadStream, unlinkSync)', async () => {
        const writeSpy = vi.spyOn(fs, 'writeFileSync');
        const readStreamSpy = vi.spyOn(fs, 'createReadStream');
        const unlinkSpy = vi.spyOn(fs, 'unlinkSync');

        mockRequestManager.fetch.mockResolvedValue("date,price,dix,gex\n2026-07-01,100,0.5,100");

        const result = await adapter.fetch(task, 'SqueezeMetrics', null, mockRequestManager);

        expect(result.length).toBe(1);
        expect(writeSpy).not.toHaveBeenCalled();
        expect(readStreamSpy).not.toHaveBeenCalled();
        expect(unlinkSpy).not.toHaveBeenCalled();

        writeSpy.mockRestore();
        readStreamSpy.mockRestore();
        unlinkSpy.mockRestore();
    });

    it('sollte einen Error werfen, wenn 0 Datenzeilen extrahiert werden (leere CSV oder nur Header)', async () => {
        mockRequestManager.fetch.mockResolvedValue("date,price,dix,gex\n");

        await expect(adapter.fetch(task, 'SqueezeMetrics', null, mockRequestManager))
            .rejects.toThrow(/0 gültige Datensätze|Keine Datenzeilen/);
    });

    it('sollte Case-Insensitive Headers korrekt verarbeiten', async () => {
        // Unterschiedliche Groß-/Kleinschreibung und Leerzeichen im Header
        const trickyCsv = `Date,  Price  ,DIX, gEx
2026-07-01,7500.50,0.45,8000000.5
`;
        mockRequestManager.fetch.mockResolvedValue(trickyCsv);

        const result = await adapter.fetch(task, 'SqueezeMetrics', '2026-07-01', mockRequestManager);

        expect(result.length).toBe(1);
        expect(result[0].record_date).toBe('2026-07-01');
        expect(result[0].price).toBe(7500.5);
    });

    it('sollte einen Error werfen, wenn eine HTML Fehlerseite statt CSV geliefert wird (Cloudflare WAF)', async () => {
        const htmlPage = `<!DOCTYPE html>
<html>
<head><title>502 Bad Gateway</title></head>
<body>Cloudflare Interception</body>
</html>`;
        mockRequestManager.fetch.mockResolvedValue(htmlPage);

        await expect(adapter.fetch(task, 'SqueezeMetrics', null, mockRequestManager))
            .rejects.toThrow('Fehler: API liefert HTML anstelle von CSV. Möglicherweise Cloudflare/WAF Blockade.');
    });

    it('sollte einen Silent Fail Error werfen, wenn sich das Datumsformat drastisch ändert', async () => {
        // Betreiber ändert Datumsformat auf MM/DD/YYYY
        const changedFormatCsv = `date,price,dix,gex
07/01/2026,7500.50,0.45,8000000.5
07/02/2026,7520.10,0.47,8100000.0
`;
        mockRequestManager.fetch.mockResolvedValue(changedFormatCsv);

        await expect(adapter.fetch(task, 'SqueezeMetrics', null, mockRequestManager))
            .rejects.toThrow(/Silent Fail/);
    });
});
