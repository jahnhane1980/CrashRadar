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

function getKnownFundamentalsAtDate(financials, date) {
    if (!financials || financials.length === 0) return null;
    const known = financials
        .filter(f => f.filing_date && f.filing_date <= date)
        .sort((a, b) => a.filing_date.localeCompare(b.filing_date));
    return known.length > 0 ? known[known.length - 1] : null;
}

async function runGrowthLifecycleSimulation() {
    console.log("================================================================================");
    console.log("   HIGH-BETA GROWTH LEBENSZYKLUS-RADAR: SIMULATION & EMPIRISCHER BEWEIS");
    console.log("   Fokus: 4-6 Jahre Historie, Post-IPO Hangover, Ruhige Hand & Parabolik-Notbremse");
    console.log("   Fokus-Universum: HIMS, IBRX, NVTS, S, SOFI, PLTR, APP");
    console.log("================================================================================\n");

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

        // Track All-Time High from IPO to current index (4-6 year memory)
        const rollingHigh = [];
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
        let currentWave = 1; // Tracks Boom 1 vs Boom 2 (Re-Entry)

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
            // 1. POSITION MANAGEMENT (RUHIGE HAND & PARABOLIK-NOTBREMSE)
            // -------------------------------------------------------------
            if (inPosition) {
                const p = inPosition;
                const holdingDays = Math.round((new Date(d) - new Date(p.entryDate)) / (1000 * 60 * 60 * 24));
                const pnlPct = ((close - p.entryPrice) / p.entryPrice) * 100;
                if (close > p.maxPrice) p.maxPrice = close;
                if (close < p.minPrice) p.minPrice = close;

                let exitReason = null;

                // A. DIE PARABOLIK-NOTBREMSE (Blow-Off Climax & Short Squeeze)
                // Bedingungen:
                // 1. Gewaltige Distanz zum 50-Tage-SMA (>= +65% bis +100%)
                // 2. Erschöpfungs-Volumen (RVOL >= 3.0x)
                // 3. Reversal-Muster: Kurs prallt vom Tageshoch ab und schließt im unteren Bereich (Shooting Star)
                //    ODER Tagesverlust unter Panik-Volumen nach vertikalem Anstieg
                const distSma50 = s50 ? ((close - s50) / s50) * 100 : 0;
                const dailyRange = q.high - q.low;
                const upperWick = q.high - Math.max(q.open, q.close);
                const isExhaustionCandle = dailyRange > 0 && (upperWick / dailyRange >= 0.40 || close < (q.high + q.low) / 2);

                if (distSma50 >= 65.0 && (rvol >= 3.0 || distSma50 >= 110.0) && isExhaustionCandle && pnlPct >= 50.0) {
                    exitReason = `PARABOLIK-NOTBREMSE: Distanz SMA50 = +${distSma50.toFixed(0)}%, RVOL = ${rvol.toFixed(1)}x, Shooting Star`;
                }

                // B. FUNDAMENTALER THESIS-STOP
                const fundNow = getKnownFundamentalsAtDate(info.financials, d);
                if (!exitReason && fundNow) {
                    if (!fundNow.founder_sponsor_backed && fundNow.fcf < 0 && fundNow.runway_months < 3.0) {
                        exitReason = `Thesis-Stop: Cash Runway auf ${fundNow.runway_months}m geschmolzen`;
                    }
                }

                // C. STRUKTURBRUCH: Kurs fällt signifikant unter das Panik-Tief L1 (-5%)
                if (!exitReason && close < p.panicLowL1 * 0.95) {
                    exitReason = `Strukturbruch: Kurs fällt unter Panik-Tief L1 ($${p.panicLowL1.toFixed(2)})`;
                }

                // D. TREND-ERSCHÖPFUNG: Erst nach signifikanter Haltedauer (>60 Tage), wenn SMA 50 nach unten dreht
                // und Kurs nachhaltig unter SMA 50 schließt
                const prevSma50 = sma50[i - 10];
                const isSma50Falling = s50 && prevSma50 && s50 < prevSma50;
                if (!exitReason && holdingDays >= 45 && s50 && close < s50 * 0.96 && isSma50Falling && pnlPct >= 20.0) {
                    exitReason = `Trend-Erschöpfung: Nachhaltiger Bruch unter fallenden 50-Tage-SMA`;
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
                    currentWave = p.wave + 1; // Prepare for possible Wave 2 (Re-Entry after Base Reset)
                }
                continue;
            }

            // -------------------------------------------------------------
            // 2. TURNAROUND & BASE-RESET RADAR
            // -------------------------------------------------------------
            // Prüfe Reifegrad des Hangovers:
            // Mindestens 150 Handelstage (~7-9 Monate) seit dem ATH vergangen
            // ODER Drawdown >= -50% (echter Kater)
            const isMatureHangover = (daysSinceAth >= 140 && ddFromAth <= -50.0);
            const isBaseReset = (currentWave > 1 && (i - lastExitIdx) >= 40); // Base-Reset für Boom 2

            if (!activeSetup && (isMatureHangover || isBaseReset)) {
                // Setup zündet bei Panik-Volumen (RVOL >= 2.0) oder scharfem Sellout-Tief
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

                // Update Low if new low within early phase
                if (q.low < s.panicLowL1 && daysSinceCrash <= 20) {
                    s.panicLowL1 = q.low;
                    s.panicLowIdx = i;
                    s.avwap = calculateAnchoredVWAP(quotes, i);
                }

                if (q.high > s.reboundPeak) s.reboundPeak = q.high;
                const reboundGain = ((s.reboundPeak - s.panicLowL1) / s.panicLowL1) * 100;

                // Phase 3: Higher-Low Retest nach mindestens 20 Tagen
                if (daysSinceCrash >= 20 && reboundGain >= 8.0) {
                    const isAboveL1 = q.low >= s.panicLowL1 * 1.02; // Mindestens +2-3% über L1
                    const prevLow = lows[i - 1];
                    const isTurningUp = q.close > q.open && q.close > prevLow;

                    if (isAboveL1 && isTurningUp && !s.higherLowL2) {
                        s.higherLowL2 = q.low;
                        s.higherLowIdx = i;
                        s.phase = 'HIGHER_LOW_CONFIRMED';
                    }
                }

                // PATIENCE ENTRY TRIGGER:
                // 1. Mindestens 25 Tage Basis-Konsolidierung
                // 2. Higher Low bestätigt
                // 3. Kurs über Event-AVWAP & über 20-EMA
                // 4. Makro-Katastrophen-Matrix ist GRÜN (kein Notfall-Schutzschirm)
                if (s.phase === 'HIGHER_LOW_CONFIRMED' && daysSinceCrash >= 25) {
                    const curAvwap = s.avwap[i];
                    const curEma20 = ema20[i];

                    const isAboveAvwap = curAvwap && close > curAvwap;
                    const isAboveEma20 = curEma20 && close > curEma20;
                    const isMacroSafe = !macroMatrix[d]?.isCrisisHedged;

                    if (isAboveAvwap && isAboveEma20 && isMacroSafe) {
                        // FUNDAMENTAL AIRBAG CHECK
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
                            airbagApproved = true; // Historical early data fallback
                        }

                        if (airbagApproved) {
                            inPosition = {
                                ticker,
                                wave: s.wave,
                                entryDate: d,
                                entryPrice: close,
                                maxPrice: close,
                                minPrice: close,
                                panicLowL1: s.panicLowL1,
                                higherLowL2: s.higherLowL2
                            };
                        }
                    }
                }

                // Invalidate setup if it drags for > 180 days or breaks severely below L1
                if (daysSinceCrash > 180 || (q.low < s.panicLowL1 * 0.90 && daysSinceCrash > 30)) {
                    activeSetup = null;
                }
            }
        }
    }

    console.log(`\n================================================================================`);
    console.log(`   ERGEBNISSE: HIGH-BETA GROWTH LEBENSZYKLUS-RADAR (${allTrades.length} TRADES)`);
    console.log(`================================================================================\n`);

    const tableData = allTrades.map(t => ({
        Ticker: t.ticker,
        Welle: `Boom ${t.wave}`,
        Kauf: `${t.entryDate} ($${t.entryPrice.toFixed(2)})`,
        Verkauf: `${t.exitDate} ($${t.exitPrice.toFixed(2)})`,
        Rendite: `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(1)} %`,
        MaxRitt: `+${t.maxGainSeen.toFixed(0)} %`,
        Dauer: `${t.holdingDays} Tage`,
        ExitGrund: t.reason.substring(0, 42)
    }));

    console.table(tableData);

    let totalGain = 0;
    let winCount = 0;
    let winSum = 0;
    let lossSum = 0;
    let totalHold = 0;

    for (const t of allTrades) {
        totalGain += t.pnlPct;
        if (t.pnlPct > 0) {
            winCount++;
            winSum += t.pnlPct;
        } else {
            lossSum += Math.abs(t.pnlPct);
        }
        totalHold += t.holdingDays;
    }

    const count = allTrades.length;
    const wr = count > 0 ? (winCount / count) * 100 : 0;
    const avgPnl = count > 0 ? totalGain / count : 0;
    const pf = lossSum > 0 ? (winSum / lossSum).toFixed(2) : 'INF';

    console.log(`\n📈 Gesamt-Statistik des High-Beta Growth Radars:`);
    console.log(`   • Gesamt-Trades:       ${count}`);
    console.log(`   • Trefferquote:        ${wr.toFixed(1)} % (${winCount} Gewinner / ${count - winCount} Verlierer)`);
    console.log(`   • Durchschnittsrendite:${avgPnl >= 0 ? ' +' : ' '}${avgPnl.toFixed(1)} % pro Trade`);
    console.log(`   • Profit Factor:       ${pf}`);
    console.log(`   • Mittlere Haltedauer: ${(totalHold / count).toFixed(0)} Tage (~${((totalHold/count)/30).toFixed(1)} Monate)`);
    console.log(`================================================================================\n`);

    fs.writeFileSync(path.join(CACHE_DIR, 'growth_lifecycle_trades.json'), JSON.stringify(allTrades, null, 2));
}

runGrowthLifecycleSimulation().catch(console.error);
