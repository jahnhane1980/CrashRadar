import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { MathUtils } from '../src/utils/MathUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    const expert = new FinanceExpert();
    try {
        console.log("=== Analyse: Unterscheidungsmerkmale der Gold-Liquidationswellen 2022 ===");
        const groupedArray = await expert.getDailyGroupedData('2021-06-01', { bypassMemoryGuard: true });
        
        const groupedData = {};
        groupedArray.forEach(item => {
            groupedData[item.date] = item;
        });

        const dates = Object.keys(groupedData).sort();

        // 4 Key Tiefpunkt-Phasen in 2022
        const keyPhases = [
            { name: "Welle 1 (Mai 2022 Tief)", date: "2022-05-18" },
            { name: "Welle 2 (Juli 2022 Tief)", date: "2022-07-20" },
            { name: "Welle 3 (September 2022 Final Bottom)", date: "2022-09-26" },
            { name: "Welle 4 (Oktober 2022 Double Bottom Retest)", date: "2022-10-21" }
        ];

        keyPhases.forEach(phase => {
            const pIdx = dates.indexOf(phase.date);
            if (pIdx === -1) return;

            const item = groupedData[phase.date];
            const timelineSlice = dates.slice(0, pIdx + 1).map(d => groupedData[d]);

            // Metrics
            const goldPrice = item.assets.Gold;
            const goldVol = item.assets.Gold_Volume;
            const gdxPrice = item.assets.GDX;
            const gdxVol = item.assets.GDX_Volume;
            const spyPrice = item.assets.SPY;
            const vix = item.assets.VIX;
            const dxy = item.macroGroups.FinancialConditions.DXY;
            const realYield = item.macroGroups.FinancialConditions.RealYield10y;
            const marginDebt = item.macroGroups.Leading.MarginDebt;

            // Average Volumes
            const avgGoldVol = MathUtils.getAverageForSlice(timelineSlice, t => t.assets.Gold_Volume, 50);
            const goldVolRatio = avgGoldVol ? (goldVol / avgGoldVol) : null;

            const avgGdxVol = MathUtils.getAverageForSlice(timelineSlice, t => t.assets.GDX_Volume, 50);
            const gdxVolRatio = avgGdxVol ? (gdxVol / avgGdxVol) : null;

            // GDX / Gold Ratio
            const gdxGoldRatio = (gdxPrice && goldPrice) ? (gdxPrice / goldPrice) : null;

            // 20-day price changes
            const prev20Date = dates[pIdx - 20];
            const prev20Gold = groupedData[prev20Date]?.assets?.Gold;
            const goldRoc20 = prev20Gold ? ((goldPrice - prev20Gold) / prev20Gold) * 100 : null;

            const prev20Dxy = groupedData[prev20Date]?.macroGroups?.FinancialConditions?.DXY;
            const dxyRoc20 = prev20Dxy ? ((dxy - prev20Dxy) / prev20Dxy) * 100 : null;

            console.log(`\n================================================================================`);
            console.log(`${phase.name} - Datum: ${phase.date}`);
            console.log(`================================================================================`);
            console.log(`Gold Price:         $${goldPrice?.toFixed(2)} (20-Tage ROC: ${goldRoc20?.toFixed(2)}%)`);
            console.log(`Gold Volume:        ${goldVol} (${goldVolRatio?.toFixed(2)}x 50-Tage Schnitt)`);
            console.log(`GDX Price:          $${gdxPrice?.toFixed(2)} | GDX/Gold Ratio: ${gdxGoldRatio?.toFixed(4)}`);
            console.log(`GDX Volume:         ${gdxVol} (${gdxVolRatio?.toFixed(2)}x 50-Tage Schnitt)`);
            console.log(`SPY Price:          $${spyPrice?.toFixed(2)} | VIX: ${vix?.toFixed(2)}`);
            console.log(`Dollar Index (DXY): ${dxy?.toFixed(2)} (20-Tage ROC: ${dxyRoc20?.toFixed(2)}%)`);
            console.log(`Real Yield (DFII10): ${realYield?.toFixed(2)}%`);
            console.log(`Margin Debt:        $${marginDebt} Mio.`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await expert.close();
    }
}

run();
