import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_BASE = path.resolve(__dirname, '../../../data/cache/sec_13f');
const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const GURU_INFO = {
    '0001541617': { name: 'Brad Gerstner', short: 'Gerstner', fund: 'Altimeter', role: 'SCOUT' },
    '0001135730': { name: 'Philippe Laffont', short: 'Laffont', fund: 'Coatue', role: 'SCOUT' },
    '0001167483': { name: 'Chase Coleman', short: 'Coleman', fund: 'Tiger Global', role: 'SCOUT' },
    '0001536411': { name: 'Stanley Druckenmiller', short: 'Druckenmiller', fund: 'Duquesne', role: 'GUARDIAN' },
    '0001509842': { name: 'Zach Schreiber', short: 'Schreiber', fund: 'PointState', role: 'GUARDIAN' },
    '0001656456': { name: 'David Tepper', short: 'Tepper', fund: 'Appaloosa', role: 'GUARDIAN' }
};

async function getDailyHistory(ticker, startDate, endDate) {
    try {
        const res = await yf.historical(ticker, {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        });
        return res || [];
    } catch (e) {
        console.warn(`Fehler bei ${ticker}:`, e.message);
        return [];
    }
}

function calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

function calculateRSI(prices, period = 14) {
    if (prices.length <= period) return null;
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) {
            avgGain = (avgGain * (period - 1) + diff) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) - diff) / period;
        }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

