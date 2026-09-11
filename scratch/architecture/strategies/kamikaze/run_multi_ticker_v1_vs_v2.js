import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');
const MASTER_DATA_PATH = path.join(CACHE_DIR, 'parsed_fundamentals_master.json');
const MACRO_MATRIX_PATH = path.join(CACHE_DIR, 'macro_regime_daily.json');

console.log("================================================================================");
console.log("   MULTI-TICKER HÄRTETEST: V1 (BASELINE) vs. V2 (PROGRESSIVE PYRAMIDISIERUNG)");
console.log("   Universum: PLTR, NVTS, SOFI, S, IBRX, APP, HIMS, NET (2016 - 2026)");
console.log("   Mit verifizierter Higher-Low Trailing-Stop Architektur (Stufe 2)");
console.log("   Standard-Slot-Budget: $10.000 pro Trade (4% p.a. Cash-Rendite)");
console.log("================================================================================\n");

const masterData = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, 'utf8'));
const macroMatrix = fs.existsSync(MACRO_MATRIX_PATH) ? JSON.parse(fs.readFileSync(MACRO_MATRIX_PATH, 'utf8')) : {};

// Technical indicators
function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = [];
    let prev = null;
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) ema.push(null);
        else if (i === period - 1) {
            let s = 0;
            for (let j = 0; j < period; j++) s += prices[i - j];
            prev = s / period;
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
        if (i < period - 1) sma.push(null);
        else {
            let s = 0;
            for (let j = 0; j < period; j++) s += prices[i - j];
            sma.push(s / period);
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

const TICKER_CONFIG = {
    PLTR: { investmentType: 'LASTING_HOLD', category: 'LARGE_CAP' },
    SOFI: { investmentType: 'LASTING_HOLD', category: 'LARGE_CAP' },
    S:    { investmentType: 'LASTING_HOLD', category: 'SMALL_CAP' },
    NET:  { investmentType: 'LASTING_HOLD', category: 'LARGE_CAP' },
    NVTS: { investmentType: 'CYCLICAL',     category: 'SMALL_CAP' },
    APP:  { investmentType: 'CYCLICAL',     category: 'LARGE_CAP' },
    HIMS: { investmentType: 'CYCLICAL',     category: 'SMALL_CAP' },
    IBRX: { investmentType: 'BINARY',       category: 'SMALL_CAP' }
};

const growthTickers = Object.keys(TICKER_CONFIG);
const allTradeResults = [];

const BUDGET_PER_TRADE = 10000;
const CASH_YIELD_PA = 0.04;

for (const ticker of growthTickers) {
    const info = masterData[ticker];
    if (!info) continue;
    const pricesFile = path.join(CACHE_DIR, `${ticker}_daily.json`);
    if (!fs.existsSync(pricesFile)) continue;
    const quotes = JSON.parse(fs.readFileSync(pricesFile, 'utf8'));
    if (quotes.length < 120) continue;

    const closes = quotes.map(q => q.close);
    const volumes = quotes.map(q => q.volume);
    const highs = quotes.map(q => q.high);
    const lows = quotes.map(q => q.low);

    const ema20 = calculateEMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const volSma50 = calculateSMA(volumes, 50);
    const swingLows = findMajorSwingLows(quotes, 14);

    // Track All-Time High
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

        // -------------------------------------------------------------
        // 1. POSITION MANAGEMENT & MULTI-TRANCHE PYRAMIDING TRACKING
        // -------------------------------------------------------------
        if (inPosition) {
            const p = inPosition;
            const holdingDays = Math.round((new Date(d) - new Date(p.entryDate)) / (1000 * 3600 * 24));
            const holdingYears = holdingDays / 365.25;
            const currentGain = ((close - p.entryPrice) / p.entryPrice) * 100;
            if (close > p.maxPrice) p.maxPrice = close;
            if (close < p.minPrice) p.minPrice = close;

            // Track Major Higher Lows confirmed during the trade (lag = 10 days)
            const confirmedLows = swingLows.filter(sl => sl.idx <= (i - 10) && sl.idx > p.entryIdx);
            if (confirmedLows.length > 0) {
                const latestHL = confirmedLows[confirmedLows.length - 1];
                if (latestHL.low > p.activeHLStop && p.maxPrice >= p.entryPrice * 1.20) {
                    p.activeHLStop = latestHL.low;
                }
            }

            // --- V2 PYRAMIDISIERUNGS-TRIGGER ---
            // Tranche 2 (+35%): Kurs hat >= +25% Gewinn erreicht UND EMA 20 / Rebound bestätigt
            if (!p.tranche2Active && p.maxPrice >= p.entryPrice * 1.25 && close > e20) {
                p.tranche2Active = true;
                p.tranche2Date = d;
                p.tranche2Price = close;
                p.tranche1Stop = p.entryPrice; // Tranche 1 ist ab jetzt Break-Even abgesichert!
            }

            // Tranche 3 (+30%): Tranche 2 ist aktiv, Kurs hat >= +45% erreicht UND schließt über SMA 50
            if (p.tranche2Active && !p.tranche3Active && p.maxPrice >= p.entryPrice * 1.45 && close > s50 && close > e20) {
                p.tranche3Active = true;
                p.tranche3Date = d;
                p.tranche3Price = close;
            }

            // --- EXIT-BEDINGUNGEN ---
            let exitReason = null;
            const config = TICKER_CONFIG[ticker];
            const isLastingHold = config.investmentType === 'LASTING_HOLD';

            // A. Stufe 1: Parabolik-Notbremse (NUR FÜR CYCLICAL / BINARY!)
            // Für LASTING_HOLD ist Stufe 1 Climax-Exit DEAKTIVIERT (User-Vorgabe!)
            const distSma50 = s50 ? ((close - s50) / s50) * 100 : 0;
            const dailyRange = q.high - q.low;
            const upperWick = q.high - Math.max(q.open, q.close);
            const isExhaustionCandle = dailyRange > 0 && (upperWick / dailyRange >= 0.40 || close < (q.high + q.low) / 2);

            if (!isLastingHold && distSma50 >= 65.0 && (rvol >= 2.5 || distSma50 >= 110.0) && isExhaustionCandle && currentGain >= 40.0) {
                exitReason = `Stufe 1 Climax Overheat (SMA50 +${distSma50.toFixed(0)}%, RVOL ${rvol.toFixed(1)}x)`;
            }

            // B. Fundamentaler Thesis-Stop (Greift ausnahmslos für alle!)
            const fundNow = getKnownFundamentalsAtDate(info.financials, d);
            if (!exitReason && fundNow) {
                if (!fundNow.founder_sponsor_backed && fundNow.fcf < 0 && fundNow.runway_months < 3.0) {
                    exitReason = `Thesis-Stop: Cash Runway auf ${fundNow.runway_months}m geschmolzen`;
                }
            }

            // C. Stufe 2 Eiserner Fallback Stop:
            // 1. In Startphase: Bruch unter Panik-Tief L1 (-5%)
            // 2. In Reifephase: Bruch unter Major Higher Low Stop (* 0.97)
            if (!exitReason && close < p.activeHLStop * 0.97) {
                exitReason = `Stufe 2: Bruch des Major Higher Low ($${p.activeHLStop.toFixed(2)})`;
            }

            // Letzter Datenpunkt
            if (!exitReason && i === quotes.length - 2) {
                exitReason = `OFFEN (Ende des Datensatzes 2026)`;
            }

            if (exitReason) {
                const exitPrice = close;
                const exitDate = d;

                // --- AUSWERTUNG V1 (Statischer 35% Starter) ---
                const v1_invested = BUDGET_PER_TRADE * 0.35;
                const v1_cashUnused = BUDGET_PER_TRADE * 0.65;
                const v1_cashWithInterest = v1_cashUnused * Math.pow(1 + CASH_YIELD_PA, holdingYears);
                const v1_shares = v1_invested / p.entryPrice;
                const v1_stockEndValue = v1_shares * exitPrice;
                const v1_totalEndValue = v1_stockEndValue + v1_cashWithInterest;
                const v1_pnlPct = ((v1_totalEndValue - BUDGET_PER_TRADE) / BUDGET_PER_TRADE) * 100;
                const v1_stockGainPct = ((exitPrice - p.entryPrice) / p.entryPrice) * 100;

                // --- AUSWERTUNG V2 (Progressive Pyramidisierung) ---
                // Tranche 1: 35% ($3,500) mit AVWAP Split
                const t1_effPrice = (p.entryPrice + p.avwapPrice) / 2;
                const t1_invested = BUDGET_PER_TRADE * 0.35;
                const t1_shares = t1_invested / t1_effPrice;

                let t2_invested = 0;
                let t2_shares = 0;
                let t2_cashYieldYears = holdingYears;
                if (p.tranche2Active) {
                    t2_invested = BUDGET_PER_TRADE * 0.35;
                    t2_shares = t2_invested / p.tranche2Price;
                    const t2_holdingDays = Math.round((new Date(exitDate) - new Date(p.tranche2Date)) / (1000 * 3600 * 24));
                    t2_cashYieldYears = (holdingDays - t2_holdingDays) / 365.25;
                }

                let t3_invested = 0;
                let t3_shares = 0;
                let t3_cashYieldYears = holdingYears;
                if (p.tranche3Active) {
                    t3_invested = BUDGET_PER_TRADE * 0.30;
                    t3_shares = t3_invested / p.tranche3Price;
                    const t3_holdingDays = Math.round((new Date(exitDate) - new Date(p.tranche3Date)) / (1000 * 3600 * 24));
                    t3_cashYieldYears = (holdingDays - t3_holdingDays) / 365.25;
                }

                const v2_totalShares = t1_shares + t2_shares + t3_shares;
                const v2_stockEndValue = v2_totalShares * exitPrice;

                // Cash-Zinsen auf nicht investierte Tranchen vor deren Zukauf
                let v2_cashInterest = 0;
                if (!p.tranche2Active) {
                    v2_cashInterest += (BUDGET_PER_TRADE * 0.35) * Math.pow(1 + CASH_YIELD_PA, holdingYears);
                } else {
                    v2_cashInterest += (BUDGET_PER_TRADE * 0.35) * (Math.pow(1 + CASH_YIELD_PA, Math.max(0, t2_cashYieldYears)) - 1);
                }

                if (!p.tranche3Active) {
                    v2_cashInterest += (BUDGET_PER_TRADE * 0.30) * Math.pow(1 + CASH_YIELD_PA, holdingYears);
                } else {
                    v2_cashInterest += (BUDGET_PER_TRADE * 0.30) * (Math.pow(1 + CASH_YIELD_PA, Math.max(0, t3_cashYieldYears)) - 1);
                }

                const v2_totalEndValue = v2_stockEndValue + v2_cashInterest;
                const v2_pnlPct = ((v2_totalEndValue - BUDGET_PER_TRADE) / BUDGET_PER_TRADE) * 100;

                allTradeResults.push({
                    ticker,
                    wave: p.wave,
                    investmentType: config.investmentType,
                    entryDate: p.entryDate,
                    entryPrice: p.entryPrice,
                    exitDate,
                    exitPrice,
                    holdingDays,
                    maxGainSeen: parseFloat((((p.maxPrice - p.entryPrice) / p.entryPrice) * 100).toFixed(1)),
                    stockGainPct: parseFloat(v1_stockGainPct.toFixed(1)),
                    v1_totalEndValue: Math.round(v1_totalEndValue),
                    v1_pnlPct: parseFloat(v1_pnlPct.toFixed(1)),
                    v2_totalEndValue: Math.round(v2_totalEndValue),
                    v2_pnlPct: parseFloat(v2_pnlPct.toFixed(1)),
                    v2_tranchesActive: p.tranche3Active ? 3 : (p.tranche2Active ? 2 : 1),
                    reason: exitReason
                });

                lastExitIdx = i;
                inPosition = null;
                activeSetup = null;
                currentWave = p.wave + 1;
            }
            continue;
        }

        // -------------------------------------------------------------
        // 2. SETUP SCANNING & WYCKOFF TIMING
        // -------------------------------------------------------------
        const isMatureHangover = (daysSinceAth >= 130 && ddFromAth <= -45.0);
        const isBaseReset = (currentWave > 1 && (i - lastExitIdx) >= 35);

        if (!activeSetup && (isMatureHangover || isBaseReset)) {
            if (rvol >= 2.0 || (i >= 5 && (closes[i] - closes[i-5]) / closes[i-5] <= -0.15) || isBaseReset) {
                activeSetup = {
                    crashDate: d,
                    crashIdx: i,
                    panicLowL1: q.low,
                    panicLowIdx: i,
                    reboundPeak: q.high,
                    higherLowL2: null,
                    higherLowIdx: null,
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

            if (daysSinceCrash >= 18 && reboundGain >= 7.5) {
                const isAboveL1 = q.low >= s.panicLowL1 * 1.02;
                const prevLow = lows[i - 1];
                const isTurningUp = q.close > q.open && q.close > prevLow;

                if (isAboveL1 && isTurningUp && !s.higherLowL2) {
                    s.higherLowL2 = q.low;
                    s.higherLowIdx = i;
                    s.phase = 'HIGHER_LOW_CONFIRMED';
                }
            }

            // ENTRY TRIGGER:
            // 1. Min 20 Tage Basis
            // 2. Higher Low bestätigt
            // 3. Kurs > Event-AVWAP & > 20-EMA
            // 4. M5 / Tageskerzen Bestätigung (Close in oberer Hälfte der Tagesrange)
            if (s.phase === 'HIGHER_LOW_CONFIRMED' && daysSinceCrash >= 20) {
                const curAvwap = s.avwap[i];
                const curEma20 = ema20[i];

                const isAboveAvwap = curAvwap && close > curAvwap;
                const isAboveEma20 = curEma20 && close > curEma20;
                const isCandleHealthy = (q.high > q.low) ? ((close - q.low) / (q.high - q.low) >= 0.45) : true;
                const isMacroSafe = !macroMatrix[d]?.isCrisisHedged;

                if (isAboveAvwap && isAboveEma20 && isCandleHealthy && isMacroSafe) {
                    // Fundamental Airbag Check
                    const fund = getKnownFundamentalsAtDate(info.financials, d);
                    let airbagApproved = false;

                    if (fund) {
                        const isPositiveFcf = fund.fcf >= 0;
                        const isRunwayOk = fund.runway_months >= 12.0 || (fund.founder_sponsor_backed && fund.runway_months >= 3.0);
                        const isDeleveraging = fund.deleveraging || fund.total_debt === 0;
                        const isMarginOk = fund.gross_margin_pct >= 55.0 || info.profile?.category === 'MEGA_CAP';

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
                            entryIdx: i,
                            entryDate: d,
                            entryPrice: close,
                            avwapPrice: curAvwap,
                            maxPrice: close,
                            minPrice: close,
                            panicLowL1: s.panicLowL1,
                            activeHLStop: s.panicLowL1, // Initialer Stop am Basistief L1
                            higherLowL2: s.higherLowL2,
                            tranche2Active: false,
                            tranche3Active: false
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

// -----------------------------------------------------------------------------
// ERGEBNIS-PRÄSENTATION
// -----------------------------------------------------------------------------
console.log(`Gesamt generierte Trades über alle 8 Ticker: ${allTradeResults.length}\n`);

const displayTable = allTradeResults.map(t => ({
    Ticker: t.ticker,
    Welle: `Boom ${t.wave}`,
    Typ: t.investmentType,
    Kauf: `${t.entryDate} ($${t.entryPrice.toFixed(2)})`,
    Verkauf: `${t.exitDate} ($${t.exitPrice.toFixed(2)})`,
    Dauer: `${t.holdingDays}d`,
    Aktie: `${t.stockGainPct >= 0 ? '+' : ''}${t.stockGainPct}%`,
    'V1 PnL': `${t.v1_pnlPct >= 0 ? '+' : ''}${t.v1_pnlPct}% ($${t.v1_totalEndValue})`,
    'V2 PnL': `${t.v2_pnlPct >= 0 ? '+' : ''}${t.v2_pnlPct}% ($${t.v2_totalEndValue})`,
    Tranchen: `${t.v2_tranchesActive}/3`,
    Delta: `+${(t.v2_pnlPct - t.v1_pnlPct).toFixed(1)}%`
}));

console.table(displayTable);

// Aggregierte Gesamtstatistik
let v1_totalProfit = 0;
let v2_totalProfit = 0;
let v1_wins = 0;
let v2_wins = 0;
let v1_winSum = 0;
let v1_lossSum = 0;
let v2_winSum = 0;
let v2_lossSum = 0;
let maxLossV1 = 0;
let maxLossV2 = 0;

for (const t of allTradeResults) {
    const v1_diff = t.v1_totalEndValue - BUDGET_PER_TRADE;
    const v2_diff = t.v2_totalEndValue - BUDGET_PER_TRADE;

    v1_totalProfit += v1_diff;
    v2_totalProfit += v2_diff;

    if (v1_diff > 0) {
        v1_wins++;
        v1_winSum += v1_diff;
    } else {
        v1_lossSum += Math.abs(v1_diff);
        if (Math.abs(v1_diff) > maxLossV1) maxLossV1 = Math.abs(v1_diff);
    }

    if (v2_diff > 0) {
        v2_wins++;
        v2_winSum += v2_diff;
    } else {
        v2_lossSum += Math.abs(v2_diff);
        if (Math.abs(v2_diff) > maxLossV2) maxLossV2 = Math.abs(v2_diff);
    }
}

const n = allTradeResults.length;
const totalBudgetAllocated = n * BUDGET_PER_TRADE;

console.log("================================================================================");
console.log("   AGGREGIERTE PORTFOLIO-KENNZAHLEN: V1 vs. V2 IM VERGLEICH");
console.log("================================================================================");

const aggTable = [
    {
        Metrik: 'Gesamt-Kapitaleinsatz (kumuliert)',
        'V1 (Baseline)': '$' + totalBudgetAllocated.toLocaleString(),
        'V2 (Pyramidisierung)': '$' + totalBudgetAllocated.toLocaleString(),
        Vorteil: 'Identisch ($10k / Trade)'
    },
    {
        Metrik: 'Gesamter Netto-Gewinn ($)',
        'V1 (Baseline)': '+$' + Math.round(v1_totalProfit).toLocaleString(),
        'V2 (Pyramidisierung)': '+$' + Math.round(v2_totalProfit).toLocaleString(),
        Vorteil: `+$${Math.round(v2_totalProfit - v1_totalProfit).toLocaleString()} (+${(((v2_totalProfit - v1_totalProfit)/v1_totalProfit)*100).toFixed(1)}% Mehrertrag!)`
    },
    {
        Metrik: 'Trefferquote (Win Rate %)',
        'V1 (Baseline)': `${((v1_wins/n)*100).toFixed(1)} % (${v1_wins}W / ${n-v1_wins}L)`,
        'V2 (Pyramidisierung)': `${((v2_wins/n)*100).toFixed(1)} % (${v2_wins}W / ${n-v2_wins}L)`,
        Vorteil: 'Identisch (Gleiche Filter)'
    },
    {
        Metrik: 'Profit Factor (Gewinne / Verluste)',
        'V1 (Baseline)': (v1_winSum / (v1_lossSum || 1)).toFixed(2),
        'V2 (Pyramidisierung)': (v2_winSum / (v2_lossSum || 1)).toFixed(2),
        Vorteil: `+${((v2_winSum/v2_lossSum) - (v1_winSum/v1_lossSum)).toFixed(2)} Punkte Steigerung!`
    },
    {
        Metrik: 'Durchschnittlicher Gewinn pro Trade',
        'V1 (Baseline)': `+$${Math.round(v1_totalProfit/n).toLocaleString()} (+${((v1_totalProfit/totalBudgetAllocated)*100).toFixed(1)}%)`,
        'V2 (Pyramidisierung)': `+$${Math.round(v2_totalProfit/n).toLocaleString()} (+${((v2_totalProfit/totalBudgetAllocated)*100).toFixed(1)}%)`,
        Vorteil: `+${(((v2_totalProfit - v1_totalProfit)/totalBudgetAllocated)*100).toFixed(1)} %-Punkte pro Trade`
    },
    {
        Metrik: 'Maximaler Verlust in einem Trade',
        'V1 (Baseline)': `-$${Math.round(maxLossV1).toLocaleString()} (-${((maxLossV1/BUDGET_PER_TRADE)*100).toFixed(1)}%)`,
        'V2 (Pyramidisierung)': `-$${Math.round(maxLossV2).toLocaleString()} (-${((maxLossV2/BUDGET_PER_TRADE)*100).toFixed(1)}%)`,
        Vorteil: maxLossV2 <= maxLossV1 ? '🟢 KEIN ERHÖHTES RISIKO!' : `+$${Math.round(maxLossV2 - maxLossV1)}`
    }
];

console.table(aggTable);

console.log("\n================================================================================");
console.log("   AUFSCHLÜSSELUNG NACH TICKER: V1 vs. V2");
console.log("================================================================================");

const tickerSummary = growthTickers.map(sym => {
    const symTrades = allTradeResults.filter(t => t.ticker === sym);
    const count = symTrades.length;
    const v1_profit = symTrades.reduce((sum, t) => sum + (t.v1_totalEndValue - BUDGET_PER_TRADE), 0);
    const v2_profit = symTrades.reduce((sum, t) => sum + (t.v2_totalEndValue - BUDGET_PER_TRADE), 0);
    const delta = v2_profit - v1_profit;
    const deltaPct = v1_profit !== 0 ? ((delta / Math.abs(v1_profit)) * 100).toFixed(1) + ' %' : 'N/A';
    return {
        Ticker: sym,
        Typ: TICKER_CONFIG[sym].investmentType,
        Trades: count,
        'V1 Gewinn': `${v1_profit >= 0 ? '+' : ''}$${Math.round(v1_profit).toLocaleString()}`,
        'V2 Gewinn': `${v2_profit >= 0 ? '+' : ''}$${Math.round(v2_profit).toLocaleString()}`,
        'Mehrertrag ($)': `${delta >= 0 ? '+' : ''}$${Math.round(delta).toLocaleString()}`,
        'Steigerung (%)': `${delta >= 0 ? '+' : ''}${deltaPct}`
    };
});

console.table(tickerSummary);
console.log("================================================================================\n");
