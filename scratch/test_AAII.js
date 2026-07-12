import ky from 'ky';
import * as xlsx from 'xlsx';

async function fetchAAII() {
    console.log('Versuche AAII Sentiment Excel (sentiment.xls) herunterzuladen...');
    const url = 'https://www.aaii.com/files/surveys/sentiment.xls';

    try {
        const response = await ky.get(url, {
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
        const buffer = await response.arrayBuffer();
        
        console.log(`Download erfolgreich: ${buffer.byteLength} bytes.`);
        
        const workbook = xlsx.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`Geparste Zeilen im Excel: ${data.length}`);
        
        // Finde die Header-Zeile (Suche nach "Date" oder "Reported")
        let startIndex = 0;
        for (let i = 0; i < Math.min(20, data.length); i++) {
            if (data[i] && data[i][0] && data[i][0].toString().toLowerCase().includes('date')) {
                console.log(`\nHeader gefunden in Zeile ${i}:`, data[i]);
                startIndex = i + 1;
                break;
            }
        }

        console.log('\nBeispiel-Daten (Erste 5 Einträge nach Header):');
        for (let i = startIndex; i < startIndex + 5; i++) {
            if (data[i]) console.log(data[i]);
        }
        
        console.log('\nBeispiel-Daten (Letzte 5 Einträge):');
        for (let i = data.length - 5; i < data.length; i++) {
            if (data[i]) console.log(data[i]);
        }

    } catch (e) {
        console.error('Fehler beim Abruf oder Parsen:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
        }
    }
}

fetchAAII();
