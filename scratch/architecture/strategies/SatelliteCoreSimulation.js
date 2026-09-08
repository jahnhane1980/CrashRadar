import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

async function getHistoricalPrices(symbols, startDate, endDate) {
    const cacheDir = path.resolve(__dirname, '../../trash/cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    const prices = {};

    for (const sym of symbols) {
        const cacheFile = path.join(cacheDir, `${sym.replace(/[^a-zA-Z0-9]/g, '_')}_${startDate}_${endDate}.json`);
        if (fs.existsSync(cacheFile)) {
            prices[sym] = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            continue;
        }

        console.log(`Hole Kursdaten für ${sym}...`);
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

async function getMacroData(startDate) {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    let walcl = [], rrp = [], hySpreads = [];

    try {
        const [walclRows] = await pool.execute(
            `SELECT observation_date as date, value FROM econ_fred WHERE series_id = 'WALCL' AND observation_date >= ? ORDER BY observation_date ASC`,
            [startDate]
        );
        walcl = walclRows.map(r => ({ date: String(r.date).substring(0, 10), value: parseFloat(r.value) }));

        const [rrpRows] = await pool.execute(
            `SELECT observation_date as date, value FROM econ_fred WHERE series_id = 'RRPONTSYD' AND observation_date >= ? ORDER BY observation_date ASC`,
            [startDate]
        );
        rrp = rrpRows.map(r => ({ date: String(r.date).substring(0, 10), value: parseFloat(r.value) }));

        const [hyRows] = await pool.execute(
            `SELECT observation_date as date, value FROM econ_fred WHERE series_id = 'BAMLH0A0HYM2' AND observation_date >= ? ORDER BY observation_date ASC`,
            [startDate]
        );
        hySpreads = hyRows.map(r => ({ date: String(r.date).substring(0, 10), value: parseFloat(r.value) }));
    } catch (e) {
        console.error('DB Error:', e.message);
    } finally {
        await pool.end();
    }

    let tga = [];
    const tgaPath = path.resolve(__dirname, '../../trash/cache/tga_cache.json');
    if (fs.existsSync(tgaPath)) {
        tga = JSON.parse(fs.readFileSync(tgaPath, 'utf8'));
    }

    return { walcl, rrp, tga, hySpreads };
}

async function runSatelliteSimulation() {
    console.log('='.repeat(80));
    console.log('   CRASHRADAR: SATELLITE (CORE-SATELLITE 80/15/5) STRATEGIE');
    console.log('   80% SPY | 15% DFNS | 5% BTC | Notfall-Stecker (50% Gold / 50% Cash)');
    console.log('   Regel: BTC wird gehodlt (Rebalancing nur am Notfall-Stecker!)');
    console.log('='.repeat(80));

    const startDate = '2023-04-01'; // Nach Inception von DFNS (31.03.2023)
    const endDate = '2026-09-08';

    const symbols = ['SPY', 'DFNS.L', 'BTC-USD', 'GLD'];
    const prices = await getHistoricalPrices(symbols, startDate, endDate);
    const macro = await getMacroData('2023-01-01');

    // Erstelle gemeinsame Handelsdaten
    const dateMap = {};
    for (const sym of symbols) {
        if (!prices[sym]) continue;
        for (const item of prices[sym]) {
            if (!dateMap[item.date]) dateMap[item.date] = {};
            dateMap[item.date][sym] = item.close;
        }
    }

    const sortedDates = Object.keys(dateMap).sort();

    // Berechne Net Fed Liquidity & HY Credit Spread SMA50
    const netLiqMap = {};
    const spreadMap = {};
    const spreadSMA50Map = {};

    let lastWalcl = 8000000, lastTga = 500000, lastRrp = 2000000;

    for (const date of sortedDates) {
        const w = macro.walcl.find(x => x.date <= date);
        if (w) lastWalcl = w.value;
        const t = macro.tga.find(x => x.date <= date);
        if (t) lastTga = t.value;
        const r = macro.rrp.find(x => x.date <= date);
        if (r) lastRrp = r.value;

        netLiqMap[date] = (lastWalcl - lastTga - lastRrp) / 1000;

        const sp = macro.hySpreads.filter(x => x.date <= date);
        if (sp.length > 0) {
            const currentSpread = sp[sp.length - 1].value;
            spreadMap[date] = currentSpread;
            const recent = sp.slice(-50).map(x => x.value);
            const sma50 = recent.reduce((a, b) => a + b, 0) / recent.length;
            spreadSMA50Map[date] = sma50;
        } else {
            spreadMap[date] = 3.5;
            spreadSMA50Map[date] = 3.5;
        }
    }

    // Portfolios initialisieren
    // 1. Core-Satellite (mit Notfall-Schutzschild)
    // 2. Core-Satellite (Reines Blind Buy & Hold)
    // 3. Benchmark SPY (100% S&P 500 Buy & Hold)

    const START_CAPITAL = 10000; // 10.000 $
    const MONTHLY_RATE = 200;    // 200 $/Monat

    const portfolio = {
        cashUSD: START_CAPITAL,
        shares: { 'SPY': 0, 'DFNS.L': 0, 'BTC-USD': 0, 'GLD': 0 }
    };

    const buyAndHoldPortfolio = {
        cashUSD: START_CAPITAL,
        shares: { 'SPY': 0, 'DFNS.L': 0, 'BTC-USD': 0 }
    };

    const spyBenchmark = {
        cashUSD: START_CAPITAL,
        shares: 0
    };

    let totalDeposited = START_CAPITAL;
    let isEmergencyActive = false;
    let emergencyTriggerCount = 0;
    let lastMonth = '';
    let isInitialized = false;

    const historySnapshots = [];

    for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const dayPrices = dateMap[date];
        if (!dayPrices['SPY'] || !dayPrices['DFNS.L'] || !dayPrices['BTC-USD']) continue;

        const currentMonth = date.substring(0, 7);

        // Net Liquidity 8-Wochen-Delta berechnen (ca. 40 Handelstage)
        let netLiqDelta8W = 0;
        if (i >= 40) {
            const pastDate = sortedDates[i - 40];
            const currentNL = netLiqMap[date];
            const pastNL = netLiqMap[pastDate];
            if (pastNL && pastNL > 0) {
                netLiqDelta8W = (currentNL - pastNL) / pastNL;
            }
        }

        const hySpread = spreadMap[date] || 3.5;
        const hySMA50 = spreadSMA50Map[date] || 3.5;

        // Notfall-Trigger: NetLiq < -5% UND HY Spread > 4.0% & über SMA50
        const isMacroRed = (netLiqDelta8W < -0.05) && (hySpread > 4.0 && hySpread > hySMA50);
        const isNetLiqRecovered = (netLiqDelta8W >= 0.0);

        // Initial-Investition am ersten Tag (80% SPY, 15% DFNS, 5% BTC)
        if (!isInitialized) {
            const spyAlloc = portfolio.cashUSD * 0.80;
            const dfnsAlloc = portfolio.cashUSD * 0.15;
            const btcAlloc = portfolio.cashUSD * 0.05;

            portfolio.shares['SPY'] = spyAlloc / dayPrices['SPY'];
            portfolio.shares['DFNS.L'] = dfnsAlloc / dayPrices['DFNS.L'];
            portfolio.shares['BTC-USD'] = btcAlloc / dayPrices['BTC-USD'];
            portfolio.cashUSD = 0;

            buyAndHoldPortfolio.shares['SPY'] = (buyAndHoldPortfolio.cashUSD * 0.80) / dayPrices['SPY'];
            buyAndHoldPortfolio.shares['DFNS.L'] = (buyAndHoldPortfolio.cashUSD * 0.15) / dayPrices['DFNS.L'];
            buyAndHoldPortfolio.shares['BTC-USD'] = (buyAndHoldPortfolio.cashUSD * 0.05) / dayPrices['BTC-USD'];
            buyAndHoldPortfolio.cashUSD = 0;

            spyBenchmark.shares = spyBenchmark.cashUSD / dayPrices['SPY'];
            spyBenchmark.cashUSD = 0;

            isInitialized = true;
        }

        // Monatliche Sparrate am 1. des Monats
        if (currentMonth !== lastMonth && isInitialized) {
            totalDeposited += MONTHLY_RATE;

            // Buy & Hold Sparplan (80 / 15 / 5)
            buyAndHoldPortfolio.shares['SPY'] += (MONTHLY_RATE * 0.80) / dayPrices['SPY'];
            buyAndHoldPortfolio.shares['DFNS.L'] += (MONTHLY_RATE * 0.15) / dayPrices['DFNS.L'];
            buyAndHoldPortfolio.shares['BTC-USD'] += (MONTHLY_RATE * 0.05) / dayPrices['BTC-USD'];

            // SPY Benchmark Sparplan
            spyBenchmark.shares += MONTHLY_RATE / dayPrices['SPY'];

            // Strategie Sparplan
            if (isEmergencyActive) {
                // Bei Notfall: 50% Gold / 50% Cash
                if (dayPrices['GLD']) {
                    portfolio.shares['GLD'] += (MONTHLY_RATE * 0.50) / dayPrices['GLD'];
                } else {
                    portfolio.cashUSD += (MONTHLY_RATE * 0.50);
                }
                portfolio.cashUSD += (MONTHLY_RATE * 0.50);
            } else {
                // Normalzustand: 80% SPY, 15% DFNS, 5% BTC (HODL!)
                portfolio.shares['SPY'] += (MONTHLY_RATE * 0.80) / dayPrices['SPY'];
                portfolio.shares['DFNS.L'] += (MONTHLY_RATE * 0.15) / dayPrices['DFNS.L'];
                portfolio.shares['BTC-USD'] += (MONTHLY_RATE * 0.05) / dayPrices['BTC-USD'];
            }

            lastMonth = currentMonth;
        }

        // NOTFALL-STECKER LOGIK
        if (!isEmergencyActive && isMacroRed) {
            // AKTIVIERUNG DES NOTFALL-SCHUTZSCHILDS
            isEmergencyActive = true;
            emergencyTriggerCount++;

            // Berechne Gesamtwert aller Positionen
            const totalStockValue =
                portfolio.shares['SPY'] * dayPrices['SPY'] +
                portfolio.shares['DFNS.L'] * dayPrices['DFNS.L'] +
                portfolio.shares['BTC-USD'] * dayPrices['BTC-USD'] +
                portfolio.cashUSD;

            // Alles zu 100% liquidieren
            portfolio.shares['SPY'] = 0;
            portfolio.shares['DFNS.L'] = 0;
            portfolio.shares['BTC-USD'] = 0;
            portfolio.cashUSD = 0;

            // 50% in Gold (GLD) & 50% in Cash
            const goldCapital = totalStockValue * 0.50;
            const cashCapital = totalStockValue * 0.50;

            if (dayPrices['GLD']) {
                portfolio.shares['GLD'] = goldCapital / dayPrices['GLD'];
            } else {
                portfolio.cashUSD += goldCapital;
            }
            portfolio.cashUSD += cashCapital;

            console.log(`[${date}] 🚨 NOTFALL-STECKER AKTIVIERT! Evakuierung von $${totalStockValue.toFixed(2)} in 50% Gold & 50% Cash.`);
        } else if (isEmergencyActive && isNetLiqRecovered) {
            // RE-ENTRY: Makro entspannt sich wieder (NetLiq >= 0%)
            isEmergencyActive = false;

            // Gesamtes Kapital aus Gold & Cash berechnen
            const totalEmergencyValue =
                portfolio.shares['GLD'] * (dayPrices['GLD'] || 0) +
                portfolio.cashUSD;

            portfolio.shares['GLD'] = 0;
            portfolio.cashUSD = 0;

            // Reinvestition exakt in die Ziel-Allokation: 80% SPY, 15% DFNS, 5% BTC
            const spyAlloc = totalEmergencyValue * 0.80;
            const dfnsAlloc = totalEmergencyValue * 0.15;
            const btcAlloc = totalEmergencyValue * 0.05;

            portfolio.shares['SPY'] = spyAlloc / dayPrices['SPY'];
            portfolio.shares['DFNS.L'] = dfnsAlloc / dayPrices['DFNS.L'];
            portfolio.shares['BTC-USD'] = btcAlloc / dayPrices['BTC-USD'];

            console.log(`[${date}] 🟢 RE-ENTRY DURCHGEFÜHRT! Reinvestition von $${totalEmergencyValue.toFixed(2)} in 80% SPY, 15% DFNS, 5% BTC.`);
        }

        // Bewertung
        let currentStratVal = portfolio.cashUSD +
            portfolio.shares['SPY'] * dayPrices['SPY'] +
            portfolio.shares['DFNS.L'] * dayPrices['DFNS.L'] +
            portfolio.shares['BTC-USD'] * dayPrices['BTC-USD'] +
            portfolio.shares['GLD'] * (dayPrices['GLD'] || 0);

        let currentBnhVal =
            buyAndHoldPortfolio.shares['SPY'] * dayPrices['SPY'] +
            buyAndHoldPortfolio.shares['DFNS.L'] * dayPrices['DFNS.L'] +
            buyAndHoldPortfolio.shares['BTC-USD'] * dayPrices['BTC-USD'];

        let currentSpyVal = spyBenchmark.shares * dayPrices['SPY'];

        historySnapshots.push({
            date,
            stratVal: currentStratVal,
            bnhVal: currentBnhVal,
            spyVal: currentSpyVal,
            deposited: totalDeposited
        });
    }

    const lastSnap = historySnapshots[historySnapshots.length - 1];
    const finalDate = lastSnap.date;
    const finalPrices = dateMap[finalDate];

    console.log('\n' + '-'.repeat(80));
    console.log('ERGEBNISSE DER SATELLITE CORE-SATELLITE SIMULATION (2023 - 2026):');
    console.log('-'.repeat(80));
    console.log(`Gesamteinzahlung:            $ ${totalDeposited.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
    console.log(`Depot-Endwert (Satellite):  $ ${lastSnap.stratVal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${((lastSnap.stratVal - totalDeposited) / totalDeposited * 100).toFixed(2)} %)`);
    console.log(`Depot-Endwert (B&H 80/15/5): $ ${lastSnap.bnhVal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${((lastSnap.bnhVal - totalDeposited) / totalDeposited * 100).toFixed(2)} %)`);
    console.log(`Depot-Endwert (100% SPY):    $ ${lastSnap.spyVal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (+${((lastSnap.spyVal - totalDeposited) / totalDeposited * 100).toFixed(2)} %)`);
    console.log('-'.repeat(80));
    console.log(`Alpha vs. SPY Benchmark:    +${(((lastSnap.stratVal - totalDeposited) / totalDeposited * 100) - ((lastSnap.spyVal - totalDeposited) / totalDeposited * 100)).toFixed(2)} %-Punkte`);
    console.log(`Notfall-Stecker Aktivierungen: ${emergencyTriggerCount}x`);

    // Aktuelle Allokation am Ende ausgeben
    const spyVal = portfolio.shares['SPY'] * finalPrices['SPY'];
    const dfnsVal = portfolio.shares['DFNS.L'] * finalPrices['DFNS.L'];
    const btcVal = portfolio.shares['BTC-USD'] * finalPrices['BTC-USD'];
    const goldVal = portfolio.shares['GLD'] * (finalPrices['GLD'] || 0);
    const totalVal = spyVal + dfnsVal + btcVal + goldVal + portfolio.cashUSD;

    console.log('\nAKTUELLES PORTFOLIO AM ENDE DER LAUFZEIT:');
    console.log(`* SPY (Core S&P 500)    : $ ${spyVal.toFixed(2)} (${(spyVal / totalVal * 100).toFixed(2)} %)`);
    console.log(`* DFNS (Defense ETF)    : $ ${dfnsVal.toFixed(2)} (${(dfnsVal / totalVal * 100).toFixed(2)} %)`);
    console.log(`* BTC-USD (Bitcoin HODL): $ ${btcVal.toFixed(2)} (${(btcVal / totalVal * 100).toFixed(2)} %)`);
    if (goldVal > 0) console.log(`* GLD (Gold Schutz)     : $ ${goldVal.toFixed(2)} (${(goldVal / totalVal * 100).toFixed(2)} %)`);
    if (portfolio.cashUSD > 0) console.log(`* Cash (USD)            : $ ${portfolio.cashUSD.toFixed(2)} (${(portfolio.cashUSD / totalVal * 100).toFixed(2)} %)`);
    console.log('='.repeat(80));
}

runSatelliteSimulation().catch(console.error);
