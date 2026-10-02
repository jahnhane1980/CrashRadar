import { Readable } from 'stream';
import { parse } from 'csv-parse';
import { Logger } from '../../Logger.js';

export class SqueezeMetricsFetchAdapter {
    constructor() {
    }

    async fetch(task, provider, startDate, requestManager) {
        Logger.info(`[SqueezeMetrics] Hole Daten für Task: ${task.id} (Zeitraum ab: ${startDate || 'Beginn'})`);
        const records = [];
        const url = 'https://squeezemetrics.com/monitor/static/DIX.csv';

        try {
            // 1. CSV als Text herunterladen
            const text = await requestManager.fetch(url, task.provider, {
                responseType: 'text',
                headers: {
                    'User-Agent': 'CrashRadar-Bot/1.0',
                    'Accept': 'text/csv,text/plain,*/*'
                }
            });

            // 2. CSV direkt in-memory als Stream parsen
            const parser = Readable.from([text]).pipe(
                parse({
                    columns: header => {
                        const normalized = header.map(column => column.trim().toLowerCase());
                        if (normalized.some(col => col.includes('<html') || col.includes('<!doctype') || col.includes('cloudflare'))) {
                            throw new Error("Fehler: API liefert HTML anstelle von CSV. Möglicherweise Cloudflare/WAF Blockade.");
                        }
                        return normalized;
                    },
                    skip_empty_lines: true,
                    trim: true
                })
            );

            let totalParsedRows = 0;

            for await (const row of parser) {
                totalParsedRows++;

                // HTML Error Page / Cloudflare WAF Protection auf Zeilenebene
                const isHtmlOrWaf = 
                    (row.date && (row.date.toLowerCase().includes('<html') || row.date.toLowerCase().includes('<!doctype') || row.date.toLowerCase().includes('cloudflare'))) ||
                    Object.values(row).some(val => typeof val === 'string' && (val.toLowerCase().includes('<html') || val.toLowerCase().includes('<!doctype') || val.toLowerCase().includes('cloudflare') || val.toLowerCase().includes('<body') || val.toLowerCase().includes('<head'))) ||
                    Object.keys(row).some(k => typeof k === 'string' && (k.toLowerCase().includes('<html') || k.toLowerCase().includes('<!doctype') || k.toLowerCase().includes('cloudflare')));

                if (isHtmlOrWaf) {
                    throw new Error("Fehler: API liefert HTML anstelle von CSV. Möglicherweise Cloudflare/WAF Blockade.");
                }

                const recordDate = row.date;

                // Chaos-Test: Fehlendes oder ungültiges Datum überspringen
                if (!recordDate || typeof recordDate !== 'string' || !recordDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    continue;
                }

                // Filter nach startDate
                if (startDate && recordDate < startDate) {
                    continue;
                }

                // Chaos-Test: Parse-Fehler abfangen und Fallbacks verwenden (0 statt NaN, um Abstürze zu verhindern)
                const price = parseFloat(row.price) || 0;
                const dix = parseFloat(row.dix) || 0;
                const gex = parseFloat(row.gex) || 0;

                // Nur valide Zeilen übernehmen (Price sollte immer > 0 sein, sonst ist die Zeile korrupt)
                if (price > 0) {
                    records.push({
                        record_date: recordDate,
                        price: price,
                        dix: dix,
                        gex: gex
                    });
                }
            }

            // Silent Fail Protection: Wenn 0 gültige Datensätze extrahiert wurden
            if (records.length === 0) {
                throw new Error(`Silent Fail: ${totalParsedRows} Zeilen geparst, aber 0 gültige Datensätze extrahiert. Datumsformat oder CSV-Struktur wurde möglicherweise vom Betreiber geändert!`);
            }

            Logger.info(`[SqueezeMetrics] ${records.length} gültige Datensätze ab ${startDate || 'Anfang'} extrahiert.`);

            // Aufsteigend nach Datum sortieren
            return records.sort((a, b) => a.record_date.localeCompare(b.record_date));

        } catch (error) {
            Logger.error(`[SqueezeMetricsFetchAdapter] Fehler beim Abruf von DIX: ${error.message}`);
            throw error;
        }
    }
}
