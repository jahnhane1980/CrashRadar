import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, 'data_cache');
const MASTER_DATA_PATH = path.join(CACHE_DIR, 'parsed_fundamentals_master.json');
const MACRO_MATRIX_PATH = path.join(CACHE_DIR, 'macro_regime_daily.json');

// Technical Indicators
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

function findSwingLows(quotes, window = 7) {
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

function getKnownFundamentalsAtDate(financials, date) {
    if (!financials || financials.length === 0) return null;
    const known = financials
        .filter(f => f.filing_date && f.filing_date <= date)
        .sort((a, b) => a.filing_date.localeCompare(b.filing_date));
    return known.length > 0 ? known[known.length - 1] : null;
}

function runSimulation(modelType = 'BASELINE') {
    const masterData = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, 'utf8'));
    const macroMatrix = JSON.parse(fs.readFileSync(MACRO_MATRIX_PATH, 'utf8'));
    const growthTickers = ['HIMS', 'IBRX', 'NVTS', 'S', 'SOFI', 'PLTR', 'APP', 'NET'];

    const allTrades = [];

    for (const ticker of growthTickers) {
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
        const volSma50 = calculateSMA(volumes, 50);
        const swingLows = findSwingLows(quotes, 7);

        // ATH Memory
        let curAth = quotes[0].high;
        let curAthIdx = 0;
        const athHistory = [];

        for (let i = 0; i < quotes.length; i++) {
            if (quotes[i].high > curAth) {
                curAth = quotes[i].high;
                curAthIdx = i;
            }
            athHistory.push({ ath: curAth, athIdx: curAthIdx });
        }

        let inPosition = null;
        let activeSetup = null;
        let lastExitIdx = -999;
        let currentWave = 1;

        for (let i = 60; i < quotes.length - 1; i++) {
            const q = quotes[i];
            const d = q.date;
            const close = q.close;
            const s50 = sma50[i];
            const e20 = ema20[i];
            const vS50 = volSma50[i];
            const rvol = vS50 ? q.volume / vS50 : 1.0;

            const { ath, athIdx } = athHistory[i];
            const daysSinceAth = i - athIdx;
            const ddFromAth = ((close - ath) / ath) * 100;

            // Known confirmed swing lows up to day i (5 days confirmation lag)
            const confirmedLows = swingLows.filter(sl => sl.idx <= (i - 5));

            // =============================================================
            // 1. POSITION MANAGEMENT & EXITS
            // =============================================================
            if (inPosition) {
                const p = inPosition;
                const holdingDays = Math.round((new Date(d) - new Date(p.entryDate)) / (1000 * 60 * 60 * 24));
                const pnlPct = ((close - p.entryPrice) / p.entryPrice) * 100;
                if (close > p.maxPrice) p.maxPrice = close;
                if (close < p.minPrice) p.minPrice = close;

                let exitReason = null;

                // A. Upper Climax / Squeeze Guardrail (Parabolik-Notbremse)
                const distSma50 = s50 ? ((close - s50) / s50) * 100 : 0;
                const dailyRange = q.high - q.low;
                const upperWick = q.high - Math.max(q.open, q.close);
                const isExhaustionCandle = dailyRange > 0 && (upperWick / dailyRange >= 0.40 || close < (q.high + q.low) / 2);

                if (distSma50 >= 65.0 && (rvol >= 3.0 || distSma50 >= 110.0) && isExhaustionCandle && pnlPct >= 50.0) {
                    exitReason = `PARABOLIK-NOTBREMSE: Distanz SMA50 = +${distSma50.toFixed(0)}%, RVOL = ${rvol.toFixed(1)}x, Climax-Wick`;
                }

                // B. Fundamental Thesis Stop
                const fundNow = getKnownFundamentalsAtDate(info.financials, d);
                if (!exitReason && fundNow) {
                    if (!fundNow.founder_sponsor_backed && fundNow.fcf < 0 && fundNow.runway_months < 3.0) {
                        exitReason = `Thesis-Stop: Cash Runway auf ${fundNow.runway_months}m geschmolzen`;
                    }
                }

                // C. Structural Floor Stop (Under initial Base L1)
                if (!exitReason && close < p.panicLowL1 * 0.95) {
                    exitReason = `Strukturbruch: Kurs fällt unter Panik-Tief L1 ($${p.panicLowL1.toFixed(2)})`;
                }

                if (!exitReason) {
                    if (modelType === 'BASELINE') {
                        // Baseline: Trend-Erschöpfung via fallenden SMA50
                        const prevSma50 = sma50[i - 10];
                        const isSma50Falling = s50 && prevSma50 && s50 < prevSma50;
                        if (holdingDays >= 45 && s50 && close < s50 * 0.96 && isSma50Falling && pnlPct >= 20.0) {
                            exitReason = `Trend-Erschöpfung: Bruch unter fallenden 50-Tage-SMA`;
                        }
                    } else {
                        // ENHANCED: Parabolic Trendline Fan & Higher-Low Trailing Stop
                        // Track Higher Lows formed AFTER entry
                        const lowsInTrade = confirmedLows.filter(sl => sl.idx > p.entryIdx);
                        if (lowsInTrade.length > 0) {
                            const latestLow = lowsInTrade[lowsInTrade.length - 1];
                            if (latestLow.low > p.lastHigherLow.low) {
                                p.anchorLow1 = p.lastHigherLow;
                                p.anchorLow2 = latestLow;
                                p.activeLineSlope = (latestLow.low - p.anchorLow1.low) / Math.max(1, (latestLow.idx - p.anchorLow1.idx));
                                p.lastHigherLow = latestLow;
                            }
                        }

                        if (p.anchorLow1 && p.anchorLow2 && p.activeLineSlope > 0) {
                            const daysSinceAnchor = i - p.anchorLow2.idx;
                            const currentLineVal = p.anchorLow2.low + (p.activeLineSlope * daysSinceAnchor);

                            const isTrendlineBroken = (close < currentLineVal * 0.97) && (daysSinceAnchor >= 5);
                            const isLastLowBroken = (close < p.lastHigherLow.low * 0.97);

                            // Only trigger trendline exit if trade has developed or broken structural HL
                            if ((isTrendlineBroken || isLastLowBroken) && holdingDays >= 30 && pnlPct >= 15.0) {
                                exitReason = `TRENDLINIEN-FÄCHER BRUCH: Close $${close.toFixed(2)} < Line $${currentLineVal.toFixed(2)} / HL $${p.lastHigherLow.low.toFixed(2)}`;
                            }
                        }
                    }
                }

                if (exitReason) {
                    allTrades.push({
                        ticker,
                        category: info.profile.category,
                        wave: p.wave,
                        entryDate: p.entryDate,
                        entryPrice: p.entryPrice,
                        exitDate: d,
                        exitPrice: close,
                        maxGainSeen: parseFloat((((p.maxPrice - p.entryPrice) / p.entryPrice) * 100).toFixed(1)),
                        pnlPct: parseFloat(pnlPct.toFixed(1)),
                        holdingDays,
                        reason: exitReason
                    });

                    lastExitIdx = i;
                    inPosition = null;
                    activeSetup = null;
                    currentWave = p.wave + 1;
                }
                continue;
            }

            // =============================================================
            // 2. ENTRY RADAR (BASE-RESET & EVENT-PIVOT)
            // =============================================================
            const isMatureHangover = (daysSinceAth >= 140 && ddFromAth <= -50.0);
            const isBaseReset = (currentWave > 1 && (i - lastExitIdx) >= 30);

            if (!activeSetup && (isMatureHangover || isBaseReset)) {
                // Event or Selling Climax trigger
                const isVolumeSurge = rvol >= 2.5;
                const isSharpSellout = (i >= 5 && (closes[i] - closes[i-5]) / closes[i-5] <= -0.15);

                if (isVolumeSurge || isSharpSellout || isBaseReset) {
                    activeSetup = {
                        crashDate: d,
                        crashIdx: i,
                        panicLowL1: q.low,
                        panicLowIdx: i,
                        reboundPeak: q.high,
                        higherLowL2: null,
                        higherLowIdx: null,
                        eventPivotDetected: isVolumeSurge,
                        phase: 'SELLING_CLIMAX',
                        avwap: calculateAnchoredVWAP(quotes, i),
                        wave: currentWave
                    };
                }
            }

            if (activeSetup) {
                const s = activeSetup;
                const daysSinceCrash = i - s.crashIdx;

                if (q.low < s.panicLowL1 && daysSinceCrash <= 20) {
                    s.panicLowL1 = q.low;
                    s.panicLowIdx = i;
                    s.avwap = calculateAnchoredVWAP(quotes, i);
                }

                if (q.high > s.reboundPeak) s.reboundPeak = q.high;
                const reboundGain = ((s.reboundPeak - s.panicLowL1) / s.panicLowL1) * 100;

                // Phase 3: Higher-Low Retest
                const minConsolidationDays = (modelType === 'ENHANCED' && s.eventPivotDetected) ? 12 : 20;

                if (daysSinceCrash >= minConsolidationDays && reboundGain >= 6.0) {
                    const isAboveL1 = q.low >= s.panicLowL1 * 1.01;
                    const prevLow = lows[i - 1];
                    const isTurningUp = q.close > q.open && q.close > prevLow;

                    if (isAboveL1 && isTurningUp && !s.higherLowL2) {
                        s.higherLowL2 = q.low;
                        s.higherLowIdx = i;
                        s.phase = 'HIGHER_LOW_CONFIRMED';
                    }
                }

                // ENTRY TRIGGER
                const requiredBaseDays = (modelType === 'ENHANCED' && s.eventPivotDetected) ? 15 : 25;

                if (s.phase === 'HIGHER_LOW_CONFIRMED' && daysSinceCrash >= requiredBaseDays) {
                    const curAvwap = s.avwap[i];
                    const curEma20 = ema20[i];

                    const isAboveAvwap = curAvwap && close > curAvwap;
                    const isAboveEma20 = curEma20 && close > curEma20;
                    const isMacroSafe = !macroMatrix[d]?.isCrisisHedged;

                    if (isAboveAvwap && isAboveEma20 && isMacroSafe) {
                        const fund = getKnownFundamentalsAtDate(info.financials, d);
                        let airbagApproved = false;

                        if (fund) {
                            const isPositiveFcf = fund.fcf >= 0;
                            const isRunwayOk = fund.runway_months >= 12.0 || (fund.founder_sponsor_backed && fund.runway_months >= 3.0);
                            const isDeleveraging = fund.deleveraging || fund.total_debt === 0;
                            const isMarginOk = fund.gross_margin_pct >= 55.0;

                            if ((isPositiveFcf || isRunwayOk) && isDeleveraging && isMarginOk) {
                                airbagApproved = true;
                            }
                        } else {
                            airbagApproved = true;
                        }

                        if (airbagApproved) {
                            // Find anchor swing low for trendline
                            const priorLows = confirmedLows.filter(sl => sl.idx <= i);
                            const lastLow = priorLows.length > 0 ? priorLows[priorLows.length - 1] : { idx: s.panicLowIdx, low: s.panicLowL1, date: s.crashDate };
                            const prevLow = priorLows.length > 1 ? priorLows[priorLows.length - 2] : lastLow;

                            inPosition = {
                                ticker,
                                wave: s.wave,
                                entryDate: d,
                                entryPrice: close,
                                entryIdx: i,
                                maxPrice: close,
                                minPrice: close,
                                panicLowL1: s.panicLowL1,
                                higherLowL2: s.higherLowL2,
                                anchorLow1: prevLow,
                                anchorLow2: lastLow,
                                lastHigherLow: lastLow,
                                activeLineSlope: (lastLow.idx > prevLow.idx) ? (lastLow.low - prevLow.low) / (lastLow.idx - prevLow.idx) : 0
                            };
                        }
                    }
                }

                // Invalidate setup if too old or broken
                if (daysSinceCrash > 180 || (q.low < s.panicLowL1 * 0.90 && daysSinceCrash > 30)) {
                    activeSetup = null;
                }
            }
        }
    }

    return allTrades;
}

