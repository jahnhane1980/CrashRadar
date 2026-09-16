import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, 'data_cache');
const MASTER_DATA_PATH = path.join(CACHE_DIR, 'parsed_fundamentals_master.json');
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

function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = [];
    let prev = null;
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) ema.push(null);
        else if (i === period - 1) {
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

function getKnownFundamentalsAtDate(financials, date) {
    if (!financials || financials.length === 0) return null;
    const known = financials
        .filter(f => f.filing_date && f.filing_date <= date)
        .sort((a, b) => a.filing_date.localeCompare(b.filing_date));
    return known.length > 0 ? known[known.length - 1] : null;
}

function runRefinedGrowthSimulation() {
    const masterData = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, 'utf8'));
    const macroMatrix = JSON.parse(fs.readFileSync(MACRO_MATRIX_PATH, 'utf8'));
    const macroKeys = Object.keys(macroMatrix).sort();
    function getMacroAt(date) {
        if (macroMatrix[date]) return macroMatrix[date];
        // Binary search or reverse find for last date <= date
        let low = 0, high = macroKeys.length - 1;
        let best = null;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (macroKeys[mid] <= date) {
                best = macroKeys[mid];
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return best ? macroMatrix[best] : null;
    }
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
        const swingLows = findMajorSwingLows(quotes, 14);

        // Track ATH
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

            const confirmedLows = swingLows.filter(sl => sl.idx <= (i - 10));

            // =============================================================
            // 1. POSITION MANAGEMENT (RUHIGE HAND & PARABOLIK-NOTBREMSE)
            // =============================================================
            if (inPosition) {
                const p = inPosition;
                const holdingDays = Math.round((new Date(d) - new Date(p.entryDate)) / (1000 * 60 * 60 * 24));
                const pnlPct = ((close - p.entryPrice) / p.entryPrice) * 100;
                if (close > p.maxPrice) p.maxPrice = close;
                if (close < p.minPrice) p.minPrice = close;
                const maxGainSeen = ((p.maxPrice - p.entryPrice) / p.entryPrice) * 100;

                let exitReason = null;

                // A. DIE PARABOLIK-NOTBREMSE (Climax-Wick / Blow-Off Squeeze)
                // Gewaltige Überhitzung (Distanz SMA50 >= +65%), RVOL >= 3.0x und Erschöpfungs-Wick
                const distSma50 = s50 ? ((close - s50) / s50) * 100 : 0;
                const dailyRange = q.high - q.low;
                const upperWick = q.high - Math.max(q.open, q.close);
                const isExhaustionCandle = dailyRange > 0 && (upperWick / dailyRange >= 0.40 || close < (q.high + q.low) / 2);

                if (distSma50 >= 65.0 && (rvol >= 3.0 || distSma50 >= 110.0) && isExhaustionCandle && pnlPct >= 50.0) {
                    exitReason = `PARABOLIK-NOTBREMSE: Distanz SMA50 = +${distSma50.toFixed(0)}%, RVOL = ${rvol.toFixed(1)}x, Climax-Wick`;
                }

                // B. FUNDAMENTALER THESIS-STOP
                const fundNow = getKnownFundamentalsAtDate(info.financials, d);
                if (!exitReason && fundNow) {
                    if (!fundNow.founder_sponsor_backed && fundNow.fcf < 0 && fundNow.runway_months < 3.0) {
                        exitReason = `Thesis-Stop: Cash Runway auf ${fundNow.runway_months}m geschmolzen`;
                    }
                }

                // C. INITIALER STRUKTUR-STOPP (Vor dem Ausbruch)
                // Bis die Position +25% erreicht hat, gilt der Base Low L1 Stop (-5% Puffer)
                if (!exitReason && maxGainSeen < 25.0) {
                    if (close < p.panicLowL1 * 0.95) {
                        exitReason = `Strukturbruch (Initial): Kurs fällt unter Basis-Tief L1 ($${p.panicLowL1.toFixed(2)})`;
                    }
                }

                // D. RUHIGE HAND: MAJOR HIGHER-LOW TRAILING STOP & DYNAMISCHER FÄCHER
                // Sobald die Position +25% im Gewinn war, zieht der Stop hinter die Major Swing Lows nach
                if (!exitReason && maxGainSeen >= 25.0) {
                    const lowsInTrade = confirmedLows.filter(sl => sl.idx > p.entryIdx);
                    if (lowsInTrade.length > 0) {
                        const latestHL = lowsInTrade[lowsInTrade.length - 1];
                        if (latestHL.low > p.activeTrailingStop) {
                            p.activeTrailingStop = latestHL.low;
                            p.trailingStopDate = latestHL.date;
                        }
                    }

                    // Trailing Stop Bruch mit 3% Margin of Safety
                    if (close < p.activeTrailingStop * 0.97 && holdingDays >= 30) {
                        exitReason = `MAJOR HIGHER-LOW BRUCH: Close $${close.toFixed(2)} < HL-Stop $${p.activeTrailingStop.toFixed(2)} (${p.trailingStopDate || 'Initial'})`;
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
                        maxGainSeen: parseFloat(maxGainSeen.toFixed(1)),
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
            // 2. ENTRY RADAR (BASE-RESET & INSTITUTIONAL EVENT-PIVOT)
            // =============================================================
            const isMatureHangover = (daysSinceAth >= 140 && ddFromAth <= -50.0);
            const isBaseReset = (currentWave > 1 && (i - lastExitIdx) >= 30);

            if (!activeSetup && (isMatureHangover || isBaseReset)) {
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

                // Higher Low Retest
                const minConsolidation = s.eventPivotDetected ? 12 : 20;
                if (daysSinceCrash >= minConsolidation && reboundGain >= 6.0) {
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
                const requiredBaseDays = s.eventPivotDetected ? 14 : 25;
                if (s.phase === 'HIGHER_LOW_CONFIRMED' && daysSinceCrash >= requiredBaseDays) {
                    const curAvwap = s.avwap[i];
                    const curEma20 = ema20[i];

                    const isAboveAvwap = curAvwap && close > curAvwap;
                    const isAboveEma20 = curEma20 && close > curEma20;
                    const macroNow = getMacroAt(d);
                    const isMacroSafe = !macroNow?.isCrisisHedged;

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
                                activeTrailingStop: s.panicLowL1,
                                trailingStopDate: s.crashDate
                            };
                        }
                    }
                }

                if (daysSinceCrash > 180 || (q.low < s.panicLowL1 * 0.90 && daysSinceCrash > 30)) {
                    activeSetup = null;
                }
            }
        }
    }

    return allTrades;
}

