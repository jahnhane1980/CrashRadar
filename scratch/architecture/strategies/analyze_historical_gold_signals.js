import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { GoldVolumeClimaxIndicator } from '../../../src/analysis/indicators/GoldVolumeClimaxIndicator.js';
import { GoldCapitulationIndicator } from '../../../src/analysis/indicators/GoldCapitulationIndicator.js';
import { GdxGoldDivergenceIndicator } from '../../../src/analysis/indicators/GdxGoldDivergenceIndicator.js';
import { GdxSellingClimaxIndicator } from '../../../src/analysis/indicators/GdxSellingClimaxIndicator.js';
import { GdxBuyingClimaxIndicator } from '../../../src/analysis/indicators/GdxBuyingClimaxIndicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    const expert = new FinanceExpert();
    try {
        console.log("=== Lade historische DB-Daten ab 2015 für Gold-Indikatoren Analysis ===");
        const groupedArray = await expert.getDailyGroupedData('2015-01-01', { bypassMemoryGuard: true });
        
        const groupedData = {};
        groupedArray.forEach(item => {
            groupedData[item.date] = item;
        });

        const dates = Object.keys(groupedData).sort();
        const timeline = [];

        const indicators = [
            new GoldVolumeClimaxIndicator(),
            new GoldCapitulationIndicator(),
            new GdxGoldDivergenceIndicator(),
            new GdxSellingClimaxIndicator(),
            new GdxBuyingClimaxIndicator()
        ];

        const triggeredEvents = [];

        for (let i = 0; i < dates.length; i++) {
            const dateStr = dates[i];
            const currentDay = groupedData[dateStr];
            timeline.push(currentDay);

            if (timeline.length < 50) continue;

            for (const ind of indicators) {
                const res = ind.evaluate(timeline);
                if (res && res.status !== 'UNKNOWN' && res.status !== 'OK') {
                    triggeredEvents.push({
                        date: dateStr,
                        indicator: ind.name,
                        category: ind.category,
                        status: res.status,
                        value: res.value,
                        message: res.message,
                        goldPrice: currentDay.assets?.Gold,
                        goldVolume: currentDay.assets?.Gold_Volume,
                        gdxPrice: currentDay.assets?.GDX
                    });
                }
            }
        }

        console.log(`\nGesamt-Anzahl ausgelöster Signale: ${triggeredEvents.length}`);

        // Helper to find closest local/macro min and max in a window around a date
        function getDistanceToPeakAndTrough(eventIndex) {
            const evDateIdx = dates.indexOf(triggeredEvents[eventIndex].date);
            const windowDays = 60; // 60 days before and after
            const start = Math.max(0, evDateIdx - windowDays);
            const end = Math.min(dates.length - 1, evDateIdx + windowDays);

            let maxPrice = -Infinity, maxDate = null, maxIdx = null;
            let minPrice = Infinity, minDate = null, minIdx = null;

            for (let j = start; j <= end; j++) {
                const p = groupedData[dates[j]]?.assets?.Gold;
                if (p) {
                    if (p > maxPrice) {
                        maxPrice = p;
                        maxDate = dates[j];
                        maxIdx = j;
                    }
                    if (p < minPrice) {
                        minPrice = p;
                        minDate = dates[j];
                        minIdx = j;
                    }
                }
            }

            const daysToMax = maxIdx - evDateIdx;
            const daysToMin = minIdx - evDateIdx;
            const currentPrice = triggeredEvents[eventIndex].goldPrice;
            const pctFromMax = ((currentPrice - maxPrice) / maxPrice) * 100;
            const pctFromMin = ((currentPrice - minPrice) / minPrice) * 100;

            return { maxPrice, maxDate, daysToMax, pctFromMax, minPrice, minDate, daysToMin, pctFromMin };
        }

        console.log("\n=== Detaillierte Liste der getriggerten Signale mit Distanz zu Tops/Bottoms ===");
        
        triggeredEvents.forEach((ev, idx) => {
            const stats = getDistanceToPeakAndTrough(idx);
            console.log(`\n--------------------------------------------------------------------------------`);
            console.log(`[${ev.date}] ${ev.indicator} (${ev.status})`);
            console.log(` Gold-Preis an Signal: $${ev.goldPrice?.toFixed(2)} | GDX: $${ev.gdxPrice ? ev.gdxPrice.toFixed(2) : 'N/A'}`);
            console.log(` Indikator Message: "${ev.message}"`);
            console.log(` Distanz zum lokalen Top ($${stats.maxPrice.toFixed(2)} am ${stats.maxDate}): ${stats.daysToMax} Tage (${stats.pctFromMax.toFixed(2)}%)`);
            console.log(` Distanz zum lokalen Bottom ($${stats.minPrice.toFixed(2)} am ${stats.minDate}): ${stats.daysToMin} Tage (+${stats.pctFromMin.toFixed(2)}%)`);
        });

    } catch (e) {
        console.error("Fehler:", e);
    } finally {
        await expert.close();
    }
}

run();
