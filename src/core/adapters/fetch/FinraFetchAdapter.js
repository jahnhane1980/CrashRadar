import ky from 'ky';
import * as xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { Logger } from '../../Logger.js';

export class FinraFetchAdapter {
    constructor() {
    }

    async fetch(task, provider, startDate, requestManager) {
        if (task.dataset === 'short_volume') {
            Logger.info(`[FINRA] Hole Daily Short Volume für ${task.ticker} (Zeitraum ab: ${startDate})`);
            const records = [];
            const startStr = startDate || '2025-01-01';
            const endStr = new Date().toISOString().split('T')[0];
            const start = new Date(startStr);
            const end = new Date(endStr);
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                if (d.getDay() === 0 || d.getDay() === 6) continue; // Skip weekends
                
                const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
                const formattedDate = d.toISOString().split('T')[0];
                const url = `https://cdn.finra.org/equity/regsho/daily/CNMSshvol${dateStr}.txt`;
                
                try {
                    const text = await requestManager.fetch(url, task.provider, {
                        responseType: 'text',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5'
                        }
                    });
                    const lines = text.split('\n');
                    for (const line of lines) {
                        const parts = line.split('|');
                        // Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market
                        if (parts.length >= 5 && parts[1] === task.ticker) {
                            const shortVol = parseInt(parts[2], 10);
                            const totalVol = parseInt(parts[4], 10);
                            if (totalVol > 0) {
                                records.push({
                                    symbol: task.ticker,
                                    record_date: formattedDate,
                                    short_volume: shortVol,
                                    total_volume: totalVol,
                                    short_volume_ratio: shortVol / totalVol
                                });
                            }
                            break;
                        }
                    }
                } catch(e) {
                    if (e.response && (e.response.status === 404 || e.response.status === 403)) {
                        // Dateiformat existiert an Feiertagen etc. nicht (AWS S3 gibt 403 statt 404)
                        continue;
                    }
                    Logger.error(`[FinraFetchAdapter] Fehler beim Abruf von Short Volume ${dateStr}: ${e.message}`);
                }
            }
            return records;
        }

        Logger.info(`[FINRA] Hole Margin Statistics für Task: ${task.id}`);
        try {
            // 1. Hole die HTML Seite
            const html = await requestManager.fetch('https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics', task.provider, {
                responseType: 'text',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                }
            });
            
            // 2. Extrahiere den Excel Link
            const regex = /href=[\"'](\/sites\/default\/files\/.*?margin-statistics\.xlsx)[\"']/i;
            const match = html.match(regex);
            if (!match) {
                throw new Error("Konnte den Margin-Statistics Excel Download-Link nicht auf der FINRA Webseite finden! Struktur hat sich möglicherweise geändert.");
            }
            
            const fileUrl = 'https://www.finra.org' + match[1];
            Logger.info(`[FINRA] Excel Datei gefunden: ${fileUrl}`);

            // 3. Lade die Excel Datei herunter
            const buffer = await requestManager.fetch(fileUrl, task.provider, {
                responseType: 'arrayBuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                }
            });
            
            // 4. Parse das Excel im Speicher
            const workbook = xlsx.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            if (!data || data.length < 2) {
                throw new Error("Excel Datei ist leer oder hat ein unbekanntes Format.");
            }

            const parsedRecords = [];
            // Überspringe Header-Zeile (i=0)
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row || !row[0]) continue;
                
                // Format: '2026-05' -> '2026-05-01'
                const rawDate = row[0].toString().trim();
                const yearMonthMatch = rawDate.match(/^(\d{4})-(\d{2})$/);
                
                if (yearMonthMatch) {
                    const recordDate = `${rawDate}-01`;
                    
                    // Filter: Nur neue Daten seit startDate
                    if (startDate && recordDate < startDate) {
                        continue;
                    }

                    parsedRecords.push({
                        record_date: recordDate,
                        margin_debt: parseInt(row[1], 10) || null,
                        free_credit_cash: parseInt(row[2], 10) || null,
                        free_credit_margin: parseInt(row[3], 10) || null
                    });
                }
            }

            // 5. Lokales Backup als CSV schreiben (für's Archiv)
            if (parsedRecords.length > 0) {
                const csvHeader = 'record_date,margin_debt,free_credit_cash,free_credit_margin\n';
                const csvBody = parsedRecords.map(r => `${r.record_date},${r.margin_debt},${r.free_credit_cash},${r.free_credit_margin}`).join('\n');
                
                const dir = path.join(process.cwd(), 'data', 'archive', 'finra');
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                const currentDateStr = new Date().toISOString().split('T')[0];
                const fileName = `MarginDebt_${startDate}_to_${currentDateStr}.csv`;
                fs.writeFileSync(path.join(dir, fileName), csvHeader + csvBody);
                Logger.info(`[FINRA] CSV gesichert unter: ${path.join(dir, fileName)}`);
            } else {
                Logger.info(`[FINRA] Keine neuen Daten für den Zeitraum seit ${startDate} gefunden.`);
            }

            return parsedRecords.sort((a, b) => a.record_date.localeCompare(b.record_date));

        } catch (error) {
            Logger.error(`[FinraFetchAdapter] Fehler beim Abruf von FINRA Margin Debt: ${error.message}`);
            return [];
        }
    }
}
