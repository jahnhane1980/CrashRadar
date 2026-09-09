import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, 'data_cache');
const MASTER_DATA_PATH = path.join(CACHE_DIR, 'parsed_fundamentals_master.json');
const MACRO_MATRIX_PATH = path.join(CACHE_DIR, 'macro_regime_daily.json');

// Technical Indicator Helpers
function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = [];
    let prev = null;
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            ema.push(null);
        } else if (i === period - 1) {
            let sum = 0;
            for (let j = 0; j < period; j++) sum += prices[i - j];
            prev = sum / period;
            ema.push(prev);
        } else {
            const val = (prices[i] * k) + (prev * (1 - k));
            ema.push(val);
            prev = val;
        }
    }
    return ema;
}

function calculateSMA(prices, period) {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            sma.push(null);
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) sum += prices[i - j];
            sma.push(sum / period);
        }
    }
    return sma;
}

function calculateAnchoredVWAP(quotes, anchorIdx) {
    const avwap = new Array(quotes.length).fill(null);
    let cumVol = 0;
    let cumDollar = 0;
    for (let i = anchorIdx; i < quotes.length; i++) {
        const q = quotes[i];
        const typ = (q.high + q.low + q.close) / 3;
        cumVol += q.volume;
        cumDollar += typ * q.volume;
        avwap[i] = cumVol > 0 ? cumDollar / cumVol : q.close;
    }
    return avwap;
}

function getKnownFundamentalsAtDate(financials, date) {
    if (!financials || financials.length === 0) return null;
    const known = financials
        .filter(f => f.filing_date && f.filing_date <= date)
        .sort((a, b) => a.filing_date.localeCompare(b.filing_date));
    return known.length > 0 ? known[known.length - 1] : null;
}

