import ky from 'ky';
import * as xlsx from 'xlsx';

async function fetchNAAIM() {
    console.log('Versuche NAAIM Exposure Index Seite abzurufen...');
    const url = 'https://www.naaim.org/programs/naaim-exposure-index/';

    try {
        const html = await ky.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }).text();
        
        console.log(`HTML erfolgreich geladen (${html.length} bytes). Suche nach Excel-Link...`);
        
        // Suche gezielt nach dem Excel-Link
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
            console.error('Konnte keinen passenden Excel Link auf der NAAIM Seite finden.');
            // Fallback: Einfach alle Excel Links anzeigen, falls das Namensschema anders ist
            const allLinks = html.match(/href=[\"']([^\"']*\.xlsx?)[\"']/ig);
            console.log("Alle gefundenen Excel Links auf der Seite:", allLinks);
            return;
        }

        if (!fileUrl.startsWith('http')) {
            fileUrl = 'https://www.naaim.org' + (fileUrl.startsWith('/') ? '' : '/') + fileUrl;
        }

        console.log(`\nExcel Link gefunden: ${fileUrl}`);
        console.log('Lade Excel herunter...');
        
        const buffer = await ky.get(fileUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }).arrayBuffer();
        
        console.log(`Download erfolgreich: ${buffer.byteLength} bytes.`);
        
        const workbook = xlsx.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`Geparste Zeilen im Excel: ${data.length}`);
        
        console.log('\nErste 15 Einträge zur Überprüfung:');
        for (let i = 0; i < Math.min(15, data.length); i++) {
            if (data[i] && data[i].length > 0) console.log(`Zeile ${i}:`, data[i]);
        }

    } catch (e) {
        console.error('Fehler:', e.message);
    }
}

fetchNAAIM();
