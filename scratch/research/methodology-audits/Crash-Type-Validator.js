import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GDX_PATH = path.resolve(__dirname, '../../data/archive/Gold-GDX-Performance-Test.csv');
const SPY_PATH = path.resolve(__dirname, '../../data/archive/cboe/SPY_1999-12-01_to_2026-06-27.csv');

function loadCsv(filepath, valColIndex) {
    if (!fs.existsSync(filepath)) return [];
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    const data = {};
    // skip header
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        data[cols[0]] = parseFloat(cols[valColIndex]);
    }
    return data;
}

function runValidator() {
    const goldGdxData = loadCsv(GDX_PATH, 1); // We just need to know the dates exist, but actually let's load SPY
    const spyDataMap = loadCsv(SPY_PATH, 4); // Assuming Close is at index 4 (Date, Open, High, Low, Close, Adj Close, Volume)
    // Wait, let's load SPY carefully. SPY format from Yahoo usually is Date,Open,High,Low,Close,Adj Close,Volume
    // We will just read Close which is index 4.
    
    // Crash Dates and their respective GDX/Gold bottoms from our previous test
    const crashes = [
        { name: "Finanzkrise (GFC) 2008", bottomDate: "2008-10-27", lookbackStart: "2008-08-01", type: "GDX führt (Flash Crash)" },
        { name: "Corona Crash 2020", bottomDate: "2020-03-13", lookbackStart: "2020-02-15", type: "GDX führt (Flash Crash)" },
        { name: "Gold Bärenmarkt Tief 2015", bottomDate: "2015-12-17", lookbackStart: "2015-08-01", type: "Gold führt (Blutender Bärenmarkt)" },
        { name: "Q1 2026 Liquidations-Crash", bottomDate: "2026-01-02", lookbackStart: "2025-08-01", type: "Gold führt (Blutender Bärenmarkt)" }
    ];

    console.log("=== BEWEIS: CRASH-GESCHWINDIGKEIT (SPY) VS. BODEN-BILDUNG ===\n");

    const spyDates = Object.keys(spyDataMap).sort();

    for (const crash of crashes) {
        // Finde den SPY Preis am Boden-Tag (oder den nächsten verfügbaren Tag davor)
        let bottomIdx = spyDates.findIndex(d => d >= crash.bottomDate);
        if (bottomIdx === -1 || spyDates[bottomIdx] > crash.bottomDate) bottomIdx--;
        
        let startIdx = spyDates.findIndex(d => d >= crash.lookbackStart);
        
        if (bottomIdx > 0 && startIdx > 0 && startIdx < bottomIdx) {
            const startPrice = spyDataMap[spyDates[startIdx]];
            const bottomPrice = spyDataMap[spyDates[bottomIdx]];
            
            const dropPercent = ((bottomPrice - startPrice) / startPrice) * 100;
            const tradingDays = bottomIdx - startIdx;
            const dropPerDay = dropPercent / tradingDays;

            console.log(`[${crash.name}] - ${crash.type}`);
            console.log(`  Zeitraum: ${spyDates[startIdx]} bis ${spyDates[bottomIdx]} (${tradingDays} Handelstage)`);
            console.log(`  SPY Preis-Sturz: ${dropPercent.toFixed(2)}%`);
            console.log(`  -> Absturz-Geschwindigkeit: ${dropPerDay.toFixed(2)}% pro Tag`);
            console.log("--------------------------------------------------");
        }
    }
}

runValidator();
