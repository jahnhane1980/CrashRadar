import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

const MASTER_DATA_PATH = path.join(CACHE_DIR, 'parsed_fundamentals_master.json');
// HINWEIS MAKRO-GUARD: Agiert gemäß Architektur ausschließlich als Einlass-Kontrolle (Kauf-Sperre).
// Laufende Positionen werden NICHT durch Makro-Alarm notverkauft (hätte PLTR 2025 bei $76 statt $157
// und NVTS 2026 bei $8,28 mit Verlust statt $30,84 liquidiert). Trade-Führung obliegt rein der Dip-DNA & Stufe 1/2.
const MACRO_MATRIX_PATH = path.join(CACHE_DIR, 'macro_regime_daily.json');

function calculateSMA(prices, period) {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) sma.push(null);
        else {
            let s = 0;
            for (let j = 0; j < period; j++) s += prices[i - j];
            sma.push(s / period);
        }
    }
    return sma;
}

function findMajorSwingLows(quotes, window = 14) {
    const swingLows = [];
    for (let i = window; i < quotes.length - window; i++) {
        const curLow = quotes[i].low;
        let isLow = true;
        for (let j = 1; j <= window; j++) {
            if (quotes[i - j].low <= curLow || quotes[i + j].low < curLow) {
                isLow = false;
                break;
            }
        }
        if (isLow) {
            swingLows.push({ idx: i, date: quotes[i].date, low: curLow, close: quotes[i].close, high: quotes[i].high });
        }
    }
    return swingLows;
}

