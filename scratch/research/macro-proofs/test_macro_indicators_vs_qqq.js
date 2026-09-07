import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { FiscalFedLiquidityIndicator } from '../../../src/analysis/indicators/FiscalFedLiquidityIndicator.js';
import { DalioTwoStageRegimeIndicator } from '../../../src/analysis/indicators/DalioTwoStageRegimeIndicator.js';
import { TreasuryCapacityRadarIndicator } from '../../../src/analysis/indicators/TreasuryCapacityRadarIndicator.js';
import { PanicCapitulationIndicator } from '../../../src/analysis/indicators/PanicCapitulationIndicator.js';
import { RedAlertIndicator } from '../../../src/analysis/indicators/RedAlertIndicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
    console.log("=========================================================================================================");
    console.log("   CRASHRADAR RESEARCH: EMPIRISCHER AUDIT ALLER MAKRO-INDIKATOREN VS. QQQ (2020 - 2026)");
    console.log("=========================================================================================================\n");

    // 1. Lade aggregierte Timeline aus TiDB Cloud
    console.log("[1/4] Lade tägliche Makro-Timeline ab 2019 via FinanceExpert...");
    const fe = new FinanceExpert();
    const timeline = await fe.getDailyGroupedData('2019-01-01', { bypassMemoryGuard: true });
    await fe.close();
    console.log(`- ${timeline.length} Handelstage geladen (${timeline[0].date} bis ${timeline[timeline.length - 1].date}).\n`);

    // 2. Lade QQQ & GLD Kurse aus Cache
    console.log("[2/4] Lade Benchmark-Kurse (QQQ, GLD, EURUSD)...");
    const cacheDir = fs.existsSync(path.resolve(__dirname, '../../trash/cache'))
        ? path.resolve(__dirname, '../../trash/cache')
        : path.resolve(__dirname, '../architecture/strategies/cache');
    
    const qqqQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'QQQ_2019-01-01_2026-09-06.json'), 'utf8'));
    const gldQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'GLD_2019-01-01_2026-09-06.json'), 'utf8'));
    const fxQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'EURUSD=X_2019-01-01_2026-09-06.json'), 'utf8'));

    const qqqMap = {};
    for (const q of qqqQuotes) qqqMap[q.date] = q.close;
    const gldMap = {};
    for (const q of gldQuotes) gldMap[q.date] = q.close;
    const fxMap = {};
    for (const q of fxQuotes) fxMap[q.date] = q.close;

    // Filter Handelszeitraum ab 2020-01-01 bis 2026-09-04
    const tradingDates = qqqQuotes
        .map(q => q.date)
        .filter(d => d >= '2020-01-01' && d <= '2026-09-04');

    // Instanziiere Indikatoren
    const fiscalFedInd = new FiscalFedLiquidityIndicator();
    const dalioInd = new DalioTwoStageRegimeIndicator();
    const treasuryInd = new TreasuryCapacityRadarIndicator();
    const panicInd = new PanicCapitulationIndicator();
    const redAlertInd = new RedAlertIndicator();

    // Map Timeline nach Datum
    const dateToTimelineIdx = {};
    for (let i = 0; i < timeline.length; i++) {
        dateToTimelineIdx[timeline[i].date] = i;
    }

    console.log(`- ${tradingDates.length} Handelstage im Backtest-Fenster.\n`);

    // =========================================================================
    // 3. Definition der Signal-Generatoren
    // =========================================================================
    // Jeder Generator liefert pro Tag: { isRed: boolean, signalName: string, detail: string }

    // Indikator A: Druckenmiller Net Fed Liquidity 8W-Delta (< -5% / >= 0%)
    function getDruckenmillerSignals() {
        const signals = {};
        let active = false;

        // Erstelle wöchentliche NetLiq Reihe
        const weekly = [];
        for (let i = 0; i < timeline.length; i++) {
            const day = timeline[i];
            const nl = day.macroGroups?.NetLiquidity;
            if (nl && nl.WALCL !== undefined && nl.TGA !== undefined && nl.RRPONTSYD !== undefined) {
                // Nur Donnerstags oder alle 5 Tage
                const dObj = new Date(day.date);
                if (dObj.getDay() === 4 || weekly.length === 0) {
                    const netLiq = nl.WALCL - nl.TGA - nl.RRPONTSYD;
                    weekly.push({ date: day.date, netLiq });
                }
            }
        }

        for (const date of tradingDates) {
            // Finde jüngstes 8W Delta vor diesem Tag
            const knownWeekly = weekly.filter(w => w.date <= date);
            let delta8w = null;
            if (knownWeekly.length >= 9) {
                const cur = knownWeekly[knownWeekly.length - 1].netLiq;
                const past = knownWeekly[knownWeekly.length - 9].netLiq;
                delta8w = ((cur - past) / Math.abs(past)) * 100;
            }

            if (!active && delta8w !== null && delta8w < -5.0) {
                active = true;
            } else if (active && delta8w !== null && delta8w >= 0.0) {
                active = false;
            }

            signals[date] = { isRed: active, detail: delta8w !== null ? `${delta8w.toFixed(1)}%` : 'N/A' };
        }
        return signals;
    }

    // Indikator B: FiscalFedLiquidityIndicator (CRITICAL = ROT, NORMAL = GRÜN)
    function getFiscalFedSignals() {
        const signals = {};
        let active = false;

        for (const date of tradingDates) {
            const idx = dateToTimelineIdx[date];
            if (idx === undefined || idx < 90) {
                signals[date] = { isRed: false, detail: 'Init' };
                continue;
            }

            const slice = timeline.slice(0, idx + 1);
            const res = fiscalFedInd.evaluate(slice);
            
            // Alarm bei Phase 2 (Drain) oder Phase 3 (Kapitulation)
            if (res.status === 'CRITICAL' || (res.status === 'WARNING' && res.message && res.message.includes('Phase 2'))) {
                active = true;
            } else if (res.status === 'NORMAL' || (res.message && res.message.includes('Phase 4'))) {
                active = false;
            }

            signals[date] = { isRed: active, detail: res.message || res.status };
        }
        return signals;
    }

    // Indikator C: Dalio Two-Stage Regime (Stufe 2 Kipppunkt = ROT, Stabile Phase = GRÜN)
    function getDalioSignals() {
        const signals = {};
        let active = false;

        for (const date of tradingDates) {
            const idx = dateToTimelineIdx[date];
            if (idx === undefined || idx < 5) {
                signals[date] = { isRed: false, detail: 'Init' };
                continue;
            }

            const slice = timeline.slice(0, idx + 1);
            const res = dalioInd.evaluate(slice);

            if (res.status === 'CRITICAL') {
                active = true;
            } else if (res.status === 'OK') {
                active = false;
            }

            signals[date] = { isRed: active, detail: res.message || res.status };
        }
        return signals;
    }

    // Indikator D: Treasury Capacity Radar (TTC < 30 Tage = ROT, TTC > 90 Tage = GRÜN)
    function getTreasuryCapacitySignals() {
        const signals = {};
        let active = false;

        for (const date of tradingDates) {
            const idx = dateToTimelineIdx[date];
            if (idx === undefined || idx < 21) {
                signals[date] = { isRed: false, detail: 'Init' };
                continue;
            }

            const slice = timeline.slice(0, idx + 1);
            const res = treasuryInd.evaluate(slice);

            if (res.status === 'CRITICAL') {
                active = true;
            } else if (res.status === 'NORMAL' || res.status === 'OK') {
                active = false;
            }

            signals[date] = { isRed: active, detail: res.message || res.status };
        }
        return signals;
    }

    // Indikator E: Red Alert (SKEW + Short Volume Capitulation)
    function getRedAlertSignals() {
        const signals = {};
        let active = false;
        let alarmCooldown = 0;

        for (const date of tradingDates) {
            const idx = dateToTimelineIdx[date];
            if (idx === undefined || idx < 1) {
                signals[date] = { isRed: false, detail: 'Init' };
                continue;
            }

            const slice = timeline.slice(0, idx + 1);
            const res = redAlertInd.evaluate(slice);

            if (res.status === 'CRITICAL') {
                active = true;
                alarmCooldown = 30; // 30 Tage Schutzschirm
            } else if (alarmCooldown > 0) {
                alarmCooldown--;
                if (alarmCooldown === 0) active = false;
            } else {
                active = false;
            }

            signals[date] = { isRed: active, detail: res.message || res.status };
        }
        return signals;
    }

    // Indikator F: Panic Capitulation Sniper (Boden-Finder)
    function getPanicSignals() {
        const triggers = {};
        for (const date of tradingDates) {
            const idx = dateToTimelineIdx[date];
            if (idx === undefined || idx < 14) continue;
            const slice = timeline.slice(0, idx + 1);
            const res = panicInd.evaluate(slice);
            if (res.status === 'CRITICAL') {
                triggers[date] = res.message || 'Kapitulation';
            }
        }
        return triggers;
    }

    console.log("[3/4] Berechne historische Signal-Verläufe...");
    const signalsDruck = getDruckenmillerSignals();
    const signalsFiscal = getFiscalFedSignals();
    const signalsDalio = getDalioSignals();
    const signalsTreasury = getTreasuryCapacitySignals();
    const signalsRedAlert = getRedAlertSignals();
    const panicTriggers = getPanicSignals();

    // =========================================================================
    // 4. Backtest-Engine für QQQ mit 50% Gold / 50% Cash Notfall-Hedge
    // =========================================================================
    function backtestStrategy(name, signals) {
        let eurInvested = 10000;
        let lastEurUsd = fxMap[tradingDates[0]] || 1.12;
        let qqqShares = (10000 * lastEurUsd) / qqqMap[tradingDates[0]];
        let gldShares = 0;
        let usdCash = 0;
        let isHedged = false;

        let lastMonth = tradingDates[0].substring(0, 7);
        let peakValueEUR = 10000;
        let maxDrawdown = 0;

        let hedgeCount = 0;
        let totalHedgeDays = 0;
        let falseAlarmDays = 0; // Hedged während QQQ steigt

        for (let i = 0; i < tradingDates.length; i++) {
            const d = tradingDates[i];
            const curEurUsd = fxMap[d] || lastEurUsd;
            lastEurUsd = curEurUsd;
            const curQqq = qqqMap[d];
            const curGld = gldMap[d];

            // Monatlicher Sparplan 150 €
            const curMonth = d.substring(0, 7);
            if (curMonth !== lastMonth) {
                lastMonth = curMonth;
                eurInvested += 150;
                const addUSD = 150 * curEurUsd;
                if (isHedged) {
                    usdCash += addUSD * 0.50;
                    gldShares += (addUSD * 0.50) / curGld;
                } else {
                    qqqShares += addUSD / curQqq;
                }
            }

            const sig = signals ? signals[d] : { isRed: false };

            // Evakuierung bei ROT
            if (!isHedged && sig.isRed) {
                isHedged = true;
                hedgeCount++;
                const qqqVal = qqqShares * curQqq;
                qqqShares = 0;
                gldShares += (qqqVal * 0.50) / curGld;
                usdCash += qqqVal * 0.50;
            }
            // Re-Entry bei GRÜN
            else if (isHedged && !sig.isRed) {
                isHedged = false;
                const recoveryUSD = (gldShares * curGld) + usdCash;
                gldShares = 0;
                usdCash = 0;
                qqqShares = recoveryUSD / curQqq;
            }

            if (isHedged) totalHedgeDays++;

            // Prüfe Falschalarm: Ist der Markt nach 20 Tagen höher als beim Einstieg?
            if (isHedged && i + 20 < tradingDates.length) {
                const futureQqq = qqqMap[tradingDates[i + 20]];
                if (futureQqq > curQqq * 1.03) falseAlarmDays++;
            }

            // Depotwert heute
            const currentDepotUSD = (qqqShares * curQqq) + (gldShares * curGld) + usdCash;
            const currentDepotEUR = currentDepotUSD / curEurUsd;

            if (currentDepotEUR > peakValueEUR) peakValueEUR = currentDepotEUR;
            const dd = ((peakValueEUR - currentDepotEUR) / peakValueEUR) * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }

        const finalUSD = (qqqShares * qqqMap[tradingDates[tradingDates.length - 1]]) + (gldShares * gldMap[tradingDates[tradingDates.length - 1]]) + usdCash;
        const finalEUR = finalUSD / lastEurUsd;
        const retPct = ((finalEUR - eurInvested) / eurInvested) * 100;

        return {
            name,
            finalEUR,
            retPct,
            maxDrawdown,
            hedgeCount,
            totalHedgeDays,
            falseAlarmDays
        };
    }

    console.log("[4/4] Führe vergleichenden Backtest auf QQQ durch (2020 - 2026)...\n");

    const resBnH = backtestStrategy("1. QQQ Buy & Hold (Reines Halten ohne Schutz)", null);
    const resDruck = backtestStrategy("2. Druckenmiller NetLiq (8W-Delta < -5% / >= 0%)", signalsDruck);
    const resFiscal = backtestStrategy("3. FiscalFedLiquidityIndicator (Plumbing)", signalsFiscal);
    const resDalio = backtestStrategy("4. DalioTwoStageRegimeIndicator (Stufe 2)", signalsDalio);
    const resTreasury = backtestStrategy("5. TreasuryCapacityRadarIndicator (TTC)", signalsTreasury);
    const resRedAlert = backtestStrategy("6. RedAlertIndicator (SKEW / Short-Ratio)", signalsRedAlert);

    const allRes = [resBnH, resDruck, resFiscal, resDalio, resTreasury, resRedAlert];

    console.log("=".repeat(125));
    console.log("VERGLEICH DER INDIKATOREN AUF QQQ (2020 - 2026 | 10.000 € Start + 150 €/M | 50% Gold / 50% Cash Schutz):");
    console.log("=".repeat(125));
    console.log(
        "Indikator / Strategie".padEnd(48) + " | " +
        "Endwert (€)".padStart(12) + " | " +
        "Rendite".padStart(10) + " | " +
        "Max DD".padStart(8) + " | " +
        "Alarme".padStart(7) + " | " +
        "Tage Hedge".padStart(11) + " | " +
        "Falschalarm-Tage"
    );
    console.log("-".repeat(125));

    for (const r of allRes) {
        console.log(
            r.name.padEnd(48) + " | " +
            ("€ " + r.finalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).padStart(12) + " | " +
            ("+" + r.retPct.toFixed(2) + " %").padStart(10) + " | " +
            ("-" + r.maxDrawdown.toFixed(1) + " %").padStart(8) + " | " +
            String(r.hedgeCount).padStart(7) + " | " +
            String(r.totalHedgeDays).padStart(11) + " | " +
            String(r.falseAlarmDays).padStart(12)
        );
    }
    console.log("=".repeat(125) + "\n");

    // Detail-Audits der Krisen-Phasen
    console.log("---------------------------------------------------------------------------------------------------------");
    console.log("KRISEN-CHRONIK & DETEKTION DURCH DIE EINZELNEN INDIKATOREN:");
    console.log("---------------------------------------------------------------------------------------------------------");

    const crises = [
        { name: "Corona-Crash 2020", start: "2020-02-15", end: "2020-04-15" },
        { name: "2021 Top & Tech-Meltup", start: "2021-10-01", end: "2022-01-15" },
        { name: "2022 Zinsschock & Bärenmarkt", start: "2022-01-01", end: "2022-11-01" },
        { name: "2023 SVB-Bankenkrise", start: "2023-03-01", end: "2023-04-15" },
        { name: "2023 Herbst-Zinsangst (10Y @ 5%)", start: "2023-08-01", end: "2023-11-01" },
        { name: "2024 Sommer-Dip (Yen Carry)", start: "2024-07-15", end: "2024-08-15" }
    ];

    for (const c of crises) {
        console.log(`\n>>> Krise: ${c.name} (${c.start} bis ${c.end})`);
        
        const druckTrigger = tradingDates.filter(d => d >= c.start && d <= c.end && signalsDruck[d]?.isRed);
        const fiscalTrigger = tradingDates.filter(d => d >= c.start && d <= c.end && signalsFiscal[d]?.isRed);
        const dalioTrigger = tradingDates.filter(d => d >= c.start && d <= c.end && signalsDalio[d]?.isRed);
        const treasuryTrigger = tradingDates.filter(d => d >= c.start && d <= c.end && signalsTreasury[d]?.isRed);
        const redAlertTrigger = tradingDates.filter(d => d >= c.start && d <= c.end && signalsRedAlert[d]?.isRed);
        const panicHits = Object.keys(panicTriggers).filter(d => d >= c.start && d <= c.end);

        console.log(`  * Druckenmiller (8W-NetLiq): ${druckTrigger.length > 0 ? 'ROT ab ' + druckTrigger[0] + ' (' + druckTrigger.length + ' Tage)' : 'NICHT AUSGELÖST'}`);
        console.log(`  * FiscalFedLiquidity:        ${fiscalTrigger.length > 0 ? 'ROT ab ' + fiscalTrigger[0] + ' (' + fiscalTrigger.length + ' Tage)' : 'NICHT AUSGELÖST'}`);
        console.log(`  * Dalio 2-Stage:             ${dalioTrigger.length > 0 ? 'ROT ab ' + dalioTrigger[0] + ' (' + dalioTrigger.length + ' Tage)' : 'NICHT AUSGELÖST'}`);
        console.log(`  * Treasury Capacity:         ${treasuryTrigger.length > 0 ? 'ROT ab ' + treasuryTrigger[0] + ' (' + treasuryTrigger.length + ' Tage)' : 'NICHT AUSGELÖST'}`);
        console.log(`  * Red Alert:                 ${redAlertTrigger.length > 0 ? 'ROT ab ' + redAlertTrigger[0] + ' (' + redAlertTrigger.length + ' Tage)' : 'NICHT AUSGELÖST'}`);
        console.log(`  * Panic Capitulation:        ${panicHits.length > 0 ? 'BODEN GETROFFEN am: ' + panicHits.join(', ') : 'Keine Panik-Kapitulation'}`);
    }

    console.log("\n=========================================================================================================");
}

main().catch(console.error);
