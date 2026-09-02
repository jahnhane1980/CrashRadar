import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    const expert = new FinanceExpert();
    try {
        console.log("=== Analyse: Verhalten von Gold während SPY Crashes & Margin Call Sogs ===");
        const groupedArray = await expert.getDailyGroupedData('2015-01-01', { bypassMemoryGuard: true });
        
        const groupedData = {};
        groupedArray.forEach(item => {
            groupedData[item.date] = item;
        });

        const dates = Object.keys(groupedData).sort();

        // Specific crash periods to analyze
        const crashPeriods = [
            { name: "2020 Corona Crash", start: "2020-02-15", end: "2020-05-01" },
            { name: "2022 Fed Rate Hike / SPY Bear Market", start: "2022-01-01", end: "2022-11-01" },
            { name: "2026 Crash Simulation", start: "2026-01-15", end: "2026-07-25" }
        ];

        crashPeriods.forEach(period => {
            console.log(`\n================================================================================`);
            console.log(`CRASH PERIODE: ${period.name} (${period.start} bis ${period.end})`);
            console.log(`================================================================================`);

            const pDates = dates.filter(d => d >= period.start && d <= period.end);
            if (pDates.length === 0) {
                console.log("Keine Daten in diesem Zeitraum.");
                return;
            }

            let spyMax = -Infinity, spyMaxDate = null;
            let spyMin = Infinity, spyMinDate = null;
            let goldMax = -Infinity, goldMaxDate = null;
            let goldMin = Infinity, goldMinDate = null;

            pDates.forEach(d => {
                const spy = groupedData[d]?.assets?.SPY;
                const gold = groupedData[d]?.assets?.Gold;

                if (spy) {
                    if (spy > spyMax) { spyMax = spy; spyMaxDate = d; }
                    if (spy < spyMin) { spyMin = spy; spyMinDate = d; }
                }
                if (gold) {
                    if (gold > goldMax) { goldMax = gold; goldMaxDate = d; }
                    if (gold < goldMin) { goldMin = gold; goldMinDate = d; }
                }
            });

            const spyDrop = ((spyMin - spyMax) / spyMax) * 100;
            const goldDrop = ((goldMin - goldMax) / goldMax) * 100;

            console.log(`SPY Peak:  $${spyMax.toFixed(2)} am ${spyMaxDate} | SPY Bottom:  $${spyMin.toFixed(2)} am ${spyMinDate} (Drop: ${spyDrop.toFixed(2)}%)`);
            console.log(`Gold Peak: $${goldMax.toFixed(2)} am ${goldMaxDate} | Gold Bottom: $${goldMin.toFixed(2)} am ${goldMinDate} (Drop: ${goldDrop.toFixed(2)}%)`);
            
            // Check chronological order
            console.log(`\nChronologische Abfolge:`);
            console.log(`- Gold Peak vs SPY Peak: Gold peakte am ${goldMaxDate}, SPY peakte am ${spyMaxDate}`);
            console.log(`- Gold Bottom vs SPY Bottom: Gold bödete am ${goldMinDate}, SPY bödete am ${spyMinDate}`);
            
            if (goldMinDate < spyMinDate) {
                const diffMs = new Date(spyMinDate) - new Date(goldMinDate);
                const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                console.log(`-> GOLD BÖDETE ${diffDays} TAGE VOR DEM SPY BOTTOM!`);
            } else if (goldMinDate === spyMinDate) {
                console.log(`-> GOLD UND SPY BÖDETEN AM EXAKT GLEICHEN TAG.`);
            } else {
                const diffMs = new Date(goldMinDate) - new Date(spyMinDate);
                const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                console.log(`-> SPY BÖDETE ${diffDays} TAGE VOR GOLD.`);
            }

            // Detailed tracking of Gold price movements while SPY was continuing to crash
            console.log(`\nDetail-Verlauf während der Welle:`);
            let goldAfterFirstBottom = [];
            pDates.forEach(d => {
                const spy = groupedData[d]?.assets?.SPY;
                const gold = groupedData[d]?.assets?.Gold;
                const goldVol = groupedData[d]?.assets?.Gold_Volume;
                if (d === goldMinDate || d === spyMinDate || d === goldMaxDate || d === spyMaxDate) {
                    console.log(`  [${d}] SPY: $${spy?.toFixed(2)} | Gold: $${gold?.toFixed(2)} (Vol: ${goldVol})`);
                }
            });

            // Check secondary dips for Gold AFTER Gold's first local bottom
            // Find all local minima for Gold in this period
            let goldDips = [];
            for (let i = 1; i < pDates.length - 1; i++) {
                const prevG = groupedData[pDates[i-1]]?.assets?.Gold;
                const currG = groupedData[pDates[i]]?.assets?.Gold;
                const nextG = groupedData[pDates[i+1]]?.assets?.Gold;
                if (prevG && currG && nextG && currG < prevG && currG < nextG) {
                    goldDips.push({ date: pDates[i], price: currG, spyPrice: groupedData[pDates[i]]?.assets?.SPY });
                }
            }

            if (goldDips.length > 1) {
                console.log(`\n  Sichergestellte lokale Gold-Tiefs (Dips/Margin Call Wellen) in der Periode:`);
                goldDips.forEach(dip => {
                    console.log(`    - Datum: ${dip.date} | Gold: $${dip.price.toFixed(2)} | SPY: $${dip.spyPrice ? dip.spyPrice.toFixed(2) : 'N/A'}`);
                });
            }
        });

    } catch (e) {
        console.error("Fehler:", e);
    } finally {
        await expert.close();
    }
}

run();
