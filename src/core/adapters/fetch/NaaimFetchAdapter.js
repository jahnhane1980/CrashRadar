import * as xlsx from 'xlsx';

export class NaaimFetchAdapter {
    constructor() {}

    async fetch(task, provider, startDate, requestManager) {
        console.log(`[NAAIM] Hole Exposure Index Daten (Zeitraum ab: ${startDate || 'Beginn'})`);
        const url = 'https://www.naaim.org/programs/naaim-exposure-index/';

        try {
            // Hole HTML
            const html = await requestManager.fetch(url, task.provider, {
                responseType: 'text',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // Finde Excel Link
            const regex = /href=[\"']([^\"']*\.xlsx?)[\"']/ig;
            let match;
            let fileUrl = null;

            while ((match = regex.exec(html)) !== null) {
                if (match[1].toLowerCase().includes('naaim') && match[1].toLowerCase().includes('data')) {
                    fileUrl = match[1];
                    break;
                }
            }

            if (!fileUrl) {
                console.error('[NaaimFetchAdapter] Konnte keinen Excel Link auf der NAAIM Seite finden.');
                return [];
            }

            if (!fileUrl.startsWith('http')) {
                fileUrl = 'https://www.naaim.org' + (fileUrl.startsWith('/') ? '' : '/') + fileUrl;
            }

            // Hole Excel
            const buffer = await requestManager.fetch(fileUrl, task.provider, {
                responseType: 'arrayBuffer',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            const workbook = xlsx.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            // Finde Header
            let startIndex = 0;
            for (let i = 0; i < Math.min(10, data.length); i++) {
                if (data[i] && data[i][0] && data[i][0].toString().toLowerCase().includes('date')) {
                    startIndex = i + 1;
                    break;
                }
            }

            let naaimIndex = 8; // Standard fallback
            if (startIndex > 0) {
                const header = data[startIndex - 1];
                for (let j = 0; j < header.length; j++) {
                    if (header[j] && header[j].toString().toLowerCase().includes('naaim number')) {
                        naaimIndex = j;
                        break;
                    }
                }
            }

            const parseSafeFloat = (val) => {
                if (val === null || val === undefined) return 0;
                const cleanStr = String(val).replace(',', '.');
                const parsed = parseFloat(cleanStr);
                return isFinite(parsed) ? parsed : 0;
            };

            const records = [];
            for (let i = startIndex; i < data.length; i++) {
                const row = data[i];
                if (!row || !row[0]) continue;
                
                let dateObj;
                if (typeof row[0] === 'number') {
                    dateObj = new Date(Date.UTC(1899, 11, 30 + row[0]));
                } else {
                    dateObj = new Date(row[0]);
                }
                
                if (isNaN(dateObj.getTime())) continue;

                const recordDate = dateObj.toISOString().split('T')[0];
                
                if (startDate && recordDate < startDate) {
                    continue;
                }

                records.push({
                    record_date: recordDate,
                    exposure_index: parseSafeFloat(row[naaimIndex])
                });
            }

            return records.sort((a, b) => a.record_date.localeCompare(b.record_date));

        } catch (e) {
            console.error(`[NaaimFetchAdapter] Fehler beim Abruf von NAAIM: ${e.message}`);
            return [];
        }
    }
}
