import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

async function getQuotes(symbol) {
    const file = path.join(CACHE_DIR, `${symbol}_daily.json`);
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    console.log(`Lade ${symbol} via Yahoo...`);
    const res = await yahooFinance.chart(symbol, { period1: '2020-01-01', period2: '2026-09-08' });
    const quotes = (res.quotes || []).filter(q => q.date && q.close !== null).map(q => ({
        date: (typeof q.date === 'string' ? new Date(q.date) : q.date).toISOString().split('T')[0],
        open: q.open ?? q.close,
        high: q.high ?? q.close,
        low: q.low ?? q.close,
        close: q.close,
        volume: q.volume
    })).sort((a, b) => a.date.localeCompare(b.date));
    fs.writeFileSync(file, JSON.stringify(quotes, null, 2));
    return quotes;
}

// Swing Low Finder (Local minimum with lookback & lookahead window)
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
            swingLows.push({ idx: i, date: quotes[i].date, low: curLow, close: quotes[i].close });
        }
    }
    return swingLows;
}

async function analyzeSymbolTrendlines(symbol) {
    console.log(`\n================================================================================`);
    console.log(`   DYNAMISCHE PARABOLISCHE TRENDLINIE & HIGHER-LOW TRAILING STOP: ${symbol}`);
    console.log(`================================================================================`);

    const quotes = await getQuotes(symbol);
    const swingLows = findSwingLows(quotes, 7);

    console.log(`Gefundene Swing-Lows (${symbol}): ${swingLows.length} Pivots`);

    // Simulate riding with dynamic ascending trendline
    let inTrade = null;
    const completedTrades = [];

    for (let i = 40; i < quotes.length; i++) {
        const q = quotes[i];
        const d = q.date;

        // Known swing lows up to date i (with at least 5 days confirmation)
        const confirmedLows = swingLows.filter(sl => sl.idx <= (i - 5));

        if (!inTrade) {
            // Entry Trigger: Look for Volume Surge / Gap followed by Higher Low
            // For PLTR: Feb 2023 gap ($8-9) or NVTS May 2025 gap
            if (confirmedLows.length >= 2) {
                const l1 = confirmedLows[confirmedLows.length - 2];
                const l2 = confirmedLows[confirmedLows.length - 1];

                // Higher low formed (L2 > L1) and price breaks above prior pivot high
                if (l2.low > l1.low * 1.02 && q.close > l2.close && (i - l2.idx) <= 25) {
                    // Check volume surge in recent 15 days
                    let maxRvol = 0;
                    for (let k = Math.max(0, i - 15); k <= i; k++) {
                        // rough rvol check
                        if (quotes[k].volume > 0) maxRvol = Math.max(maxRvol, quotes[k].volume);
                    }

                    inTrade = {
                        symbol,
                        entryDate: d,
                        entryPrice: q.close,
                        entryIdx: i,
                        anchorLow1: l1,
                        anchorLow2: l2,
                        maxPrice: q.close,
                        activeLineSlope: (l2.low - l1.low) / (l2.idx - l1.idx),
                        lastHigherLow: l2
                    };
                    console.log(`🟢 KAUF: ${symbol} am ${d} bei $${q.close.toFixed(2)} (Basiert auf HL $${l2.low.toFixed(2)} vs $${l1.low.toFixed(2)})`);
                }
            }
        } else {
            const t = inTrade;
            if (q.close > t.maxPrice) t.maxPrice = q.close;

            // Check if a NEW Higher Low was confirmed during the trade (Steepening Trendline Fan!)
            const recentLowsInTrade = confirmedLows.filter(sl => sl.idx > t.entryIdx);
            if (recentLowsInTrade.length > 0) {
                const latestLow = recentLowsInTrade[recentLowsInTrade.length - 1];
                if (latestLow.low > t.lastHigherLow.low) {
                    // Update trendline to steeper angle (Fan acceleration!)
                    t.anchorLow1 = t.lastHigherLow;
                    t.anchorLow2 = latestLow;
                    t.activeLineSlope = (latestLow.low - t.anchorLow1.low) / (latestLow.idx - t.anchorLow1.idx);
                    t.lastHigherLow = latestLow;
                    // console.log(`   ⚡ Trendlinie verschärft am ${d} auf HL: $${latestLow.low.toFixed(2)} (${latestLow.date})`);
                }
            }

            // Calculate current trendline value at day i
            const daysSinceAnchor = i - t.anchorLow2.idx;
            const currentLineVal = t.anchorLow2.low + (t.activeLineSlope * daysSinceAnchor);

            // Exit Condition:
            // 1. Price closes significantly below the active trendline (3% Margin of Safety)
            // 2. ODER price falls below the last confirmed Higher Low
            const isTrendlineBroken = (q.close < currentLineVal * 0.97) && (daysSinceAnchor >= 5);
            const isLastLowBroken = (q.close < t.lastHigherLow.low * 0.97);

            if (isTrendlineBroken || isLastLowBroken) {
                const pnl = ((q.close - t.entryPrice) / t.entryPrice) * 100;
                const maxGain = ((t.maxPrice - t.entryPrice) / t.entryPrice) * 100;
                console.log(`🛑 VERKAUF (Trendlinien-Bruch): ${symbol} am ${d} bei $${q.close.toFixed(2)}`);
                console.log(`   • Rendite:     ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)} % (Max gesehen: +${maxGain.toFixed(1)} %)`);
                console.log(`   • Haltedauer:  ${i - t.entryIdx} Tage`);
                console.log(`   • Bruch-Grund: LineVal war $${currentLineVal.toFixed(2)}, Last HL war $${t.lastHigherLow.low.toFixed(2)}\n`);

                completedTrades.push({
                    symbol,
                    entry: t.entryDate,
                    entryPrice: t.entryPrice,
                    exit: d,
                    exitPrice: q.close,
                    pnl,
                    maxGain,
                    days: i - t.entryIdx
                });
                inTrade = null;
                // Wait at least 30 days before looking for a new setup
                i += 20;
            }
        }
    }
}

async function runAll() {
    await analyzeSymbolTrendlines('PLTR');
    await analyzeSymbolTrendlines('NVTS');
    await analyzeSymbolTrendlines('GDX');
}

runAll().catch(console.error);
