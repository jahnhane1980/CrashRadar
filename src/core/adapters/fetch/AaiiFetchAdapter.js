import * as xlsx from 'xlsx';
import { Logger } from '../../Logger.js';

export class AaiiFetchAdapter {
    constructor() {}

    async fetch(task, provider, startDate, requestManager) {
        Logger.info(`[AAII] Hole Sentiment Survey Daten (Zeitraum ab: ${startDate || 'Beginn'})`);
        const url = 'https://www.aaii.com/files/surveys/sentiment.xls';

        try {
            // Wir nutzen den globalen requestManager für Rate-Limits, übergeben aber unsere Custom Headers
            const buffer = await requestManager.fetch(url, task.provider, {
                responseType: 'arrayBuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.aaii.com/sentimentsurvey',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin'
                }
            });

            const workbook = xlsx.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            let startIndex = 0;
            for (let i = 0; i < Math.min(20, data.length); i++) {
                if (data[i] && data[i][0] && data[i][0].toString().toLowerCase().includes('date')) {
                    startIndex = i + 1;
                    break;
                }
            }

            const records = [];
            
            const parseSafeFloat = (val) => {
                if (val === null || val === undefined) return 0;
                const cleanStr = String(val).replace(',', '.');
                const parsed = parseFloat(cleanStr);
                return isFinite(parsed) ? parsed : 0;
            };

            for (let i = startIndex; i < data.length; i++) {
                const row = data[i];
                if (!row || !row[0]) continue;
                
                let dateObj;
                if (typeof row[0] === 'number') {
                    // Excel base date is 1899-12-30
                    // -1 because of Excel's 1900 leap year bug
                    dateObj = new Date(Date.UTC(1899, 11, 30 + row[0]));
                } else {
                    dateObj = new Date(row[0]);
                }
                
                if (isNaN(dateObj.getTime())) continue;

                const recordDate = dateObj.toISOString().split('T')[0];
                
                // Cursor-Logik: Alles ignorieren was vor unserem startDate liegt
                if (startDate && recordDate < startDate) {
                    continue;
                }

                // Header: 'Date', 'Bullish', 'Neutral', 'Bearish', 'Total', 'Mov Avg', 'Spread', ...
                records.push({
                    record_date: recordDate,
                    bullish: parseSafeFloat(row[1]),
                    neutral: parseSafeFloat(row[2]),
                    bearish: parseSafeFloat(row[3]),
                    spread: parseSafeFloat(row[6])
                });
            }

            return records.sort((a, b) => a.record_date.localeCompare(b.record_date));

        } catch (e) {
            Logger.error(`[AaiiFetchAdapter] Fehler beim Abruf von AAII Sentiment: ${e.message}`);
            return [];
        }
    }
}
