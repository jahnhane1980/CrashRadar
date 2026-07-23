import fs from 'fs';
import path from 'path';
import os from 'os';
import { parse } from 'csv-parse';
import { Logger } from '../../Logger.js';

export class SqueezeMetricsFetchAdapter {
    constructor() {
    }

    async fetch(task, provider, startDate, requestManager) {
        Logger.info(`[SqueezeMetrics] Hole Daten für Task: ${task.id} (Zeitraum ab: ${startDate || 'Beginn'})`);
        const records = [];
        const url = 'https://squeezemetrics.com/monitor/static/DIX.csv';
        
        // 1. Temporären Dateipfad definieren (im OS Temp-Verzeichnis)
        const tempFilePath = path.join(os.tmpdir(), `dix_${Date.now()}_${Math.random().toString(36).substring(7)}.csv`);

        try {
            // 2. CSV als Text herunterladen
            const text = await requestManager.fetch(url, task.provider, {
                responseType: 'text',
                headers: {
                    'User-Agent': 'CrashRadar-Bot/1.0',
                    'Accept': 'text/csv,text/plain,*/*'
                }
            });

            // 3. Temporär auf die Festplatte schreiben
            fs.writeFileSync(tempFilePath, text);
            Logger.info(`[SqueezeMetrics] Datei temporär gespeichert unter: ${tempFilePath}`);

            // 4. Datei als Stream parsen (Ressourcenschonend, falls Dateien wachsen)
            const parser = fs.createReadStream(tempFilePath).pipe(
                parse({
                    columns: header => header.map(column => column.trim().toLowerCase()), // Header normalisieren (Case-Insensitive)
                    skip_empty_lines: true,
                    trim: true
                })
            );

            let totalParsedRows = 0;

            for await (const row of parser) {
                totalParsedRows++;
                
                // HTML Error Page Protection: Wenn der Parser HTML-Tags statt CSV-Daten findet
                if (row.date && row.date.includes('<html') || row.date && row.date.includes('<!doctype')) {
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

            // Silent Fail Protection: Wenn Zeilen geparst wurden, aber 100% davon verworfen wurden (z.B. falsches Date-Format)
            if (totalParsedRows > 0 && records.length === 0) {
                throw new Error(`Silent Fail: ${totalParsedRows} Zeilen geparst, aber 0 gültige Datensätze extrahiert. Datumsformat oder CSV-Struktur wurde möglicherweise vom Betreiber geändert!`);
            }

            Logger.info(`[SqueezeMetrics] ${records.length} gültige Datensätze ab ${startDate || 'Anfang'} extrahiert.`);
            
            // Aufsteigend nach Datum sortieren
            return records.sort((a, b) => a.record_date.localeCompare(b.record_date));

        } catch (error) {
            Logger.error(`[SqueezeMetricsFetchAdapter] Fehler beim Abruf von DIX: ${error.message}`);
            return [];
        } finally {
            // 5. Aufräumen: Temporäre Datei löschen (egal ob Fehler oder Erfolg)
            if (fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    Logger.info(`[SqueezeMetrics] Temporäre Datei erfolgreich gelöscht: ${tempFilePath}`);
                } catch (cleanupError) {
                    Logger.error(`[SqueezeMetricsFetchAdapter] Fehler beim Löschen der temporären Datei: ${cleanupError.message}`);
                }
            }
        }
    }
}
