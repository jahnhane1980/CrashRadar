import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { RegimeLabeler } from '../src/analysis/RegimeLabeler.js';

async function runTest() {
    try {
        const dbUrl = process.env.DATABASE_URL;
        console.log(`Connecting to DB...`);
        const expert = new FinanceExpert(dbUrl);
        
        console.log(`Lade historische Daten (ab 2016) mit ausgeschaltetem Memory Guard...`);
        const data = await expert.getDailyGroupedData('2016-01-01', { bypassMemoryGuard: true });
        
        console.log(`Initiiere RegimeLabeler (Dow-Theorie) für BTC...`);
        const labeler = new RegimeLabeler(data, 'BTC');
        const labeledData = labeler.generateLabels();
        
        console.log(`\n=== DYNAMISCHE ZYKLUS-ANALYSE ===`);
        console.log(`Initiales Config-Fenster: ${labeler.baseCycleDays} Tage`);
        console.log(`Gemessenes + 5% Fenster : ${labeler.measuredWindow} Tage`);
        console.log(`=================================`);
        
        let csvContent = "Date,Close,Label\n";
        let stateChanges = [];
        let lastLabel = null;

        for (const row of labeledData) {
            if (row.close !== null) {
                csvContent += `${row.date},${row.close},${row.label}\n`;
                
                if (row.label !== lastLabel && lastLabel !== null && row.label !== 'UNKNOWN') {
                    stateChanges.push(`${row.date}: ${lastLabel.padEnd(16)} -> ${row.label.padEnd(16)} (Close: $${row.close})`);
                }
                lastLabel = row.label;
            }
        }
        
        const outDir = path.join(process.cwd(), 'scratch');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        
        const outPath = path.join(outDir, 'btc_regimes_output.csv');
        fs.writeFileSync(outPath, csvContent);
        
        console.log(`\n✅ Fertig! CSV Export gespeichert unter: ${outPath}`);
        
        console.log(`\n--- Die letzten 25 Struktur-Wechsel ---`);
        const recentChanges = stateChanges.slice(-25);
        for (const change of recentChanges) {
            console.log(change);
        }

        const counts = {};
        for (const row of labeledData) {
            if (row.close !== null) {
                counts[row.label] = (counts[row.label] || 0) + 1;
            }
        }
        console.log(`\n--- Label Verteilung (Klassen-Balance) ---`);
        console.table(counts);

        await expert.close();
    } catch (e) {
        console.error("Fehler:", e);
    }
}

runTest();