function runAdaptivePrototype(enableStufe1 = true) {
    const masterData = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, 'utf8'));
    const favorites = ['PLTR', 'NVTS', 'IBRX', 'SOFI', 'S'];
    const trades = [];

    for (const sym of favorites) {
        const pricesFile = path.join(CACHE_DIR, `${sym}_daily.json`);
        const m5File = path.join(CACHE_DIR, `${sym.toLowerCase()}_m5_rth_aggregated.json`);
        if (!fs.existsSync(pricesFile)) continue;

        const quotes = JSON.parse(fs.readFileSync(pricesFile, 'utf8'));
        const m5Data = fs.existsSync(m5File) ? JSON.parse(fs.readFileSync(m5File, 'utf8')) : [];
        const m5Map = new Map();
        m5Data.forEach(d => m5Map.set(d.date, d));

        const closes = quotes.map(q => q.close);
        const sma50 = calculateSMA(closes, 50);
        const swingLows = findMajorSwingLows(quotes, 14);

        // Pre-defined key entry points based on our verified Event-Pivots
        const testSetups = {
            PLTR: [
                { name: 'Welle 1', entryDate: '2023-04-11', entryPrice: 8.61, baseLow: 7.19, category: 'LARGE_CAP', hasEventCatalyst: true },
                { name: 'Welle 2 (Parabolik-Superrun)', entryDate: '2024-02-26', entryPrice: 23.56, baseLow: 20.33, category: 'LARGE_CAP', hasEventCatalyst: true }
            ],
            NVTS: [
                { name: 'Welle 1 (Squeeze)', entryDate: '2025-05-14', entryPrice: 2.09, baseLow: 1.52, category: 'SMALL_CAP', hasEventCatalyst: true },
                { name: 'Welle 2 (Superrun auf 34$)', entryDate: '2025-12-10', entryPrice: 9.12, baseLow: 6.85, category: 'SMALL_CAP', hasEventCatalyst: true }
            ],
            IBRX: [
                { name: 'ANKTIVA Squeeze', entryDate: '2023-11-17', entryPrice: 4.14, baseLow: 1.69, category: 'SMALL_CAP', hasEventCatalyst: true },
                { name: '2026 Run', entryDate: '2026-02-09', entryPrice: 6.77, baseLow: 5.51, category: 'SMALL_CAP', hasEventCatalyst: true }
            ],
            SOFI: [
                { name: 'Boom 2025/2026', entryDate: '2025-05-14', entryPrice: 14.03, baseLow: 9.24, category: 'LARGE_CAP', hasEventCatalyst: true }
            ],
            S: [
                { name: 'Rebound 2024', entryDate: '2024-07-10', entryPrice: 19.99, baseLow: 16.32, category: 'SMALL_CAP', hasEventCatalyst: false, skimTargetGainPct: 25.0 }
            ]
        };

        const setups = testSetups[sym] || [];

        for (const s of setups) {
            const entryIdx = quotes.findIndex(q => q.date >= s.entryDate);
            if (entryIdx === -1) continue;

            const entryQuote = quotes[entryIdx];
            const t0Price = entryQuote.close;
            let inTrade = {
                symbol: sym,
                setupName: s.name,
                category: s.category,
                hasEventCatalyst: s.hasEventCatalyst,
                skimTargetGainPct: s.skimTargetGainPct || null,
                isSkimmed: false,
                skimPrice: null,
                skimDate: null,
                skimGainPct: 0,
                entryDate: entryQuote.date,
                entryPrice: t0Price,
                entryIdx,
                maxPrice: t0Price,
                maxGainPct: 0,
                baseLow: s.baseLow,
                activeHLStop: s.baseLow,
                currentDipTrough: 0, // Trackt die tiefste Senke im aktuellen unbestätigten Dip
                learnedDipDepthMax: -12.0, // Initialer Puffer vor erstem überstandenen Dip
                learnedHealthyCloseDeltaMin: 0.0,
                dipsLearnedCount: 0,
                exitReason: null,
                exitDate: null,
                exitPrice: null
            };

            for (let i = entryIdx + 1; i < quotes.length; i++) {
                const q = quotes[i];
                const d = q.date;
                const close = q.close;
                const s50 = sma50[i];
                const holdingDays = i - entryIdx;

                const currentGainFromT0 = ((close - t0Price) / t0Price) * 100;
                const ddFromPeak = ((close - inTrade.maxPrice) / inTrade.maxPrice) * 100;

                // -------------------------------------------------------------
                // SONDERFALL: 50% SKIMMING BEI REBOUND OHNE EARNINGS-BEAT
                // -------------------------------------------------------------
                if (!inTrade.hasEventCatalyst && !inTrade.isSkimmed && inTrade.skimTargetGainPct) {
                    if (currentGainFromT0 >= inTrade.skimTargetGainPct) {
                        inTrade.isSkimmed = true;
                        inTrade.skimPrice = close;
                        inTrade.skimDate = d;
                        inTrade.skimGainPct = currentGainFromT0;
                    }
                }

                // -------------------------------------------------------------
                // ABSORPTIONS-BEWEIS: LERNEN NUR BEI BESTÄTIGTEM NEUEN HOCH
                // -------------------------------------------------------------
                if (close > inTrade.maxPrice) {
                    // Falls wir aus einem unbestätigten Dip kommen, wurde er jetzt erfolgreich absorbiert!
                    if (inTrade.currentDipTrough < 0) {
                        if (inTrade.currentDipTrough < inTrade.learnedDipDepthMax) {
                            inTrade.learnedDipDepthMax = inTrade.currentDipTrough; // Modell lernt die überstandene Dip-Tiefe
                        }
                        inTrade.dipsLearnedCount++;
                        inTrade.currentDipTrough = 0; // Dip-Zyklus erfolgreich beendet
                    }
                    inTrade.maxPrice = close;
                    inTrade.maxGainPct = ((close - t0Price) / t0Price) * 100;
                }

                // Check confirmed Higher Lows up to day i (lag = 10)
                const confirmedLows = swingLows.filter(sl => sl.idx <= (i - 10) && sl.idx > entryIdx);
                if (confirmedLows.length > 0) {
                    const latestHL = confirmedLows[confirmedLows.length - 1];
                    if (latestHL.low > inTrade.activeHLStop && inTrade.maxGainPct >= 25.0) {
                        inTrade.activeHLStop = latestHL.low;
                    }
                }

                // -------------------------------------------------------------
                // KATEGORIE-SPEZIFISCHE VOLUMEN-SCHWELLEN (Tabelle 4.3 Master-Plan)
                // -------------------------------------------------------------
                const isLargeCap = inTrade.category === 'LARGE_CAP';
                const healthyVolThreshold = isLargeCap ? 1.05 : 0.70;
                const dumpSingleVolThreshold = isLargeCap ? 1.80 : 2.50;
                const dump3dVolMultiplier = isLargeCap ? 1.35 : 2.00;
                const dumpCloseDeltaThreshold = isLargeCap ? -15.0 : -20.0;
                const dumpPnl3dThreshold = isLargeCap ? -8.0 : -10.0;

                const m5Day = m5Map.get(d);
                const isDip = ddFromPeak <= -10.0;

                // Rollierendes 20-Tage-Vorlauf-Volumen berechnen
                const lookbackStart = Math.max(0, i - 20);
                const lookbackQuotes = quotes.slice(lookbackStart, i);
                const avgDailyVol = lookbackQuotes.reduce((sum, x) => sum + x.volume, 0) / Math.max(1, lookbackQuotes.length);
                const volRatio = avgDailyVol > 0 ? (q.volume / avgDailyVol) : 1.0;

                // -------------------------------------------------------------
                // ADAPTIVES KORREKTUR-TRACKING (Gesunder Dip vs Institutional Dump)
                // -------------------------------------------------------------
                if (isDip) {
                    const isIntradayClean = m5Day ? (m5Day.closeWindow.deltaPct >= -8.0) : true;
                    // Gesunder Dip: Volumen trocknet aus, kein Intraday-Abverkauf in der Power Hour
                    if (volRatio <= healthyVolThreshold && isIntradayClean) {
                        if (ddFromPeak < inTrade.currentDipTrough) {
                            inTrade.currentDipTrough = ddFromPeak; // Trackt das tiefste Tal während des Dips
                        }
                    }
                }

                // -------------------------------------------------------------
                // STUFE 1: DER SMARTE PARABOLIK-EXIT (Sterbende Parabolik)
                // -------------------------------------------------------------
                // A. Climax-Top Überhitzung (Wird JEDEN Tag an der Spitze geprüft!)
                const distSma50 = s50 ? ((close - s50) / s50) * 100 : 0;
                const dailyRange = q.high - q.low;
                const upperWick = q.high - Math.max(q.open, q.close);
                const isExhaustionCandle = dailyRange > 0 && (upperWick / dailyRange >= 0.40 || close < (q.high + q.low) / 2);
                const isClimaxOverheat = enableStufe1 && (distSma50 >= 65.0 && volRatio >= dumpSingleVolThreshold && isExhaustionCandle && inTrade.maxGainPct >= 40.0);

                if (isClimaxOverheat) {
                    inTrade.exitReason = `STUFE 1: Climax-Top Überhitzung (SMA50 +${distSma50.toFixed(0)}%, Vol ${volRatio.toFixed(1)}x, Climax-Wick)`;
                    inTrade.exitDate = d;
                    inTrade.exitPrice = close;
                    break;
                }

                // B. 3D-Bestätigter institutioneller Dump (in reifer Parabolik bei Dips)
                const isMatureParabolic = inTrade.maxGainPct >= 40.0 || distSma50 >= 35.0;
                if (enableStufe1 && isMatureParabolic && isDip) {
                    const closeDelta = m5Day ? m5Day.closeWindow.deltaPct : 0.0;
                    const d3Days = quotes.slice(Math.max(0, i - 2), i + 1);
                    const pnl3d = ((d3Days[d3Days.length - 1].close - d3Days[0].open) / d3Days[0].open) * 100;
                    const vol3d = d3Days.reduce((s, x) => s + x.volume, 0);
                    const is3dVolumeSpike = vol3d >= (avgDailyVol * 3 * 1.35);

                    if ((is3dVolumeSpike && pnl3d <= -8.0 && closeDelta <= -15.0) || 
                        (volRatio >= dumpSingleVolThreshold && closeDelta <= dumpCloseDeltaThreshold && pnl3d <= dumpPnl3dThreshold)) {
                        inTrade.exitReason = `STUFE 1: 3D-Bestätigter Dump (3D-Vol ${vol3d >= 1e6 ? (vol3d/1e6).toFixed(0)+'M' : vol3d}, 3D-PnL ${pnl3d.toFixed(1)}%, CloseDelta ${closeDelta.toFixed(0)}%)`;
                        inTrade.exitDate = d;
                        inTrade.exitPrice = close;
                        break;
                    }
                }

                // -------------------------------------------------------------
                // STUFE 2: EISERNER FALLBACK (Bruch des letzten Major Higher Low)
                // -------------------------------------------------------------
                // Schützt das Kapital ab Tag 1 bei Bruch des Basis-Tiefs (L1 / Pre-Gap Low)
                if (close < inTrade.activeHLStop * 0.97) {
                    inTrade.exitReason = `STUFE 2 (Fallback): Bruch des Major Higher Low ($${inTrade.activeHLStop.toFixed(2)})`;
                    inTrade.exitDate = d;
                    inTrade.exitPrice = close;
                    break;
                }
            }

            if (!inTrade.exitDate) {
                const last = quotes[quotes.length - 1];
                inTrade.exitReason = 'STILL OPEN (End of Data)';
                inTrade.exitDate = last.date;
                inTrade.exitPrice = last.close;
            }

            const finalGainPct = ((inTrade.exitPrice - inTrade.entryPrice) / inTrade.entryPrice) * 100;
            const effectivePnl = inTrade.isSkimmed
                ? (0.5 * inTrade.skimGainPct + 0.5 * finalGainPct)
                : finalGainPct;

            trades.push({
                symbol: inTrade.symbol,
                setup: inTrade.setupName,
                kauf: `${inTrade.entryDate} ($${inTrade.entryPrice.toFixed(2)})`,
                verkauf: `${inTrade.exitDate} ($${inTrade.exitPrice.toFixed(2)})`,
                renditePct: parseFloat(effectivePnl.toFixed(1)),
                maxRittPct: parseFloat(inTrade.maxGainPct.toFixed(1)),
                exitPrice: inTrade.exitPrice,
                maxPrice: inTrade.maxPrice,
                learnedDipMax: `${inTrade.learnedDipDepthMax.toFixed(1)} % (${inTrade.dipsLearnedCount} Dips)`,
                isSkimmed: inTrade.isSkimmed ? `Ja (+${inTrade.skimGainPct.toFixed(1)}% bei $${inTrade.skimPrice.toFixed(2)})` : 'Nein (100% geritten)',
                grund: inTrade.exitReason
            });
        }
    }

    return trades;
}

