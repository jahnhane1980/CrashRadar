import fs from 'fs';
import ky from 'ky';
import * as xlsx from 'xlsx';

async function main() {
    const html = await ky.get('https://www.finra.org/investors/learn-to-invest/advanced-investing/margin-statistics').text();
    const regex = /href=[\"'](\/sites\/default\/files\/.*?margin-statistics\.xlsx)[\"']/i;
    const match = html.match(regex);
    if (!match) {
        console.error("Link nicht gefunden");
        return;
    }
    const fileUrl = 'https://www.finra.org' + match[1];
    console.log("Downloading", fileUrl);

    const buffer = await ky.get(fileUrl).arrayBuffer();
    
    // Parse
    const workbook = xlsx.read(buffer, { type: 'array' });
    console.log("Sheets:", workbook.SheetNames);
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Extract to JSON array of arrays
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log("First 15 rows:");
    for (let i = 0; i < 15; i++) {
        console.log(data[i]);
    }
}

main().catch(console.error);
