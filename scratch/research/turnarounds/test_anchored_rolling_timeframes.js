import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

// Load daily price candles from cache (Yahoo 10y dataset)
function getDailyQuotes(symbol) {
    const file = path.join(CACHE_DIR, `${symbol}_daily.json`);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Load aggregated M5 RTH data if available
function getM5Daily(symbol) {
    const file = path.join(CACHE_DIR, `${symbol.toLowerCase()}_m5_rth_aggregated.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function analyzeAnchoredRollingBlocks(symbol, breakoutDate, exitDate = null) {
    console.log(`\n================================================================================`);
    console.log(`   ANCHORED ROLLING TIMEFRAMES AB AUSBRUCH ($t_0$): ${symbol}`);
    console.log(`   Ausbruchsdatum: ${breakoutDate} ${exitDate ? `(bis Exit: ${exitDate})` : ''}`);
    console.log(`================================================================================`);

    const quotes = getDailyQuotes(symbol);
    const m5Data = getM5Daily(symbol);
    const m5Map = new Map();
    if (m5Data) {
        m5Data.forEach(d => m5Map.set(d.date, d));
    }

    const startIdx = quotes.findIndex(q => q.date >= breakoutDate);
    if (startIdx === -1) {
        console.log(`Startdatum ${breakoutDate} nicht gefunden!`);
        return;
    }

    const endIdx = exitDate 
        ? quotes.findIndex(q => q.date >= exitDate) 
        : quotes.length - 1;
    const runQuotes = quotes.slice(startIdx, (endIdx === -1 ? quotes.length : endIdx + 1));

    const t0Price = runQuotes[0].close;
    console.log(`$t_0$ Startkurs: $${t0Price.toFixed(2)} am ${runQuotes[0].date}. Gesamte Handelstage im Ritt: ${runQuotes.length}\n`);

    // -------------------------------------------------------------------------
    // A. Rollierende 5D-Blöcke (Echte Handelswochen ab Ausbruch, unbeeinflusst vom Wochentag)
    // -------------------------------------------------------------------------
    const blocks5D = [];
    const blockSize = 5; // 5 Handelstage

    for (let i = 0; i < runQuotes.length; i += blockSize) {
        const chunk = runQuotes.slice(i, i + blockSize);
        if (chunk.length === 0) continue;

        const open = chunk[0].open;
        const close = chunk[chunk.length - 1].close;
        const high = Math.max(...chunk.map(c => c.high));
        const low = Math.min(...chunk.map(c => c.low));
        const totalVol = chunk.reduce((s, c) => s + c.volume, 0);
        const pnlFromT0 = ((close - t0Price) / t0Price) * 100;
        const pnlBlock = ((close - open) / open) * 100;

        // M5 Delta sum if available
        let openDeltaSum = 0;
        let closeDeltaSum = 0;
        let m5DaysCount = 0;
        for (const c of chunk) {
            const m = m5Map.get(c.date);
            if (m) {
                openDeltaSum += m.openWindow.deltaPct;
                closeDeltaSum += m.closeWindow.deltaPct;
                m5DaysCount++;
            }
        }

        blocks5D.push({
            blockNum: Math.floor(i / blockSize) + 1,
            startDate: chunk[0].date,
            endDate: chunk[chunk.length - 1].date,
            days: chunk.length,
            close,
            pnlBlock: parseFloat(pnlBlock.toFixed(1)),
            pnlFromT0: parseFloat(pnlFromT0.toFixed(1)),
            volumeMio: parseFloat((totalVol / 1e6).toFixed(1)),
            avgCloseDelta: m5DaysCount > 0 ? parseFloat((closeDeltaSum / m5DaysCount).toFixed(1)) : null
        });
    }

    // Benchmark 1st block volume
    const base5dVol = blocks5D[0].volumeMio;

    console.log(`Auswertung der rollierenden 5-Tage-Blöcke (Anchored Event-Weeks ab ${breakoutDate}):`);
    console.table(blocks5D.slice(0, 15).map(b => ({
        Block: `Woche ${b.blockNum} (${b.startDate} bis ${b.endDate})`,
        Kurs: `$${b.close.toFixed(2)}`,
        'Block-Rendite': `${b.pnlBlock >= 0 ? '+' : ''}${b.pnlBlock} %`,
        'Gesamt ab t0': `+${b.pnlFromT0} %`,
        Volumen: `${b.volumeMio}M (${(b.volumeMio / base5dVol).toFixed(1)}x)`,
        M5_CloseDelta: b.avgCloseDelta !== null ? `${b.avgCloseDelta >= 0 ? '+' : ''}${b.avgCloseDelta} %` : 'n/a'
    })));

    // -------------------------------------------------------------------------
    // B. Rollierende 21D-Blöcke (Echte 1-Monats-Zyklen ab Ausbruch)
    // -------------------------------------------------------------------------
    const blocks21D = [];
    const monthSize = 21; // 21 Handelstage ~ 1 Handelsmonat

    for (let i = 0; i < runQuotes.length; i += monthSize) {
        const chunk = runQuotes.slice(i, i + monthSize);
        if (chunk.length < 5) continue;

        const open = chunk[0].open;
        const close = chunk[chunk.length - 1].close;
        const high = Math.max(...chunk.map(c => c.high));
        const low = Math.min(...chunk.map(c => c.low));
        const totalVol = chunk.reduce((s, c) => s + c.volume, 0);
        const pnlFromT0 = ((close - t0Price) / t0Price) * 100;
        const pnlBlock = ((close - open) / open) * 100;

        blocks21D.push({
            monthNum: Math.floor(i / monthSize) + 1,
            startDate: chunk[0].date,
            endDate: chunk[chunk.length - 1].date,
            close,
            pnlBlock: parseFloat(pnlBlock.toFixed(1)),
            pnlFromT0: parseFloat(pnlFromT0.toFixed(1)),
            volumeMio: parseFloat((totalVol / 1e6).toFixed(1))
        });
    }

    console.log(`\nAuswertung der rollierenden 21-Tage-Blöcke (Anchored Event-Months ab ${breakoutDate}):`);
    console.table(blocks21D.map(b => ({
        Monat: `Monat ${b.monthNum} (${b.startDate} bis ${b.endDate})`,
        Kurs: `$${b.close.toFixed(2)}`,
        'Monats-Rendite': `${b.pnlBlock >= 0 ? '+' : ''}${b.pnlBlock} %`,
        'Gesamt ab t0': `+${b.pnlFromT0} %`,
        Volumen: `${b.volumeMio}M`
    })));

    return { blocks5D, blocks21D };
}

function runTests() {
    // 1. PLTR Welle 1 (Ausbruch 11. April 2023 bis Jan 2024)
    analyzeAnchoredRollingBlocks('PLTR', '2023-04-11', '2024-01-03');

    // 2. PLTR Welle 2 (Ausbruch 26. Februar 2024 bis Feb 2026 Parabolik-Peak)
    analyzeAnchoredRollingBlocks('PLTR', '2024-02-26', '2026-02-04');

    // 3. NVTS Super-Run (Ausbruch 10. Dezember 2025 bis Mai 2026 Peak)
    analyzeAnchoredRollingBlocks('NVTS', '2025-12-10', '2026-05-26');
}

runTests();