function simulateUniverse(masterData, macroMatrix, options = {}) {
    const { useMacroKatastrophenMatrix = false, enforceGrossMargin = true } = options;
    const tickers = Object.keys(masterData);
    const allTrades = [];
    let macroBlockedEntries = 0;
    let fundamentalAirbagRejections = 0;

    for (const ticker of tickers) {
        const info = masterData[ticker];
        const pricesFile = path.join(CACHE_DIR, `${ticker}_daily.json`);
        if (!fs.existsSync(pricesFile)) continue;
        const quotes = JSON.parse(fs.readFileSync(pricesFile, 'utf8'));
        if (quotes.length < 150) continue;

        const closes = quotes.map(q => q.close);
        const volumes = quotes.map(q => q.volume);
        const highs = quotes.map(q => q.high);
        const lows = quotes.map(q => q.low);

        const ema20 = calculateEMA(closes, 20);
        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200);
        const volSma50 = calculateSMA(volumes, 50);

        // Precompute 252-day Rolling High
        const rollingHigh252 = [];
        for (let i = 0; i < quotes.length; i++) {
            const start = Math.max(0, i - 252);
            const slice = highs.slice(start, i + 1);
            rollingHigh252.push(Math.max(...slice));
        }

        let inPosition = null;
        let activeSetup = null;

        for (let i = 60; i < quotes.length - 1; i++) {
            const q = quotes[i];
            const d = q.date;
            const close = q.close;
            const high252 = rollingHigh252[i];
            const ddFromHigh = ((close - high252) / high252) * 100;
            const rvol = volSma50[i] ? q.volume / volSma50[i] : 1.0;

            // -------------------------------------------------------------
            // 1. POSITION MANAGEMENT (If already invested)
            // -------------------------------------------------------------
            if (inPosition) {
                const p = inPosition;
                const holdingDays = Math.round((new Date(d) - new Date(p.entryDate)) / (1000 * 60 * 60 * 24));
                const pnlPct = ((close - p.entryPrice) / p.entryPrice) * 100;
                if (close > p.maxPrice) p.maxPrice = close;
                if (close < p.minPrice) p.minPrice = close;

                let exitReason = null;

                // A. Teil-Exit 1: Target reached (Fib 38.2% - 50% or SMA200 or Gap-Close)
                if (!p.partialExitDone && (close >= p.target1Price || (sma200[i] && close >= sma200[i] && pnlPct >= 20))) {
                    p.partialExitDone = true;
                    p.partialExitDate = d;
                    p.partialExitPrice = close;
                    p.partialPnlPct = pnlPct;
                }

                // B. Fundamentaler Thesis-Stop Check
                const fundNow = getKnownFundamentalsAtDate(info.financials, d);
                if (fundNow) {
                    if (!fundNow.founder_sponsor_backed && fundNow.fcf < 0 && fundNow.runway_months < 3.0) {
                        exitReason = `Thesis-Stop: Net Cash Runway auf ${fundNow.runway_months}m geschmolzen`;
                    } else if (fundNow.gross_margin_pct < 45.0 && info.profile.category !== 'MEGA_CAP') {
                        exitReason = `Thesis-Stop: Bruttomarge auf ${fundNow.gross_margin_pct.toFixed(0)}% kollabiert`;
                    }
                }

                // C. Strukturbruch: Kurs fällt signifikant unter Panik-Tief L1 (-5%)
                if (!exitReason && close < p.panicLowL1 * 0.95) {
                    exitReason = `Strukturbruch: Kurs fällt unter Panik-Tief L1 ($${p.panicLowL1.toFixed(2)})`;
                }

                // D. Full Trend-Exit / Parabolic Climax
                if (!exitReason) {
                    const distEma20 = ema20[i] ? ((close - ema20[i]) / ema20[i]) * 100 : 0;
                    if (distEma20 >= 40.0 && pnlPct >= 50.0) {
                        exitReason = `Parabolic Climax: Distanz EMA 20 = +${distEma20.toFixed(1)}%`;
                    } else if (p.partialExitDone && sma50[i] && close < sma50[i] && pnlPct >= 25.0) {
                        exitReason = `Trend-Exit nach Teilgewinn: Schluss unter 50-Tage-SMA`;
                    }
                }

                if (exitReason) {
                    const finalPnlPct = p.partialExitDone
                        ? (p.partialPnlPct * 0.5) + (pnlPct * 0.5)
                        : pnlPct;

                    allTrades.push({
                        ticker,
                        category: info.profile.category,
                        entryDate: p.entryDate,
                        entryPrice: p.entryPrice,
                        exitDate: d,
                        exitPrice: close,
                        partialExitPrice: p.partialExitDone ? p.partialExitPrice : null,
                        pnlPct: parseFloat(finalPnlPct.toFixed(1)),
                        holdingDays,
                        reason: exitReason,
                        airbag: p.airbagDetails
                    });

                    inPosition = null;
                    activeSetup = null;
                }
                continue;
            }

            // -------------------------------------------------------------
            // 2. TURNAROUND RADAR: SCANNING & TIMING
            // -------------------------------------------------------------
            // Setup-Trigger: Stock experiences major crash (DD <= -38% from high)
            if (!activeSetup && ddFromHigh <= -38.0) {
                if (rvol >= 2.2 || (i >= 5 && (closes[i] - closes[i-5]) / closes[i-5] <= -0.15)) {
                    activeSetup = {
                        crashDate: d,
                        crashIdx: i,
                        panicLowL1: q.low,
                        panicLowIdx: i,
                        reboundPeak: q.high,
                        higherLowL2: null,
                        higherLowIdx: null,
                        phase: 'SELLING_CLIMAX',
                        avwap: calculateAnchoredVWAP(quotes, i)
                    };
                }
            }

            if (activeSetup) {
                const s = activeSetup;
                const daysSinceCrash = i - s.crashIdx;

                if (q.low < s.panicLowL1 && daysSinceCrash <= 15) {
                    s.panicLowL1 = q.low;
                    s.panicLowIdx = i;
                    s.avwap = calculateAnchoredVWAP(quotes, i);
                }

                if (q.high > s.reboundPeak) {
                    s.reboundPeak = q.high;
                }
                const reboundGain = ((s.reboundPeak - s.panicLowL1) / s.panicLowL1) * 100;

                if (daysSinceCrash >= 18 && reboundGain >= 8.0) {
                    const isAboveL1 = q.low >= s.panicLowL1 * 0.99;
                    const prevLow = lows[i - 1];
                    const isTurningUp = q.close > q.open && q.close > prevLow;

                    if (isAboveL1 && isTurningUp && !s.higherLowL2) {
                        s.higherLowL2 = q.low;
                        s.higherLowIdx = i;
                        s.phase = 'HIGHER_LOW_TEST';
                    }
                }

                // Check Entry Trigger
                if (s.phase === 'HIGHER_LOW_TEST' && daysSinceCrash >= 20) {
                    const curAvwap = s.avwap[i];
                    const curEma20 = ema20[i];

                    const isAboveAvwap = curAvwap && close > curAvwap;
                    const isAboveEma20 = curEma20 && close > curEma20;

                    if (isAboveAvwap && isAboveEma20) {
                        // 1. MAKRO-KATASTROPHEN-MATRIX CHECK (Aus Investment-Signaldienst.md)
                        if (useMacroKatastrophenMatrix && macroMatrix[d]?.isCrisisHedged) {
                            macroBlockedEntries++;
                            continue; // Blocked: Makro-Notfall-Schutzschirm aktiv!
                        }

                        // 2. FUNDAMENTAL AIRBAG CHECK
                        const fund = getKnownFundamentalsAtDate(info.financials, d);
                        let airbagApproved = false;
                        let airbagNotes = [];

                        if (fund) {
                            const isPositiveFcf = fund.fcf >= 0;
                            const isRunwayOk = fund.runway_months >= 12.0 || (fund.founder_sponsor_backed && fund.runway_months >= 3.0);
                            const isDeleveraging = fund.deleveraging || fund.total_debt === 0;
                            const isMarginOk = !enforceGrossMargin || fund.gross_margin_pct >= 55.0 || info.profile.category === 'MEGA_CAP';

                            if ((isPositiveFcf || isRunwayOk) && isDeleveraging && isMarginOk) {
                                airbagApproved = true;
                                airbagNotes.push(`Runway: ${isPositiveFcf ? 'FCF+' : fund.runway_months + 'm'}`);
                                airbagNotes.push(`Debt: ${fund.total_debt === 0 ? 'Zero-Debt' : 'Deleveraging'}`);
                                if (fund.gross_margin_pct) airbagNotes.push(`Margin: ${fund.gross_margin_pct.toFixed(0)}%`);
                                if (fund.founder_sponsor_backed) airbagNotes.push('Founder-Backed');
                            } else {
                                fundamentalAirbagRejections++;
                            }
                        } else {
                            airbagApproved = true;
                            airbagNotes.push('Technical-Base (Early Era)');
                        }

                        if (airbagApproved) {
                            const crashDrop = high252 - s.panicLowL1;
                            const fib38 = s.panicLowL1 + (crashDrop * 0.382);
                            const target1 = Math.max(fib38, close * 1.25);

                            inPosition = {
                                ticker,
                                entryDate: d,
                                entryPrice: close,
                                maxPrice: close,
                                minPrice: close,
                                panicLowL1: s.panicLowL1,
                                higherLowL2: s.higherLowL2 || s.panicLowL1,
                                target1Price: target1,
                                partialExitDone: false,
                                partialExitDate: null,
                                partialExitPrice: null,
                                partialPnlPct: null,
                                airbagDetails: airbagNotes.join(' | ')
                            };
                        }
                    }
                }

                if (daysSinceCrash > 150 || (q.low < s.panicLowL1 * 0.90 && daysSinceCrash > 25)) {
                    activeSetup = null;
                }
            }
        }
    }

    return { allTrades, macroBlockedEntries, fundamentalAirbagRejections };
}