function calculateMetrics(trades) {
    let totalGain = 0;
    let winCount = 0;
    let winSum = 0;
    let lossSum = 0;
    let totalHold = 0;

    for (const t of trades) {
        totalGain += t.pnlPct;
        if (t.pnlPct > 0) {
            winCount++;
            winSum += t.pnlPct;
        } else {
            lossSum += Math.abs(t.pnlPct);
        }
        totalHold += t.holdingDays;
    }

    const count = trades.length;
    const wr = count > 0 ? (winCount / count) * 100 : 0;
    const avgPnl = count > 0 ? totalGain / count : 0;
    const pf = lossSum > 0 ? (winSum / lossSum) : 999;
    const avgHold = count > 0 ? totalHold / count : 0;

    return { count, winCount, lossCount: count - winCount, wr, avgPnl, pf, avgHold, totalGain };
}

async function main() {
    console.log("================================================================================");
    console.log("   EMPIRISCHER SYSTEM-VERGLEICH: BASELINE VS. EVENT-PIVOT & TRENDLINIEN-FÄCHER");
    console.log("   Test-Universum: HIMS, IBRX, NVTS, S, SOFI, PLTR, APP, NET");
    console.log("================================================================================\n");

    const baselineTrades = runSimulation('BASELINE');
    const enhancedTrades = runSimulation('ENHANCED');

    const mBase = calculateMetrics(baselineTrades);
    const mEnh = calculateMetrics(enhancedTrades);

    console.log("--------------------------------------------------------------------------------");
    console.log("1. MAKRO-KENNZAHLEN VERGLEICH");
    console.log("--------------------------------------------------------------------------------");
    console.log(`METRIK                          | BASELINE (Bisher)    | ENHANCED (Neu: Fächer + Pivot)`);
    console.log(`--------------------------------+----------------------+--------------------------------`);
    console.log(`Gesamt-Trades                   | ${mBase.count.toString().padEnd(20)} | ${mEnh.count.toString().padEnd(30)}`);
    console.log(`Trefferquote (Win Rate)         | ${mBase.wr.toFixed(1)} % (${mBase.winCount}W / ${mBase.lossCount}L)     | ${mEnh.wr.toFixed(1)} % (${mEnh.winCount}W / ${mEnh.lossCount}L)`);
    console.log(`Durchschnittsrendite / Trade    | +${mBase.avgPnl.toFixed(1)} %             | +${mEnh.avgPnl.toFixed(1)} %`);
    console.log(`Profit Factor                   | ${mBase.pf.toFixed(2).padEnd(20)} | ${mEnh.pf.toFixed(2).padEnd(30)}`);
    console.log(`Mittlere Haltedauer             | ${mBase.avgHold.toFixed(0)} Tage (~${(mBase.avgHold/30).toFixed(1)} Mo.)   | ${mEnh.avgHold.toFixed(0)} Tage (~${(mEnh.avgHold/30).toFixed(1)} Mo.)`);
    console.log(`Summierte Gesamtrendite         | +${mBase.totalGain.toFixed(1)} %          | +${mEnh.totalGain.toFixed(1)} %`);
    console.log("--------------------------------------------------------------------------------\n");

    console.log("--------------------------------------------------------------------------------");
    console.log("2. DETAIL-VERGLEICH DER TRADES (ENHANCED)");
    console.log("--------------------------------------------------------------------------------");
    console.table(enhancedTrades.map(t => ({
        Ticker: t.ticker,
        Welle: `Boom ${t.wave}`,
        Kauf: `${t.entryDate} ($${t.entryPrice.toFixed(2)})`,
        Verkauf: `${t.exitDate} ($${t.exitPrice.toFixed(2)})`,
        Rendite: `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(1)} %`,
        MaxRitt: `+${t.maxGainSeen.toFixed(0)} %`,
        Dauer: `${t.holdingDays}d`,
        Grund: t.reason.substring(0, 38)
    })));

    // Save for deep analysis
    fs.writeFileSync(path.join(CACHE_DIR, 'comparison_enhanced_trades.json'), JSON.stringify(enhancedTrades, null, 2));
    fs.writeFileSync(path.join(CACHE_DIR, 'comparison_baseline_trades.json'), JSON.stringify(baselineTrades, null, 2));
}

main().catch(console.error);
