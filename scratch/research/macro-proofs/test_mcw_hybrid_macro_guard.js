import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { FiscalFedLiquidityIndicator } from '../../../src/analysis/indicators/FiscalFedLiquidityIndicator.js';
import { PanicCapitulationIndicator } from '../../../src/analysis/indicators/PanicCapitulationIndicator.js';
import { runMuzzledCathieWoodSimulation } from '../../architecture/strategies/MuzzledCathieWoodSimulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
    console.log("=========================================================================================================");
    console.log("   CRASHRADAR RESEARCH: SYSTEMISCHER MATRIX-TEST ALLER MAKRO-KOMBINATIONEN AUF MCW (2020 - 2026)");
    console.log("=========================================================================================================\n");

    console.log("[1/4] Lade tägliche Makro-Timeline aus TiDB Cloud...");
    const fe = new FinanceExpert();
    const timeline = await fe.getDailyGroupedData('2019-01-01', { bypassMemoryGuard: true });
    await fe.close();
    console.log(`- ${timeline.length} Handelstage geladen (${timeline[0].date} bis ${timeline[timeline.length - 1].date}).\n`);

    const panicInd = new PanicCapitulationIndicator();

    // Wöchentliche NetLiq Reihe
    console.log("[2/4] Berechne Makro-Reihen...");
    const weeklyNetLiq = [];
    for (let i = 0; i < timeline.length; i++) {
        const day = timeline[i];
        const nl = day.macroGroups?.NetLiquidity;
        if (nl && nl.WALCL !== undefined && nl.TGA !== undefined && nl.RRPONTSYD !== undefined) {
            const dObj = new Date(day.date);
            if (dObj.getDay() === 4 || weeklyNetLiq.length === 0) {
                const val = nl.WALCL - nl.TGA - nl.RRPONTSYD;
                weeklyNetLiq.push({ date: day.date, netLiq: val });
            }
        }
    }

    function generateSignals(config) {
        const signals = {};
        let isGuardActive = false;

        for (let i = 0; i < timeline.length; i++) {
            const date = timeline[i].date;
            if (date < '2020-01-01') continue;

            // A. NetLiq 8W Delta
            const pastWeekly = weeklyNetLiq.filter(w => w.date <= date);
            let delta8w = null;
            if (pastWeekly.length >= 9) {
                const cur = pastWeekly[pastWeekly.length - 1].netLiq;
                const past8 = pastWeekly[pastWeekly.length - 9].netLiq;
                delta8w = ((cur - past8) / Math.abs(past8)) * 100;
            }

            const isNetLiqRed = delta8w !== null && delta8w < -5.0;
            const isNetLiqGreen = delta8w !== null && delta8w >= 0.0;

            // B. FiscalFed Emergency Borrowing Delta (28 Tage)
            let isBorrowRed = false;
            let borrowDeltaMio = 0;
            if (config.useBorrowing && i >= 28) {
                const curBorrow = timeline[i].macroGroups?.BankingHealth?.EmergencyBorrowing;
                const targetD = new Date(new Date(date).getTime() - 28 * 86400000).toISOString().split('T')[0];
                let pastBorrow = null;
                for (let j = i; j >= 0; j--) {
                    if (timeline[j].date <= targetD) {
                        pastBorrow = timeline[j].macroGroups?.BankingHealth?.EmergencyBorrowing;
                        break;
                    }
                }
                if (curBorrow !== undefined && pastBorrow !== undefined && curBorrow !== null && pastBorrow !== null) {
                    borrowDeltaMio = curBorrow - pastBorrow;
                    if (borrowDeltaMio > 15000) {
                        isBorrowRed = true;
                    }
                }
            }

            // C. Panic Capitulation Sniper
            let isPanicSniperGreen = false;
            if (config.useSniper && isGuardActive && i >= 90) {
                const slice = timeline.slice(0, i + 1);
                const panicRes = panicInd.evaluate(slice);
                if (panicRes && panicRes.status === 'CRITICAL') {
                    isPanicSniperGreen = true;
                }
            }

            // State machine
            let dayRed = false;
            let dayGreen = false;
            let trigDetail = null;
            let recDetail = null;

            if (!isGuardActive) {
                if (isBorrowRed) {
                    isGuardActive = true;
                    dayRed = true;
                    trigDetail = `FiscalFed Notkredite-Spike (+${(borrowDeltaMio / 1000).toFixed(1)}B)`;
                } else if (isNetLiqRed) {
                    isGuardActive = true;
                    dayRed = true;
                    trigDetail = `NetLiq-Delta ${delta8w ? delta8w.toFixed(2) : '0'}% < -5%`;
                }
            } else {
                if (isPanicSniperGreen) {
                    isGuardActive = false;
                    dayGreen = true;
                    recDetail = `Panik-Kapitulation Climax (VIX Panik-Boden)`;
                } else if (isNetLiqGreen && !isBorrowRed) {
                    isGuardActive = false;
                    dayGreen = true;
                    recDetail = `NetLiq-Delta ${delta8w ? delta8w.toFixed(2) : '0'}% >= 0%`;
                }
            }

            signals[date] = {
                isRed: dayRed,
                isGreen: dayGreen,
                triggerDetail: trigDetail,
                recoveryDetail: recDetail
            };
        }
        return signals;
    }

    const sigBaseline = null; // native in script
    const sigSniperOnly = generateSignals({ useBorrowing: false, useSniper: true });
    const sigBorrowOnly = generateSignals({ useBorrowing: true, useSniper: false });
    const sigFullHybrid = generateSignals({ useBorrowing: true, useSniper: true });

    console.log("[3/4] Führe Simulationen für 4 Konfigurationen durch...\n");

    const resBaseline = await runMuzzledCathieWoodSimulation({ silent: true });
    const resSniper = await runMuzzledCathieWoodSimulation({ silent: true, customMacroSignals: sigSniperOnly });
    const resBorrow = await runMuzzledCathieWoodSimulation({ silent: true, customMacroSignals: sigBorrowOnly });
    const resHybrid = await runMuzzledCathieWoodSimulation({ silent: true, customMacroSignals: sigFullHybrid });

    console.log("[4/4] Matrix-Ergebnisse:\n");
    console.log("=".repeat(118));
    console.log("MATRIX-VERGLEICH: MAKRO-GUARD VARIANTEN AUF MUZZLED CATHIE WOOD (2020 - 2026):");
    console.log("=".repeat(118));
    console.log(
        "Konfiguration".padEnd(46) + " | " +
        "Endwert (€)".padStart(14) + " | " +
        "Nettogewinn (€)".padStart(16) + " | " +
        "Rendite".padStart(12) + " | " +
        "Max DD".padStart(10)
    );
    console.log("-".repeat(118));

    const rows = [
        { name: "1. Baseline (Nur Druckenmiller 8W NetLiq)", res: resBaseline },
        { name: "2. NetLiq + Panic Sniper (Re-Entry)", res: resSniper },
        { name: "3. NetLiq + FiscalFed Notkredite (Exit)", res: resBorrow },
        { name: "4. Full Hybrid (NetLiq + Fiscal + Sniper)", res: resHybrid }
    ];

    for (const row of rows) {
        console.log(
            row.name.padEnd(46) + " | " +
            ("€ " + row.res.totalPortfolioEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).padStart(14) + " | " +
            ("€ " + row.res.netProfitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).padStart(16) + " | " +
            ("+" + row.res.returnPct.toFixed(2) + " %").padStart(12) + " | " +
            ("-" + row.res.maxDrawdownPct.toFixed(2) + " %").padStart(10)
        );
    }
    console.log("=".repeat(118) + "\n");
}

main().catch(console.error);