function calculateStats(trades) {
    let totalGain = 0;
    let winCount = 0;
    let totalHoldDays = 0;
    let winGain = 0;
    let lossLoss = 0;

    for (const t of trades) {
        totalGain += t.pnlPct;
        if (t.pnlPct > 0) {
            winCount++;
            winGain += t.pnlPct;
        } else {
            lossLoss += Math.abs(t.pnlPct);
        }
        totalHoldDays += t.holdingDays;
    }

    const count = trades.length;
    const avgPnl = count > 0 ? totalGain / count : 0;
    const winRate = count > 0 ? (winCount / count) * 100 : 0;
    const avgHold = count > 0 ? totalHoldDays / count : 0;
    const profitFactor = lossLoss > 0 ? winGain / lossLoss : winGain > 0 ? 999 : 0;

    return { count, winCount, lossCount: count - winCount, winRate, avgPnl, avgHold, profitFactor };
}

async function runComparativeAnalysis() {
    console.log("================================================================================");
    console.log("   TURNAROUND-RADAR: EMPIRISCHER VERGLEICH (MIT VS. OHNE MAKRO-KATASTROPHEN-MATRIX)");
    console.log("   Universum: 19 Ticker (5 Mega-Caps, 7 Growth/Biotech/Fintech, 6 Failed/Crashed Hyped Stocks)");
    console.log("================================================================================\n");

    const masterData = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, 'utf8'));
    const macroMatrix = fs.existsSync(MACRO_MATRIX_PATH) ? JSON.parse(fs.readFileSync(MACRO_MATRIX_PATH, 'utf8')) : {};

    // PASS 1: Baseline (Ohne Makro-Filter)
    console.log("[RUN 1] Berechne Baseline (OHNE Makro-Sperre)...");
    const res1 = simulateUniverse(masterData, macroMatrix, { useMacroKatastrophenMatrix: false });
    const stats1 = calculateStats(res1.allTrades);

    // PASS 2: Mit 3-Säulen-Katastrophen-Matrix
    console.log("[RUN 2] Berechne mit 3-Säulen-Katastrophen-Matrix Makro-Sperre...");
    const res2 = simulateUniverse(masterData, macroMatrix, { useMacroKatastrophenMatrix: true });
    const stats2 = calculateStats(res2.allTrades);

    console.log("\n================================================================================");
    console.log("   VERGLEICHS-STATISTIK: AUSWIRKUNG DER 3-SÄULEN-KATASTROPHEN-MATRIX");
    console.log("================================================================================");

    console.table([
        {
            Metrik: 'Gesamt-Trades',
            'Ohne Makrosperre': stats1.count,
            'Mit Katastrophen-Matrix': stats2.count,
            Delta: `${stats2.count - stats1.count} Trades (-${(((stats1.count - stats2.count)/stats1.count)*100).toFixed(1)}%)`
        },
        {
            Metrik: 'Gewinner / Verlierer',
            'Ohne Makrosperre': `${stats1.winCount} W / ${stats1.lossCount} L`,
            'Mit Katastrophen-Matrix': `${stats2.winCount} W / ${stats2.lossCount} L`,
            Delta: `+${(stats2.winRate - stats1.winRate).toFixed(1)}% WR`
        },
        {
            Metrik: 'Trefferquote (Win Rate)',
            'Ohne Makrosperre': `${stats1.winRate.toFixed(1)} %`,
            'Mit Katastrophen-Matrix': `${stats2.winRate.toFixed(1)} %`,
            Delta: `+${(stats2.winRate - stats1.winRate).toFixed(1)} %-Punkte`
        },
        {
            Metrik: 'Durchschnittsrendite / Trade',
            'Ohne Makrosperre': `${stats1.avgPnl >= 0 ? '+' : ''}${stats1.avgPnl.toFixed(1)} %`,
            'Mit Katastrophen-Matrix': `${stats2.avgPnl >= 0 ? '+' : ''}${stats2.avgPnl.toFixed(1)} %`,
            Delta: `${stats2.avgPnl >= stats1.avgPnl ? '+' : ''}${(stats2.avgPnl - stats1.avgPnl).toFixed(1)} %`
        },
        {
            Metrik: 'Profit Factor',
            'Ohne Makrosperre': stats1.profitFactor.toFixed(2),
            'Mit Katastrophen-Matrix': stats2.profitFactor.toFixed(2),
            Delta: `${stats2.profitFactor >= stats1.profitFactor ? '+' : ''}${(stats2.profitFactor - stats1.profitFactor).toFixed(2)}`
        },
        {
            Metrik: 'Blockierte Bärenmarkt-Einstiege',
            'Ohne Makrosperre': '0',
            'Mit Katastrophen-Matrix': `${res2.macroBlockedEntries} Signale gesperrt`,
            Delta: 'Voller Bärenmarkt-Schutz'
        }
    ]);

    // Breakdown by Category for PASS 2
    console.log("\n--- DETAIL-PERFORMANCE NACH KATEGORIEN (MIT KATASTROPHEN-MATRIX) ---");
    const byCat = {};
    for (const t of res2.allTrades) {
        byCat[t.category] = byCat[t.category] || [];
        byCat[t.category].push(t);
    }
    for (const [cat, tr] of Object.entries(byCat)) {
        const st = calculateStats(tr);
        console.log(`${cat.padEnd(18)}: ${String(st.count).padStart(2)} Trades | Win: ${st.winRate.toFixed(1).padStart(5)}% | Ø PnL: ${(st.avgPnl >= 0 ? '+' : '') + st.avgPnl.toFixed(1).padStart(5)}% | PF: ${st.profitFactor.toFixed(2).padStart(5)}`);
    }

    // Performance for FAILED_GROWTH candidates specifically
    console.log("\n--- WAS PASSIERTE MIT DEN GEHYPTEN CRASH-KANDIDATEN (FAILED_GROWTH)? ---");
    const failedTrades = res2.allTrades.filter(t => t.category === 'FAILED_GROWTH');
    if (failedTrades.length === 0) {
        console.log("-> Perfekt: ALLE gescheiterten Hype-Werte (PTON, TDOC, BYND, SPCE, UPST, FSLY) wurden durch den fundamentalen Airbag (Cash Runway / Debt / Margin) oder die Makrosperre vollständig eliminiert!");
    } else {
        console.log(`Es wurden ${failedTrades.length} Trades zugelassen:`);
        console.table(failedTrades.map(t => ({
            Ticker: t.ticker,
            Kauf: t.entryDate,
            Verkauf: t.exitDate,
            PnL: `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct}%`,
            Grund: t.reason.substring(0, 40)
        })));
    }

    fs.writeFileSync(path.join(CACHE_DIR, 'simulation_trades_baseline.json'), JSON.stringify(res1.allTrades, null, 2));
    fs.writeFileSync(path.join(CACHE_DIR, 'simulation_trades_with_macro.json'), JSON.stringify(res2.allTrades, null, 2));
}

export { simulateUniverse, runComparativeAnalysis };
runComparativeAnalysis().catch(console.error);
