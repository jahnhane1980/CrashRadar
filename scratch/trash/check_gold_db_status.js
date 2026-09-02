import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { IndicatorEngine } from '../../src/analysis/IndicatorEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    const expert = new FinanceExpert();
    try {
        console.log("=== Lade DB-Daten für Gold & GDX via FinanceExpert ===");
        const groupedArray = await expert.getDailyGroupedData('2024-01-01', { bypassMemoryGuard: true });
        
        // Transform array into grouped object by date
        const groupedData = {};
        groupedArray.forEach(item => {
            groupedData[item.date] = item;
        });

        const engine = new IndicatorEngine();
        const report = engine.getDailyStatusReport(groupedData);

        const dates = Object.keys(groupedData).sort();
        const latestDate = dates[dates.length - 1];
        const latestItem = groupedData[latestDate];

        console.log(`\nAktuellstes Datum in der DB: ${latestDate}`);
        console.log(`Gold Close: ${latestItem?.assets?.Gold}`);
        console.log(`Gold Volume: ${latestItem?.assets?.Gold_Volume}`);
        console.log(`GDX Close: ${latestItem?.assets?.GDX}`);
        console.log(`GDX Volume: ${latestItem?.assets?.GDX_Volume}`);

        // Get recent 10 days summary
        console.log("\nDie letzten 10 Handelstage in der DB:");
        const recentDates = dates.slice(-10);
        recentDates.forEach(d => {
            const item = groupedData[d];
            console.log(`Datum: ${d} | Gold: ${item?.assets?.Gold} (Vol: ${item?.assets?.Gold_Volume}) | GDX: ${item?.assets?.GDX}`);
        });

        // Evaluate Gold-specific indicators directly on timeline
        const timeline = dates.map(d => groupedData[d]);
        console.log("\nAktuelle Indikatoren-Bewertung (Stand: " + latestDate + "):");
        
        const actions = engine.tradeSetupEngine.evaluate(groupedData, {});
        const latestActions = (actions[latestDate] || []).filter(a => a.indicator.includes('Gold') || a.indicator.includes('GDX'));

        if (latestActions.length === 0) {
            console.log("Keine aktiven Warnungen/Signale (CRITICAL/WARNING) für Gold/GDX am " + latestDate + ".");
        } else {
            latestActions.forEach(a => {
                console.log(`- [${a.status}] ${a.indicator}: ${a.message}`);
            });
        }

        // Check recent 30 days for any Gold / GDX signals
        console.log("\nHistorische Signale für Gold/GDX in den letzten 30 Tagen:");
        const last30 = dates.slice(-30);
        let found = false;
        last30.forEach(d => {
            const acts = (actions[d] || []).filter(a => a.indicator.includes('Gold') || a.indicator.includes('GDX'));
            if (acts.length > 0) {
                found = true;
                console.log(`Datum: ${d}`);
                acts.forEach(a => console.log(`  -> [${a.status}] ${a.indicator}: ${a.message}`));
            }
        });
        if (!found) {
            console.log("Keine Trigger in den letzten 30 Tagen.");
        }

    } catch (e) {
        console.error("Fehler beim Abfragen:", e);
    } finally {
        await expert.close();
    }
}

run();
