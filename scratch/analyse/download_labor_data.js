import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const FRED_API_KEY = process.env.FRED_API_KEY;
if (!FRED_API_KEY) {
    console.error("❌ Fehler: FRED_API_KEY ist nicht in der .env-Datei gesetzt!");
    process.exit(1);
}

const targetDir = path.join(process.cwd(), 'scratch', 'arbeitsmarkt_tmp');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`[Setup] Ordner erstellt: ${targetDir}`);
}

const seriesToDownload = [
    { id: 'CE16OV', name: 'Civilian Employment Level (Household Survey)' },
    { id: 'LNS12500000', name: 'Full-Time Workers' },
    { id: 'LNS12600000', name: 'Part-Time Workers' },
    { id: 'LNS12026619', name: 'Multiple Jobholders' },
    { id: 'U6RATE', name: 'U-6 Unemployment Rate' },
    { id: 'UNRATE', name: 'Civilian Unemployment Rate' },
    { id: 'PAYEMS', name: 'All Employees, Total Nonfarm (Payrolls)' }
];

async function downloadSeries(seriesId) {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=1995-01-01`;
    
    console.log(`[Download] Hole Daten für ${seriesId}...`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.observations || data.observations.length === 0) {
            throw new Error("Keine Beobachtungen in der API-Antwort gefunden.");
        }
        
        const filePath = path.join(targetDir, `${seriesId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`   ✅ Gespeichert: ${filePath} (${data.observations.length} Datenpunkte)`);
    } catch (e) {
        console.error(`   ❌ Fehler beim Download von ${seriesId}: ${e.message}`);
        throw e;
    }
}

async function run() {
    console.log("=== START DOWNLOAD ARBEITSMARKT-DATEN ===");
    for (const series of seriesToDownload) {
        try {
            await downloadSeries(series.id);
            // Kurze Pause, um API-Rate-Limits zu schonen
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error(`[Fatal] Download abgebrochen wegen Fehler bei ${series.id}`);
            process.exit(1);
        }
    }
    console.log("\n🎉 Alle Downloads erfolgreich abgeschlossen!");
}

run();
