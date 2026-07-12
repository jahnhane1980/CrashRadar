import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Da wir uns in einem Modul befinden könnten, definieren wir __dirname nach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfade definieren
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'tmp_data');

// .env laden, falls dotenv installiert ist (für FRED_API_KEY)
try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.join(ROOT_DIR, '.env') });
} catch (e) {
    console.log("dotenv nicht gefunden oder Fehler beim Laden, nutze System-Umgebungsvariablen.");
}

const FRED_API_KEY = process.env.FRED_API_KEY;
const START_DATE = "2006-01-01";

// Ziel-Ordner erstellen, falls er nicht existiert
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Liste der Metriken, die wir für die Sandbox brauchen
const FRED_SERIES = [
    'MTSO133FMS',       // Total Outlays
    'WRESBAL',          // Bank Reserves
    'TOTRESNS',         // Total Reserves (Fallback/Alternative)
    'USNUM',            // Treasury Securities at Banks
    'PSAVERT',          // Personal Savings Rate
    'LES1252881600Q',   // Real Median Weekly Earnings
    'MMMFFAQ027S',      // Money Market Funds
    'WALCL',            // Total Assets (FED Bilanz)
    'RRPONTSYD',        // Reverse Repo
    'BORROW',           // Discount Window Borrowing
    'WLCFLL'            // Loans (inkl. BTFP)
];

const FISCAL_DATA_ENDPOINTS = [
    {
        id: 'fiscaldata_tga',
        url: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?filter=record_date:gte:${START_DATE}&page[size]=10000`
    },
    {
        // Warnung: Table 2 Endpoints können je nach FiscalData Updates variieren, wir versuchen den Standard-Pfad
        id: 'fiscaldata_taxes_table_2',
        url: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/dts_table_2?filter=record_date:gte:${START_DATE}&page[size]=10000`
    },
    {
        id: 'fiscaldata_auctions',
        url: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?filter=record_date:gte:${START_DATE}&page[size]=10000`
    }
];

async function fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return await res.json();
        } catch (err) {
            console.error(`Fehler bei Fetch (Versuch ${i + 1}/${maxRetries}): ${err.message}`);
            if (i === maxRetries - 1) throw err;
            await new Promise(r => setTimeout(r, 2000)); // 2 Sekunden warten
        }
    }
}

async function run() {
    console.log(`🚀 Starte Sandbox-Fetcher... Zieldaten ab: ${START_DATE}`);
    console.log(`📁 Speicherort: ${OUT_DIR}\n`);

    if (!FRED_API_KEY) {
        console.warn("⚠️ KEIN FRED_API_KEY in der .env gefunden. FRED-Daten werden wahrscheinlich fehlschlagen.\n");
    }

    // 1. FRED Daten abrufen
    for (const series of FRED_SERIES) {
        const fileName = `fred_${series.toLowerCase()}.json`;
        const filePath = path.join(OUT_DIR, fileName);

        if (fs.existsSync(filePath)) {
            console.log(`✅ [SKIP] ${fileName} existiert bereits.`);
            continue;
        }

        console.log(`⬇️ Fetching FRED: ${series}...`);
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${START_DATE}`;
        
        try {
            const data = await fetchWithRetry(url);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`💾 Gespeichert: ${fileName}`);
        } catch (e) {
            console.error(`❌ Fehler beim Abrufen von ${series}:`, e.message);
        }
        
        // Kurze Pause, um Rate-Limits zu schonen
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("\n-----------------------------------\n");

    // 2. FiscalData abrufen
    for (const endpoint of FISCAL_DATA_ENDPOINTS) {
        const fileName = `${endpoint.id}.json`;
        const filePath = path.join(OUT_DIR, fileName);

        if (fs.existsSync(filePath)) {
            console.log(`✅ [SKIP] ${fileName} existiert bereits.`);
            continue;
        }

        console.log(`⬇️ Fetching FiscalData: ${endpoint.id}...`);
        try {
            const data = await fetchWithRetry(endpoint.url);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`💾 Gespeichert: ${fileName}`);
        } catch (e) {
            console.error(`❌ Fehler beim Abrufen von ${endpoint.id}:`, e.message);
        }
        
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n🎉 Sandbox-Fetch abgeschlossen! Alle Dateien liegen in ${OUT_DIR}`);
}

run();
