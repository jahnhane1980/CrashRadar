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

    // 1. WALCL (Fed Assets)
    const [walcl] = await pool.query(`
        SELECT observation_date as date, value 
        FROM econ_fred 
        WHERE series_id = 'WALCL' AND observation_date >= ?
        ORDER BY observation_date ASC
    `, [startDate]);

    // 2. RRPONTSYD (Reverse Repo in Billions)
    const [rrp] = await pool.query(`
        SELECT observation_date as date, value 
        FROM econ_fred 
        WHERE series_id = 'RRPONTSYD' AND observation_date >= ?
        ORDER BY observation_date ASC
    `, [startDate]);

    // 3. T10Y2Y (10Y-2Y Yield Curve)
    const [t10y2y] = await pool.query(`
        SELECT observation_date as date, value 
        FROM econ_fred 
        WHERE series_id = 'T10Y2Y' AND observation_date >= ?
        ORDER BY observation_date ASC
    `, [startDate]);

    await pool.end();

    // 4. WTREGEN (TGA from FRED API directly for 100% coverage in Millions)
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

async function runSimulation() {
    console.log("================================================================================");
    console.log("   CRASHRADAR: 7-SLOT GURU-KONSENS STRATEGIE – PROOF OF CONCEPT SIMULATION");
    console.log("   Zeitraum: 01.01.2023 bis heute | Startkapital: 10.000 € | Sparrate: 150 €/Monat");
    console.log("================================================================================\n");

    const startDate = '2023-01-01';
    const endDate = '2026-09-06';
    const techSymbols = ['MSFT', 'AMZN', 'GOOGL', 'META', 'TSM', 'NVDA', 'NOW'];
    const benchmarkSymbol = 'QQQ';
    const goldSymbol = 'GLD';
    const fxSymbol = 'EURUSD=X';

    // 1. Daten holen
    const symbols = [...techSymbols, benchmarkSymbol, goldSymbol, fxSymbol];
    const prices = await getHistoricalPrices(symbols, '2022-10-01', endDate);
    const macro = await getMacroData('2022-10-01');

    console.log("Daten erfolgreich geladen. Berechne Net Fed Liquidity & Zeitreihe...");

    // Tägliche FX-Map aufbauen
    const fxMap = {};
    for (const q of prices[fxSymbol] || []) {
        fxMap[q.date] = q.close;
    }

    // Tägliche Preis-Maps
    const priceMaps = {};
    for (const sym of symbols) {
        priceMaps[sym] = {};
        for (const q of prices[sym] || []) {
            priceMaps[sym][q.date] = q.close;
        }
    }

    // Wöchentliche Net Fed Liquidity berechnen
    // WALCL ist mittwochs, WTREGEN mittwochs, RRP täglich.
    // NL = WALCL - WTREGEN - RRP * 1000
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
        const netLiq = walclVal - tgaVal - (rrpVal * 1000); // Alles in Millionen USD
        weeklyNL.push({ date: d, netLiq });
    }

    // 8-Wochen-Delta der Net Liquidity berechnen
    const nlDeltaMap = {};
    for (let i = 8; i < weeklyNL.length; i++) {
        const curr = weeklyNL[i];
        const prev8 = weeklyNL[i - 8];
        const deltaPct = (curr.netLiq - prev8.netLiq) / prev8.netLiq;
        nlDeltaMap[curr.date] = deltaPct;
    }

    // Alle Handelstage von 2023-01-01 bis endDate
    const tradingDates = (prices['QQQ'] || [])
        .map(q => q.date)
        .filter(d => d >= startDate && d <= endDate);

    // Initialisierung Portfolio & Benchmark
    let cashEUR = 10000;
    const portfolio = {
        shares: {}, // { symbol: shareCount }
        goldShares: 0
    };
    for (const s of techSymbols) portfolio.shares[s] = 0;

    let benchmarkShares = 0;
    let totalInvestedEUR = 10000;

    // Simulationstracking
    let goldGuardActive = false;
    let goldGuardEvents = [];
    const monthlyHistory = [];
    const transactions = [];

    // Pfad A Einstieg: 10.000 € in 3 Monatstranchen
    // Tranche 1: Jan 2023, Tranche 2: Feb 2023, Tranche 3: März 2023
    const initialTranches = [
        { date: '2023-01-03', amountEUR: 3333.33 },
        { date: '2023-02-01', amountEUR: 3333.33 },
        { date: '2023-03-01', amountEUR: 3333.34 }
    ];

    let lastMonth = '';
    let currentNlDelta = 0;

    // Finde das jeweils neueste NL-Delta für jeden Handelstag
    let lastKnownNlDelta = 0;
    const nlDates = Object.keys(nlDeltaMap).sort();

    for (const date of tradingDates) {
        const eurUsd = fxMap[date] || 1.08;

        // Neuestes bekanntes NL-Delta aktualisieren
        for (const nld of nlDates) {
            if (nld <= date) lastKnownNlDelta = nlDeltaMap[nld];
            else break;
        }

        // ==========================================
        // 1. MACRO REBALANCING: 25 % GOLD-GUARD
        // ==========================================
        if (!goldGuardActive && lastKnownNlDelta < -0.05) {
            goldGuardActive = true;
            const event = { date, type: 'GOLD_GUARD_ACTIVATED', delta: (lastKnownNlDelta * 100).toFixed(2) };
            goldGuardEvents.push(event);
            transactions.push(`[${date}] 🛡️ GOLD-GUARD AKTIVIERT (Net Liquidity 8W-Delta: ${event.delta}%)`);

            // Aus allen 7 Slots werden pauschal 25 % verkauft und in Gold umgeschichtet
            let goldCapitalUSD = 0;
            for (const sym of techSymbols) {
                const pUSD = priceMaps[sym][date];
                if (pUSD && portfolio.shares[sym] > 0) {
                    const sellShares = portfolio.shares[sym] * 0.25;
                    portfolio.shares[sym] -= sellShares;
                    goldCapitalUSD += sellShares * pUSD;
                }
            }

            const pGold = priceMaps[goldSymbol][date];
            if (pGold && goldCapitalUSD > 0) {
                const boughtGold = goldCapitalUSD / pGold;
                portfolio.goldShares += boughtGold;
                transactions.push(`       -> Umschichtung: $${goldCapitalUSD.toFixed(0)} (~€${(goldCapitalUSD / eurUsd).toFixed(0)}) in ${boughtGold.toFixed(2)} GLD-Anteile`);
            }
        } else if (goldGuardActive && lastKnownNlDelta >= 0.0) {
            // HYSTERESE: Deaktivierung erst bei Delta >= 0.0 %
            goldGuardActive = false;
            const event = { date, type: 'GOLD_GUARD_DEACTIVATED', delta: (lastKnownNlDelta * 100).toFixed(2) };
            goldGuardEvents.push(event);
            transactions.push(`[${date}] 🚀 GOLD-GUARD DEAKTIVIERT (Net Liquidity erholt auf ${event.delta}%)`);

            // Gold vollständig verkaufen und auf die 7 Slots gleichmäßig aufteilen
            const pGold = priceMaps[goldSymbol][date];
            if (pGold && portfolio.goldShares > 0) {
                const goldProceedsUSD = portfolio.goldShares * pGold;
                portfolio.goldShares = 0;

                const perSlotUSD = goldProceedsUSD / techSymbols.length;
                for (const sym of techSymbols) {
                    const pUSD = priceMaps[sym][date];
                    if (pUSD) {
                        portfolio.shares[sym] += perSlotUSD / pUSD;
                    }
                }
                transactions.push(`       -> Reinvestition: $${goldProceedsUSD.toFixed(0)} (~€${(goldProceedsUSD / eurUsd).toFixed(0)}) gleichmäßig in die 7 Tech-Slots reinvestiert`);
            }
        }

        // ==========================================
        // 2. TRANCHEN-KÄUFE (Startkapital)
        // ==========================================
        for (const tranche of initialTranches) {
            if (date === tranche.date || (date > tranche.date && !tranche.executed)) {
                tranche.executed = true;
                const trancheUSD = tranche.amountEUR * eurUsd;
                const perSlotUSD = trancheUSD / techSymbols.length;

                transactions.push(`[${date}] 📥 TRANCHE INVESTIERT: €${tranche.amountEUR.toFixed(2)} ($${trancheUSD.toFixed(2)})`);
                for (const sym of techSymbols) {
                    const pUSD = priceMaps[sym][date];
                    if (pUSD) {
                        const bought = perSlotUSD / pUSD;
                        portfolio.shares[sym] += bought;
                    }
                }

                // Benchmark Tranche (QQQ)
                const pQQQ = priceMaps[benchmarkSymbol][date];
                if (pQQQ) {
                    benchmarkShares += trancheUSD / pQQQ;
                }
            }
        }

        // ==========================================
        // 3. MONATLICHER SPARPLAN: 150 €
        // ==========================================
        const currentMonth = date.substring(0, 7);
        if (currentMonth !== lastMonth) {
            lastMonth = currentMonth;
            // Erster Handelstag des Monats
            const sparEUR = 150;
            totalInvestedEUR += sparEUR;
            const sparUSD = sparEUR * eurUsd;

            // Benchmark Sparplan
            const pQQQ = priceMaps[benchmarkSymbol][date];
            if (pQQQ) benchmarkShares += sparUSD / pQQQ;

            if (goldGuardActive) {
                // 75 % Tech / 25 % Gold
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
                // 100 % Tech gleichmäßig auf 7 Slots
                const perSlotUSD = sparUSD / techSymbols.length;
                for (const sym of techSymbols) {
                    const pUSD = priceMaps[sym][date];
                    if (pUSD) portfolio.shares[sym] += perSlotUSD / pUSD;
                }
            }
        }

        // Am Monatsende bzw. aktuellen Stichtag Werte aufzeichnen
        // Snapshot für Jahresenden und heute
        if (date === '2023-12-29' || date === '2024-12-31' || date === '2025-12-31' || date === tradingDates[tradingDates.length - 1]) {
            let totalValueUSD = 0;
            for (const sym of techSymbols) {
                totalValueUSD += portfolio.shares[sym] * (priceMaps[sym][date] || 0);
            }
            totalValueUSD += portfolio.goldShares * (priceMaps[goldSymbol][date] || 0);
            const totalValueEUR = totalValueUSD / eurUsd;

            const benchmarkValUSD = benchmarkShares * (priceMaps[benchmarkSymbol][date] || 0);
            const benchmarkValEUR = benchmarkValUSD / eurUsd;

            monthlyHistory.push({
                date,
                totalInvestedEUR,
                portfolioValueEUR: totalValueEUR,
                benchmarkValueEUR: benchmarkValEUR,
                profitEUR: totalValueEUR - totalInvestedEUR,
                returnPct: ((totalValueEUR - totalInvestedEUR) / totalInvestedEUR) * 100,
                benchmarkReturnPct: ((benchmarkValEUR - totalInvestedEUR) / totalInvestedEUR) * 100
            });
        }
    }

    // ==========================================
    // ERGEBNIS-AUSWERTUNG
    // ==========================================
    const lastDate = tradingDates[tradingDates.length - 1];
    const lastEurUsd = fxMap[lastDate] || 1.08;

    console.log("--------------------------------------------------------------------------------");
    console.log("1. WICHTIGE TRANSAKTIONEN & REBALANCING-HISTORIE:");
    console.log("--------------------------------------------------------------------------------");
    for (const t of transactions) {
        console.log(t);
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("2. JÄHRLICHE PORTFOLIO-ENTWICKLUNG (vs. QQQ BENCHMARK):");
    console.log("--------------------------------------------------------------------------------");
    console.log("Stichtag    | Eingezahlt  | Depotwert (7-Slot) | Gewinn (7-Slot) | Rendite 7-Slot | Rendite QQQ");
    console.log("------------+-------------+--------------------+-----------------+----------------+------------");
    for (const h of monthlyHistory) {
        console.log(
            `${h.date}  | ` +
            `€${h.totalInvestedEUR.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).padStart(9)} | ` +
            `€${h.portfolioValueEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(16)} | ` +
            `+€${h.profitEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(13)} | ` +
            `+${h.returnPct.toFixed(2).padStart(12)} % | ` +
            `+${h.benchmarkReturnPct.toFixed(2).padStart(8)} %`
        );
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log(`3. AKTUELLES PORTFOLIO (STAND: ${lastDate})`);
    console.log("--------------------------------------------------------------------------------");
    let totalCurrentEUR = 0;
    const holdingsSummary = [];

    for (const sym of techSymbols) {
        const shares = portfolio.shares[sym];
        const pUSD = priceMaps[sym][lastDate] || 0;
        const valUSD = shares * pUSD;
        const valEUR = valUSD / lastEurUsd;
        totalCurrentEUR += valEUR;
        holdingsSummary.push({
            symbol: sym,
            shares: shares.toFixed(2),
            priceUSD: pUSD.toFixed(2),
            valueEUR: valEUR
        });
    }

    const goldValUSD = portfolio.goldShares * (priceMaps[goldSymbol][lastDate] || 0);
    const goldValEUR = goldValUSD / lastEurUsd;
    totalCurrentEUR += goldValEUR;

    for (const h of holdingsSummary) {
        const weight = (h.valueEUR / totalCurrentEUR) * 100;
        console.log(`* ${h.symbol.padEnd(6)}: ${h.shares.padStart(8)} Stk. à $${h.priceUSD.padStart(8)} | Wert: €${h.valueEUR.toFixed(2).padStart(10)} (${weight.toFixed(2)} %)`);
    }
    if (portfolio.goldShares > 0) {
        const gWeight = (goldValEUR / totalCurrentEUR) * 100;
        console.log(`* GOLD (GLD): ${portfolio.goldShares.toFixed(2).padStart(6)} Stk. à $${(priceMaps[goldSymbol][lastDate]).toFixed(2).padStart(8)} | Wert: €${goldValEUR.toFixed(2).padStart(10)} (${gWeight.toFixed(2)} %) [Hedge Aktiv]`);
    } else {
        console.log(`* GOLD (GLD): 0.00 Stk. (Aktuell kein Liquiditäts-Alarm, 100 % Tech besetzt)`);
    }

    const finalSnapshot = monthlyHistory[monthlyHistory.length - 1];
    console.log("--------------------------------------------------------------------------------");
    console.log(`GESAMTDEPOTWERT:      € ${totalCurrentEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`EINGEZAHLTES KAPITAL: € ${totalInvestedEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (10.000 € Start + ${((totalInvestedEUR - 10000)/150)} Sparraten à 150 €)`);
    console.log(`NETTO-GEWINN:         € ${(totalCurrentEUR - totalInvestedEUR).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${(((totalCurrentEUR - totalInvestedEUR)/totalInvestedEUR)*100).toFixed(2)} %)`);
    console.log(`VERGLEICH QQQ BUY&HOLD: € ${finalSnapshot.benchmarkValueEUR.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${finalSnapshot.benchmarkReturnPct.toFixed(2)} %)`);
    console.log(`ALPHA vs. BENCHMARK:  +${((((totalCurrentEUR - totalInvestedEUR)/totalInvestedEUR)*100) - finalSnapshot.benchmarkReturnPct).toFixed(2)} %-Punkte Überrendite!`);
    console.log("================================================================================\n");

    process.exit(0);
}

runSimulation().catch(err => {
    console.error("Fehler in Simulation:", err);
    process.exit(1);
});
