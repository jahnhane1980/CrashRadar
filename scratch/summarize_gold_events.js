import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { GoldVolumeClimaxIndicator } from '../src/analysis/indicators/GoldVolumeClimaxIndicator.js';
import { GoldCapitulationIndicator } from '../src/analysis/indicators/GoldCapitulationIndicator.js';
import { GdxGoldDivergenceIndicator } from '../src/analysis/indicators/GdxGoldDivergenceIndicator.js';
import { GdxSellingClimaxIndicator } from '../src/analysis/indicators/GdxSellingClimaxIndicator.js';
import { GdxBuyingClimaxIndicator } from '../src/analysis/indicators/GdxBuyingClimaxIndicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    const expert = new FinanceExpert();
    try {
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

        const keySignals = [];

        for (let i = 0; i < dates.length; i++) {
            const dateStr = dates[i];
            const currentDay = groupedData[dateStr];
            timeline.push(currentDay);

            if (timeline.length < 50) continue;

            for (const ind of indicators) {
                const res = ind.evaluate(timeline);
                // Collect CRITICAL and GDX Divergence signals
                if (res && res.status === 'CRITICAL' || (res && res.status === 'WARNING' && ind.name.includes('Divergenz'))) {
                    keySignals.push({
                        date: dateStr,
                        dateIdx: i,
                        indicator: ind.name,
                        status: res.status,
                        value: res.value,
                        message: res.message,
                        goldPrice: currentDay.assets?.Gold,
                        gdxPrice: currentDay.assets?.GDX
                    });
                }
            }
        }

        console.log("=== ZUSAMMENFASSUNG ALLER KAUF- UND VERKAUFSSIGNALE FÜR GOLD/GDX (2015-2026) ===");
        
        // Group consecutive signals of the same type within 7 days
        const distinctEvents = [];
        let currentEvent = null;

        keySignals.forEach(sig => {
            if (!currentEvent || sig.indicator !== currentEvent.indicator || (sig.dateIdx - currentEvent.lastIdx > 14)) {
                // Calculate distance to peak / trough in 90 day window
                const evDateIdx = sig.dateIdx;
                const windowDays = 90;
                const start = Math.max(0, evDateIdx - windowDays);
                const end = Math.min(dates.length - 1, evDateIdx + windowDays);

                let maxPrice = -Infinity, maxDate = null, maxIdx = null;
                let minPrice = Infinity, minDate = null, minIdx = null;

                for (let j = start; j <= end; j++) {
                    const p = groupedData[dates[j]]?.assets?.Gold;
                    if (p) {
                        if (p > maxPrice) { maxPrice = p; maxDate = dates[j]; maxIdx = j; }
                        if (p < minPrice) { minPrice = p; minDate = dates[j]; minIdx = j; }
                    }
                }

                const daysToMax = maxIdx - evDateIdx;
                const daysToMin = minIdx - evDateIdx;
                const currentPrice = sig.goldPrice;
                const pctFromMax = currentPrice && maxPrice ? ((currentPrice - maxPrice) / maxPrice) * 100 : 0;
                const pctFromMin = currentPrice && minPrice ? ((currentPrice - minPrice) / minPrice) * 100 : 0;

                currentEvent = {
                    firstDate: sig.date,
                    lastIdx: sig.dateIdx,
                    indicator: sig.indicator,
                    status: sig.status,
                    message: sig.message,
                    goldPrice: sig.goldPrice,
                    gdxPrice: sig.gdxPrice,
                    stats: { maxPrice, maxDate, daysToMax, pctFromMax, minPrice, minDate, daysToMin, pctFromMin }
                };
                distinctEvents.push(currentEvent);
            } else {
                currentEvent.lastIdx = sig.dateIdx;
            }
        });

        distinctEvents.forEach((ev, i) => {
            console.log(`\n[${i+1}] Datum: ${ev.firstDate} | Typ: ${ev.indicator} (${ev.status})`);
            console.log(`    Gold: $${ev.goldPrice?.toFixed(2)} | GDX: ${ev.gdxPrice ? '$' + ev.gdxPrice.toFixed(2) : 'N/A'}`);
            console.log(`    Message: "${ev.message}"`);
            console.log(`    -> Echter Bottom: $${ev.stats.minPrice.toFixed(2)} am ${ev.stats.minDate} (${Math.abs(ev.stats.daysToMin)} Tage ${ev.stats.daysToMin <= 0 ? 'VORHER' : 'SPÄTER'}, Preis-Abweichung: +${ev.stats.pctFromMin.toFixed(2)}%)`);
            console.log(`    -> Echte Top-Spitze: $${ev.stats.maxPrice.toFixed(2)} am ${ev.stats.maxDate} (${Math.abs(ev.stats.daysToMax)} Tage ${ev.stats.daysToMax <= 0 ? 'VORHER' : 'SPÄTER'}, Preis-Abweichung: ${ev.stats.pctFromMax.toFixed(2)}%)`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await expert.close();
    }
}

run();