async function run() {
    console.log("================================================================================");
    console.log("  TEIL 1: HAT ES GE VERNOVA (GEV) JE INS PORTFOLIO GESCHAFFT?");
    console.log("================================================================================\n");

    const duquesneDir = path.join(CACHE_BASE, '0001536411');
    const quarters = fs.readdirSync(duquesneDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort();

    // Suche GEV in allen 13F Filings (CUSIP: 36828A101 oder Name)
    console.log("Suche nach GE Vernova (GEV) in allen Quartalen...\n");
    const gevHoldersByQ = {};
    for (const q of quarters) {
        for (const [cik, info] of Object.entries(GURU_INFO)) {
            const p = path.join(CACHE_BASE, cik, `${q}.json`);
            if (!fs.existsSync(p)) continue;
            const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
            for (const h of raw) {
                const isGev = h.cusip === '36828A101' || (h.issuer_name && h.issuer_name.toUpperCase().includes('VERNOVA'));
                if (isGev) {
                    if (!gevHoldersByQ[q]) gevHoldersByQ[q] = [];
                    gevHoldersByQ[q].push({
                        guru: info.name,
                        fund: info.fund,
                        role: info.role,
                        shares: Number(h.shares) || 0,
                        valUSD: (Number(h.value) || 0) * 1000,
                        putCall: h.put_call
                    });
                }
            }
        }
    }

    for (const [q, holders] of Object.entries(gevHoldersByQ)) {
        console.log(`• Quartal ${q}:`);
        for (const h of holders) {
            console.log(`   - ${h.guru} (${h.fund}, ${h.role}): ${h.shares.toLocaleString()} Shares (~$${(h.valUSD / 1e6).toFixed(1)}M), Type: ${h.putCall}`);
        }
    }

    console.log("\nWarum schaffte es GEV in den Simulationen rein oder nicht?");
    console.log("- Sektor-Fokus: Im ursprünglichen Regelwerk v2.0/v2.1 war der Sektor strikt auf 'TECHNOLOGY' beschränkt.");
    console.log("- GEV ist unter GICS gelistet als 'Industrials / Electrical Equipment' (KI-Power & Energie-Infrastruktur).");
    console.log("- In Version 3.0: Wie behandeln wir Power/Infrastructure für KI-Datencenter (GEV, CEG, ETN)?\n");

    console.log("================================================================================");
    console.log("  TEIL 2: WAS HATTEN DIE GETRIMMTEN AKTIEN CHARTTECHNISCH GEMEINSAM?");
    console.log("  Untersuchung von AMD, MU, SE, UBER, GOOGL, NFLX, NVDA zum Zeitpunkt des Trimmens");
    console.log("================================================================================\n");

    const casesToInspect = [
        { ticker: 'AMD', date: '2024-03-31', event: 'Tepper trimmt AMD massiv nach KI-Rallye' },
        { ticker: 'AMD', date: '2024-06-30', event: 'Tepper trimmt AMD erneut' },
        { ticker: 'MU', date: '2019-09-30', event: 'Druckenmiller trimmt Micron nach Rebound' },
        { ticker: 'MU', date: '2020-12-31', event: 'Tepper trimmt Micron nach Zyklushoch' },
        { ticker: 'SE', date: '2021-12-31', event: 'Druckenmiller trimmt Sea Ltd vor dem Crash' },
        { ticker: 'GOOGL', date: '2021-03-31', event: 'Druckenmiller/Tepper/Schreiber trimmen GOOGL' },
        { ticker: 'NFLX', date: '2021-12-31', event: 'Schreiber trimmt Netflix vor 2022 Absturz' },
        { ticker: 'NVDA', date: '2024-03-31', event: 'Druckenmiller trimmt 72% seiner NVDA-Position' },
        { ticker: 'UBER', date: '2025-06-30', event: 'Tepper trimmt Uber nach Plattform-Allzeithoch' }
    ];

    console.log("Lade tägliche Kursdaten & berechne Indikatoren (SMA50, SMA200, RSI, Distanz zum SMA200)...\n");

    console.log("------------------------------------------------------------------------------------------------------------------------");
    console.log(" Ticker | Datum      | Kurs    | SMA50   | SMA200  | vs SMA200 | vs SMA50 | RSI(14) | Chart-Zustand");
    console.log("------------------------------------------------------------------------------------------------------------------------");

    for (const item of casesToInspect) {
        // Lade Historie bis zum Datum
        const endDate = new Date(item.date);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 365); // 1 Jahr Historie für SMA200

        const hist = await getDailyHistory(
            item.ticker,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        if (!hist || hist.length < 50) {
            console.log(` ${item.ticker.padEnd(6)} | ${item.date} | Keine ausreichenden Kursdaten.`);
            continue;
        }

        const closes = hist.map(h => h.close).filter(c => c !== null && c !== undefined);
        const currentPrice = closes[closes.length - 1];
        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200) || calculateSMA(closes, closes.length); // fallback
        const rsi = calculateRSI(closes, 14);

        const diff200Pct = sma200 ? ((currentPrice - sma200) / sma200 * 100) : 0;
        const diff50Pct = sma50 ? ((currentPrice - sma50) / sma50 * 100) : 0;

        // Bestimme Chart-Signatur
        let status = [];
        if (currentPrice > sma200) status.push("WEIT ÜBER SMA200");
        else status.push("UNTER SMA200");

        if (currentPrice < sma50) status.push("UNTER SMA50 (Knick)");
        else status.push("ÜBER SMA50");

        if (rsi > 70) status.push("RSI > 70 (Overbought)");
        else if (rsi < 45) status.push("RSI Schwäche (<45)");

        if (diff200Pct > 40) status.push("PARABOLISCH (>+40% über 200er)");

        console.log(` ${item.ticker.padEnd(6)} | ${item.date} | $${currentPrice.toFixed(1).padEnd(6)} | $${sma50.toFixed(1).padEnd(6)} | $${sma200.toFixed(1).padEnd(6)} | ${(diff200Pct >= 0 ? '+' : '') + diff200Pct.toFixed(1) + '%'}    | ${(diff50Pct >= 0 ? '+' : '') + diff50Pct.toFixed(1) + '%'}   | ${rsi.toFixed(1).padEnd(7)} | ${status.join(', ')}`);
    }

    console.log("------------------------------------------------------------------------------------------------------------------------\n");
}

run().catch(console.error);