const trades = runRefinedGrowthSimulation();
console.log(`\n================================================================================`);
console.log(`   REFINED HIGH-BETA GROWTH TEST: MAJOR HIGHER-LOW TRAIL & PARABOLIC CLIMAX`);
console.log(`   Gesamt-Trades: ${trades.length}`);
console.log(`================================================================================\n`);

console.table(trades.map(t => ({
    Ticker: t.ticker,
    Welle: `Boom ${t.wave}`,
    Kauf: `${t.entryDate} ($${t.entryPrice.toFixed(2)})`,
    Verkauf: `${t.exitDate} ($${t.exitPrice.toFixed(2)})`,
    Rendite: `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(1)} %`,
    MaxRitt: `+${t.maxGainSeen.toFixed(0)} %`,
    Dauer: `${t.holdingDays}d`,
    Grund: t.reason.substring(0, 38)
})));

let wins = trades.filter(t => t.pnlPct > 0);
let losses = trades.filter(t => t.pnlPct <= 0);
let winSum = wins.reduce((s, t) => s + t.pnlPct, 0);
let lossSum = losses.reduce((s, t) => s + Math.abs(t.pnlPct), 0);
let totalGain = trades.reduce((s, t) => s + t.pnlPct, 0);
let avgPnl = totalGain / trades.length;
let avgHold = trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length;
let pf = lossSum > 0 ? (winSum / lossSum).toFixed(2) : 'INF';

console.log(`\n📈 KENNZAHLEN (Refined Growth Engine):`);
console.log(`   • Gesamt-Trades:       ${trades.length}`);
console.log(`   • Trefferquote:        ${(wins.length / trades.length * 100).toFixed(1)} % (${wins.length}W / ${losses.length}L)`);
console.log(`   • Durchschnittsrendite:+${avgPnl.toFixed(1)} % pro Trade`);
console.log(`   • Profit Factor:       ${pf}`);
console.log(`   • Mittlere Haltedauer: ${avgHold.toFixed(0)} Tage (~${(avgHold/30).toFixed(1)} Monate)`);
console.log(`   • Summierte Rendite:   +${totalGain.toFixed(1)} %`);

fs.writeFileSync(path.join(CACHE_DIR, 'refined_growth_trades.json'), JSON.stringify(trades, null, 2));
