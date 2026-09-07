import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

// Caching-Funktion für historische Kurse
async function getHistoricalPrices(symbols, startDate, endDate) {
    const cacheDir = path.resolve(__dirname, '../../trash/cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    const prices = {};

    for (const sym of symbols) {
        const cacheFile = path.join(cacheDir, `${sym}_${startDate}_${endDate}.json`);
        if (fs.existsSync(cacheFile)) {
            prices[sym] = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            continue;
        }

        console.log(`Hole Kursdaten für ${sym} (${startDate} bis ${endDate})...`);
        try {
            const chart = await yf.chart(sym, {
                period1: startDate,
                period2: endDate,
                interval: '1d'
            });
            const quotes = chart.quotes
                .filter(q => q.close !== null && q.close !== undefined)
                .map(q => ({
                    date: q.date.toISOString().split('T')[0],
                    close: q.adjclose || q.close
                }));
            prices[sym] = quotes;
            fs.writeFileSync(cacheFile, JSON.stringify(quotes));
        } catch (e) {
            console.error(`Fehler bei ${sym}:`, e.message);
        }
    }

    return prices;
}

// Makrodaten (WALCL, RRP, TGA, T10Y2Y)
async function getMacroData(startDate) {
    const pool = mysql.createPool(process.env.DATABASE_URL);

    const [walcl] = await pool.query(`
        SELECT observation_date as date, value 
        FROM econ_fred 
        WHERE series_id = 'WALCL' AND observation_date >= ?
        ORDER BY observation_date ASC
    `, [startDate]);

    const [rrp] = await pool.query(`
        SELECT observation_date as date, value 
        FROM econ_fred 
        WHERE series_id = 'RRPONTSYD' AND observation_date >= ?
        ORDER BY observation_date ASC
    `, [startDate]);

    const [t10y2y] = await pool.query(`
        SELECT observation_date as date, value 
        FROM econ_fred 
        WHERE series_id = 'T10Y2Y' AND observation_date >= ?
        ORDER BY observation_date ASC
    `, [startDate]);

    await pool.end();

    // WTREGEN (TGA) direkt via FRED API
    let wtregen = [];
    const fredApiKey = process.env.FRED_API_KEY;
    if (fredApiKey) {
        try {
            const url = `https://api.stlouisfed.org/fred/series/observations?series_id=WTREGEN&api_key=${fredApiKey}&file_type=json&observation_start=${startDate}`;
            const res = await fetch(url);
            const json = await res.json();
            if (json.observations) {
                wtregen = json.observations
                    .filter(o => o.value !== '.')
                    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
            }
        } catch (e) {
            console.error("Fehler beim Abruf von WTREGEN:", e.message);
        }
    }

    return { walcl, rrp, t10y2y, wtregen };
}

// Simulations-Funktion für ein beliebiges Zeitfenster
function simulateScenario({
    name,
    startDate,
    endDate,
    prices,
    macro,
    techSymbols,
    useRules = true // true = MIT Sicherheitsregeln & Gold-Guard, false = BLIND 100% Tech Buy & Hold
}) {
    const fxSymbol = 'EURUSD=X';
    const goldSymbol = 'GLD';
    const benchmarkSymbol = 'QQQ';

    // FX & Price Maps
    const fxMap = {};
    for (const q of prices[fxSymbol] || []) fxMap[q.date] = q.close;

    const priceMaps = {};
    for (const sym of [...techSymbols, goldSymbol, benchmarkSymbol]) {
        priceMaps[sym] = {};
        for (const q of prices[sym] || []) priceMaps[sym][q.date] = q.close;
    }

    // Net Fed Liquidity wöchentlich
    const wtregenMap = {};
    for (const w of macro.wtregen) wtregenMap[w.date] = w.value;
    const rrpMap = {};
    for (const r of macro.rrp) rrpMap[r.date] = parseFloat(r.value);

    const weeklyNL = [];
    for (const w of macro.walcl) {
        const d = w.date;
        const walclVal = parseFloat(w.value);
        const tgaVal = wtregenMap[d] !== undefined ? wtregenMap[d] : 0;
        const rrpVal = rrpMap[d] !== undefined ? rrpMap[d] : 0;
        const netLiq = walclVal - tgaVal - (rrpVal * 1000);
        weeklyNL.push({ date: d, netLiq });
    }

    const nlDeltaMap = {};
    for (let i = 8; i < weeklyNL.length; i++) {
        const curr = weeklyNL[i];
        const prev8 = weeklyNL[i - 8];
        nlDeltaMap[curr.date] = (curr.netLiq - prev8.netLiq) / prev8.netLiq;
    }

    const nlDates = Object.keys(nlDeltaMap).sort();

    // Handelstage filtern
    const tradingDates = (prices['QQQ'] || [])
        .map(q => q.date)
        .filter(d => d >= startDate && d <= endDate);

    let cashEUR = 0;
    const portfolio = { shares: {}, goldShares: 0 };
    for (const s of techSymbols) portfolio.shares[s] = 0;

    let benchmarkShares = 0;
    let totalInvestedEUR = 10000;
    let goldGuardActive = false;
    let goldGuardTriggerCount = 0;
    let peakValueEUR = 10000;
    let maxDrawdownPct = 0;

    // Tranchen
    const initialTranches = [
        { date: tradingDates[0], amountEUR: 3333.33, executed: false },
        { date: tradingDates[Math.min(21, tradingDates.length - 1)], amountEUR: 3333.33, executed: false },
        { date: tradingDates[Math.min(42, tradingDates.length - 1)], amountEUR: 3333.34, executed: false }
    ];

    let lastMonth = '';
    let lastKnownNlDelta = 0;

    for (let i = 0; i < tradingDates.length; i++) {
        const date = tradingDates[i];
        const eurUsd = fxMap[date] || 1.10;

        for (const nld of nlDates) {
            if (nld <= date) lastKnownNlDelta = nlDeltaMap[nld];
            else break;
        }

        // Sicherheitsregeln: Gold-Guard
        if (useRules) {
            if (!goldGuardActive && lastKnownNlDelta < -0.05) {
                goldGuardActive = true;
                goldGuardTriggerCount++;
                let goldUSD = 0;
                for (const sym of techSymbols) {
                    const pUSD = priceMaps[sym][date];
                    if (pUSD && portfolio.shares[sym] > 0) {
                        const sell = portfolio.shares[sym] * 0.25;
                        portfolio.shares[sym] -= sell;
                        goldUSD += sell * pUSD;
                    }
                }
                const pGold = priceMaps[goldSymbol][date];
                if (pGold && goldUSD > 0) {
                    portfolio.goldShares += goldUSD / pGold;
                }
            } else if (goldGuardActive && lastKnownNlDelta >= 0.0) {
                goldGuardActive = false;
                const pGold = priceMaps[goldSymbol][date];
                if (pGold && portfolio.goldShares > 0) {
                    const goldUSD = portfolio.goldShares * pGold;
                    portfolio.goldShares = 0;
                    const perSlotUSD = goldUSD / techSymbols.length;
                    for (const sym of techSymbols) {
                        const pUSD = priceMaps[sym][date];
                        if (pUSD) portfolio.shares[sym] += perSlotUSD / pUSD;
                    }
                }
            }
        }

        // Tranchen investieren
        for (const t of initialTranches) {
            if (!t.executed && date >= t.date) {
                t.executed = true;
                const trancheUSD = t.amountEUR * eurUsd;
                const perSlotUSD = trancheUSD / techSymbols.length;
                for (const sym of techSymbols) {
                    const pUSD = priceMaps[sym][date];
                    if (pUSD) portfolio.shares[sym] += perSlotUSD / pUSD;
                }
                const pQQQ = priceMaps[benchmarkSymbol][date];
                if (pQQQ) benchmarkShares += trancheUSD / pQQQ;
            }
        }

        // Sparplan: 150 € / Monat
        const curM = date.substring(0, 7);
        if (curM !== lastMonth && i > 0) {
            lastMonth = curM;
            const sparEUR = 150;
            totalInvestedEUR += sparEUR;
            const sparUSD = sparEUR * eurUsd;

            const pQQQ = priceMaps[benchmarkSymbol][date];
            if (pQQQ) benchmarkShares += sparUSD / pQQQ;

            if (useRules && goldGuardActive) {
                const techUSD = sparUSD * 0.75;
                const goldUSD = sparUSD * 0.25;
                const perSlotUSD = techUSD / techSymbols.length;
                for (const sym of techSymbols) {
                    const pUSD = priceMaps[sym][date];
                    if (pUSD) portfolio.shares[sym] += perSlotUSD / pUSD;
                }
                const pGold = priceMaps[goldSymbol][date];
                if (pGold) portfolio.goldShares += goldUSD / pGold;
            } else {
                const perSlotUSD = sparUSD / techSymbols.length;
                for (const sym of techSymbols) {
                    const pUSD = priceMaps[sym][date];
                    if (pUSD) portfolio.shares[sym] += perSlotUSD / pUSD;
                }
            }
        }

        // Portfolio-Bewertung heute
        let curValUSD = 0;
        for (const sym of techSymbols) {
            curValUSD += portfolio.shares[sym] * (priceMaps[sym][date] || 0);
        }
        curValUSD += portfolio.goldShares * (priceMaps[goldSymbol][date] || 0);
        const curValEUR = curValUSD / eurUsd;

        if (curValEUR > peakValueEUR) peakValueEUR = curValEUR;
        const dd = (curValEUR - peakValueEUR) / peakValueEUR;
        if (dd < maxDrawdownPct) maxDrawdownPct = dd;
    }

    // Endbewertung
    const finalDate = tradingDates[tradingDates.length - 1];
    const finalEurUsd = fxMap[finalDate] || 1.10;

    let finalValUSD = 0;
    for (const sym of techSymbols) {
        finalValUSD += portfolio.shares[sym] * (priceMaps[sym][finalDate] || 0);
    }
    finalValUSD += portfolio.goldShares * (priceMaps[goldSymbol][finalDate] || 0);
    const finalValEUR = finalValUSD / finalEurUsd;

    const bValUSD = benchmarkShares * (priceMaps[benchmarkSymbol][finalDate] || 0);
    const bValEUR = bValUSD / finalEurUsd;

    return {
        name,
        startDate,
        endDate: finalDate,
        totalInvestedEUR,
        finalValEUR,
        profitEUR: finalValEUR - totalInvestedEUR,
        returnPct: ((finalValEUR - totalInvestedEUR) / totalInvestedEUR) * 100,
        bValEUR,
        bReturnPct: ((bValEUR - totalInvestedEUR) / totalInvestedEUR) * 100,
        maxDrawdownPct: maxDrawdownPct * 100,
        goldGuardTriggerCount
    };
}

async function runAllStressTests() {
    console.log("================================================================================");
    console.log("   CRASHRADAR: MULTI-KRISEN STRESSTEST DES 7-SLOT GURU-SYSTEMS");
    console.log("   Vergleich: MIT Sicherheitsregeln (Gold-Guard) vs. OHNE vs. QQQ Benchmark");
    console.log("================================================================================\n");

    const techSymbols = ['MSFT', 'AMZN', 'GOOGL', 'META', 'TSM', 'NVDA', 'NOW'];
    const allSymbols = [...techSymbols, 'QQQ', 'GLD', 'EURUSD=X'];

    console.log("Lade historische Gesamtdaten (2018 bis 2026)...");
    const prices = await getHistoricalPrices(allSymbols, '2017-09-01', '2026-09-06');
    const macro = await getMacroData('2017-09-01');
    console.log("Daten geladen. Führe Szenarien durch...\n");

    const scenarios = [
        {
            name: "Szenario 1: Der Zinsschock 2022 (Start am Allzeithoch 03.01.2022 bis heute)",
            startDate: '2022-01-03',
            endDate: '2026-09-04'
        },
        {
            name: "Szenario 1B: Der Zinsschock 2022 ISOLIERT (03.01.2022 bis 31.12.2022 / Peak-to-Trough)",
            startDate: '2022-01-03',
            endDate: '2022-12-30'
        },
        {
            name: "Szenario 2: Der Corona-Crash 2020 (Start am Allzeithoch 19.02.2020 bis heute)",
            startDate: '2020-02-19',
            endDate: '2026-09-04'
        },
        {
            name: "Szenario 3: Der QT-Crash 2018 (Start 01.10.2018 bis heute)",
            startDate: '2018-10-01',
            endDate: '2026-09-04'
        }
    ];

    for (const sc of scenarios) {
        console.log(`================================================================================`);
        console.log(`👉 ${sc.name}`);
        console.log(`================================================================================`);

        const resWithRules = simulateScenario({
            name: sc.name,
            startDate: sc.startDate,
            endDate: sc.endDate,
            prices,
            macro,
            techSymbols,
            useRules: true
        });

        const resNoRules = simulateScenario({
            name: sc.name,
            startDate: sc.startDate,
            endDate: sc.endDate,
            prices,
            macro,
            techSymbols,
            useRules: false
        });

        console.log(`Eingezahltes Kapital: € ${resWithRules.totalInvestedEUR.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`1. 7-SLOT SYSTEM (MIT SICHERHEITSREGELN / GOLD-GUARD):`);
        console.log(`   * Depot-Endwert:      € ${resWithRules.finalValEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`   * Netto-Rendite:      +${resWithRules.returnPct.toFixed(2)} % (+€ ${resWithRules.profitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
        console.log(`   * Maximaler Drawdown: ${resWithRules.maxDrawdownPct.toFixed(2)} %`);
        console.log(`   * Gold-Guard Triggers: ${resWithRules.goldGuardTriggerCount} x aktiviert`);
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`2. 7-SLOT SYSTEM (OHNE SCHUTZ / 100% BLIND BUY&HOLD):`);
        console.log(`   * Depot-Endwert:      € ${resNoRules.finalValEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`   * Netto-Rendite:      +${resNoRules.returnPct.toFixed(2)} % (+€ ${resNoRules.profitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
        console.log(`   * Maximaler Drawdown: ${resNoRules.maxDrawdownPct.toFixed(2)} %`);
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`3. BENCHMARK (QQQ / NASDAQ-100 BUY&HOLD):`);
        console.log(`   * Depot-Endwert:      € ${resWithRules.bValEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`   * Netto-Rendite:      +${resWithRules.bReturnPct.toFixed(2)} %`);
        console.log(`--------------------------------------------------------------------------------`);
        const alpha = resWithRules.returnPct - resWithRules.bReturnPct;
        const protectionBenefit = resWithRules.maxDrawdownPct - resNoRules.maxDrawdownPct;
        console.log(`🛡️ Schutz-Effekt: Drawdown um ${protectionBenefit.toFixed(2)} %-Punkte abgemildert`);
        console.log(`🚀 Alpha vs. QQQ: ${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)} %-Punkte Überrendite\n`);
    }

    process.exit(0);
}

runAllStressTests().catch(err => {
    console.error("Fehler im Stresstest:", err);
    process.exit(1);
});