function main() {
    console.log("================================================================================");
    console.log("   PROTOTYP-TEST: ADAPTIVES KORREKTUR-LERNEN & 2-STUFEN-EXIT");
    console.log("   Test an den Lieblingen: PLTR, NVTS, IBRX, SOFI, S");
    console.log("================================================================================\n");

    console.log("1. TESTLAUF: OHNE STUFE 1 (Nur Stufe 2: Reiner Higher-Low Fallback Stop)");
    const tradesOnlyStufe2 = runAdaptivePrototype(false);
    console.table(tradesOnlyStufe2.map(t => ({
        Ticker: t.symbol,
        Setup: t.setup,
        Kauf: t.kauf,
        Verkauf: t.verkauf,
        Rendite: `${t.renditePct >= 0 ? '+' : ''}${t.renditePct} %`,
        MaxKurs: `$${t.maxPrice.toFixed(2)} (+${t.maxRittPct}%)`,
        ExitGrund: t.grund.substring(0, 48)
    })));

    console.log("\n2. TESTLAUF: MIT STUFE 1 (Adaptiver Parabolik-Exit + Stufe 2 Fallback)");
    const tradesWithStufe1 = runAdaptivePrototype(true);
    console.table(tradesWithStufe1.map(t => ({
        Ticker: t.symbol,
        Setup: t.setup,
        Kauf: t.kauf,
        Verkauf: t.verkauf,
        Rendite: `${t.renditePct >= 0 ? '+' : ''}${t.renditePct} %`,
        DipDNA: t.learnedDipMax,
        Skimming: t.isSkimmed,
        MaxKurs: `$${t.maxPrice.toFixed(2)} (+${t.maxRittPct}%)`,
        ExitGrund: t.grund.substring(0, 48)
    })));

    console.log("\n================================================================================");
    console.log("   DIREKTER VERGLEICH: WAS BRINGT DER 2-STUFEN-EXIT?");
    console.log("================================================================================\n");

    const comparison = tradesOnlyStufe2.map((t2, idx) => {
        const t1 = tradesWithStufe1[idx];
        const diffRendite = t1.renditePct - t2.renditePct;
        const diffDollar = t1.exitPrice - t2.exitPrice;

        return {
            Ticker: t1.symbol,
            Setup: t1.setup,
            'Exit Stufe 2 (HL)': `$${t2.exitPrice.toFixed(2)} (+${t2.renditePct}%)`,
            'Exit Stufe 1 (Adaptiv)': `$${t1.exitPrice.toFixed(2)} (+${t1.renditePct}%)`,
            Mehrertrag: `${diffRendite >= 0 ? '+' : ''}${diffRendite.toFixed(1)} %-Pkt. ($${diffDollar >= 0 ? '+' : ''}${diffDollar.toFixed(2)}/Aktie)`,
            Vorteil: diffRendite > 0 
                ? '🏆 Früher an der Spitze ausgestiegen!' 
                : diffRendite === 0 
                    ? '⚪ Identisch (Fallback griff)' 
                    : '⚠️ Früher ausgestiegen'
        };
    });

    console.table(comparison);
}

main();
