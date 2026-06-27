import ky from 'ky';
import * as xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

export class FinraFetchAdapter {
    constructor() {
        this.api = ky.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
    }

    async fetch(task, state, startDate, endDate) {
        console.log(`[FINRA] Hole Margin Statistics für Task: ${task.id}`);
        try {
            // 1. Hole die HTML Seite
            const html = await this.api.get('https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics').text();
            
            // 2. Extrahiere den Excel Link
            const regex = /href=[\"'](\/sites\/default\/files\/.*?margin-statistics\.xlsx)[\"']/i;
            const match = html.match(regex);
            if (!match) {
                throw new Error("Konnte den Margin-Statistics Excel Download-Link nicht auf der FINRA Webseite finden! Struktur hat sich möglicherweise geändert.");
            }
            
            const fileUrl = 'https://www.finra.org' + match[1];
            console.log(`[FINRA] Excel Datei gefunden: ${fileUrl}`);

            // 3. Lade die Excel Datei herunter
            const buffer = await this.api.get(fileUrl).arrayBuffer();
            
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
                    if (endDate && recordDate > endDate) {
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
                const fileName = `MarginDebt_${startDate}_to_${endDate}.csv`;
                fs.writeFileSync(path.join(dir, fileName), csvHeader + csvBody);
                console.log(`[FINRA] CSV gesichert unter: ${path.join(dir, fileName)}`);
            } else {
                console.log(`[FINRA] Keine neuen Daten für den Zeitraum (${startDate} bis ${endDate}) gefunden.`);
            }

            return parsedRecords.sort((a, b) => a.record_date.localeCompare(b.record_date));

        } catch (error) {
            console.error(`[FinraFetchAdapter] Fehler beim Abruf von FINRA Margin Debt: ${error.message}`);
            return [];
        }
    }
}
