import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const CACHE_DIR = path.resolve(__dirname, 'data_cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

async function getQuotes(symbol) {
    const file = path.join(CACHE_DIR, `${symbol}_daily.json`);
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    console.log(`[PRICES] Lade ${symbol}...`);
    try {
        const res = await yahooFinance.chart(symbol, { period1: '2016-01-01', period2: '2026-09-10' });
        const quotes = (res.quotes || [])
            .filter(q => q.date && q.close !== null && q.volume !== null)
            .map(q => ({
                date: (typeof q.date === 'string' ? new Date(q.date) : q.date).toISOString().split('T')[0],
                close: q.close,
                volume: q.volume
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
        fs.writeFileSync(file, JSON.stringify(quotes, null, 2));
        return quotes;
    } catch (e) {
        console.error(`Fehler bei ${symbol}:`, e.message);
        return [];
    }
}

function getPerf(quotes, startDate, endDate) {
    const startQ = quotes.find(q => q.date >= startDate);
    const endQ = quotes.find(q => q.date >= endDate) || quotes[quotes.length - 1];
    if (!startQ || !endQ) return null;
    return ((endQ.close - startQ.close) / startQ.close) * 100;
}

function findMaxDrawdown(quotes, startDate, endDate) {
    const subset = quotes.filter(q => q.date >= startDate && q.date <= endDate);
    if (subset.length === 0) return null;
    let max = subset[0].close;
    let maxDd = 0;
    for (const q of subset) {
        if (q.close > max) max = q.close;
        const dd = ((q.close - max) / max) * 100;
        if (dd < maxDd) maxDd = dd;
    }
    return maxDd;
}

async function run() {
    console.log("==========================================================================================================");
    console.log("   EMPIRISCHE UNTERSUCHUNG: COMPUTE (NVDA/SMH) vs. SENSORIK, AUTOMATION & DEFENSE HARDWARE");
    console.log("==========================================================================================================\n");

    const symbols = [
        // Compute / Semis
        { sym: 'NVDA', cat: 'AI Compute / GPU' },
        { sym: 'SMH', cat: 'Semiconductor ETF' },
        // Sensors & Analog
        { sym: 'ADI', cat: 'Analog / Sensors / Industrial' },
        { sym: 'TXN', cat: 'Analog Chips / Embedded' },
        { sym: 'CGNX', cat: 'Machine Vision / Sensors / Automation' },
        // Defense & Autonomous Hardware
        { sym: 'AVAV', cat: 'Defense Drones / Tactical Sensors' },
        { sym: 'KTOS', cat: 'Defense Autonomous / Radar' },
        // Robotics & Automation
        { sym: 'TER', cat: 'Robotics (Universal Robots) & Semi Test' },
        { sym: 'ISRG', cat: 'Medical Robotics' }
    ];

    const data = {};
    for (const item of symbols) {
        data[item.sym] = await getQuotes(item.sym);
    }

    // Define 3 key stress phases:
    // Phase 1: 2018 Crash (Oct 2018 to Dec 2018 - NVDA crypto/datacenter crash)
    // Phase 2: 2022 Full Year (Zinswende, QT & Ukraine-Krieg)
    // Phase 3: 2023 - 2026 AI Bull Market
    const phases = [
        {
            name: "1. KRYPTO / DATACENTER CRASH 2018 (2018-10-01 bis 2018-12-24)",
            start: "2018-10-01",
            end: "2018-12-24",
            note: "NVDA crasht um -56% wegen Krypto-Kater. Was machte der Rest?"
        },
        {
            name: "2. DER GROSSE 2022 CRASH (2021-11-01 bis 2022-10-14)",
            start: "2021-11-01",
            end: "2022-10-14",
            note: "Zinswende, Fed QT, Beginn Ukraine-Krieg. Entkopplung von Defense?"
        },
        {
            name: "3. DER AI-BOOM (2023-01-01 bis 2026-09-09)",
            start: "2023-01-01",
            end: "2026-09-09",
            note: "Haben Sensorik und Robotik mitgehalten oder wurde nur Compute gekauft?"
        }
    ];

    for (const ph of phases) {
        console.log(`----------------------------------------------------------------------------------------------------------`);
        console.log(`PHASE: ${ph.name}`);
        console.log(`Kontext: ${ph.note}`);
        console.log(`----------------------------------------------------------------------------------------------------------`);
        console.log(`Ticker | Kategorie                                 | Performance | Max Drawdown im Zeitraum`);
        console.log(`----------------------------------------------------------------------------------------------------------`);

        for (const item of symbols) {
            const quotes = data[item.sym];
            if (!quotes || quotes.length === 0) continue;
            const perf = getPerf(quotes, ph.start, ph.end);
            const dd = findMaxDrawdown(quotes, ph.start, ph.end);
            const perfStr = perf !== null ? ((perf >= 0 ? '+' : '') + perf.toFixed(1) + '%').padStart(11) : '       N/A';
            const ddStr = dd !== null ? (dd.toFixed(1) + '%').padStart(11) : '       N/A';
            console.log(`${item.sym.padEnd(6)} | ${item.cat.padEnd(41)} | ${perfStr} | ${ddStr}`);
        }
        console.log("");
    }
}

run().catch(e => console.error(e));
