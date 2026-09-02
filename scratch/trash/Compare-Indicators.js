import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

// Importiere beide Indikatoren
import { PanicCapitulationIndicator } from '../../src/analysis/indicators/PanicCapitulationIndicator.js';
import { MarketPanicCapitulationIndicator } from '../../src/analysis/indicators/MarketPanicCapitulationIndicator.js';

const yahooFinance = new YahooFinance();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cboeFilePath = path.resolve(__dirname, '../../data/archive/cboe/SPY_1999-12-01_to_2026-06-27.csv');

async function runComparison() {
    console.log('========================================================');
    console.log('   BATTLE: PanicCapitulation vs MarketPanicCapitulation');
    console.log('========================================================\n');

    // 1. CBOE Daten einlesen
    console.log(`Lese CBOE-Volumendaten...`);
    const cboeLines = fs.readFileSync(cboeFilePath, 'utf8').split('\n').filter(l => l.trim().length > 0);
    const volumeMap = {};
    for (let i = 1; i < cboeLines.length; i++) {
        const parts = cboeLines[i].split(',');
        if (parts.length >= 6) {
            const rawDate = parts[0].replace(/\//g, '-');
            const volume = parseFloat(parts[5]);
            if (!isNaN(volume)) volumeMap[rawDate] = (volumeMap[rawDate] || 0) + volume;
        }
    }

    // 2. Yahoo Finance SPY (inkl. Volumen) & VIX
    const startDate = '2007-01-01';
    const endDate = '2026-07-07';
    console.log(`Hole SPY & ^VIX Daten von Yahoo Finance (${startDate} bis ${endDate})...`);
    let spyRaw, vixRaw;
    try {
        spyRaw = await yahooFinance.historical('SPY', { period1: startDate, period2: endDate, interval: '1d' });
        vixRaw = await yahooFinance.historical('^VIX', { period1: startDate, period2: endDate, interval: '1d' });
    } catch (err) {
        console.error('Fehler:', err.message);
        return;
    }

    const spyMap = {};
    spyRaw.forEach(d => {
        const dStr = d.date.toISOString().split('T')[0];
        spyMap[dStr] = { close: d.close, volume: d.volume };
    });

    const vixMap = {};
    vixRaw.forEach(d => {
        const dStr = d.date.toISOString().split('T')[0];
        vixMap[dStr] = d.close;
    });

    // 3. Timeline für die Indikatoren aufbauen
    const dates = Object.keys(spyMap).sort();
    const fullTimeline = [];

    for (const date of dates) {
        if (vixMap[date] !== undefined) {
            // Mock-Format für die Indikatoren
            fullTimeline.push({
                date,
                assets: {
                    SPY: spyMap[date].close,
                    SPY_Volume: spyMap[date].volume,
                    VIX: vixMap[date],
                    CBOE_SPY: volumeMap[date] || 0
                }
            });
        }
    }

    console.log(`✅ Daten zusammengeführt: ${fullTimeline.length} Handelstage.`);

    // 4. Instanziieren
    const goodIndicator = new PanicCapitulationIndicator();
    const badIndicator = new MarketPanicCapitulationIndicator();

    const goodSignals = [];
    const badSignals = [];

    // 5. Simulation Tag für Tag
    console.log(`\nSimuliere Timeline Tag für Tag...\n`);
    for (let i = 100; i < fullTimeline.length; i++) {
        const currentSlice = fullTimeline.slice(0, i + 1);
        const currentDate = fullTimeline[i].date;
        
        const goodRes = goodIndicator.evaluate(currentSlice);
        if (goodRes && goodRes.status === 'CRITICAL') {
            goodSignals.push({ date: currentDate, message: goodRes.message });
        }

        const badRes = badIndicator.evaluate(currentSlice);
        if (badRes && badRes.status === 'CRITICAL') {
            badSignals.push({ date: currentDate, message: badRes.message });
        }
    }

    console.log('========================================================');
    console.log('   ERGEBNISSE: PanicCapitulationIndicator (CBOE+RSI)');
    console.log('========================================================');
    console.log(`Gefundene CRITICAL Signale: ${goodSignals.length}`);
    goodSignals.forEach(s => console.log(`[${s.date}] ${s.message}`));

    console.log('\n========================================================');
    console.log('   ERGEBNISSE: MarketPanicCapitulationIndicator (SPY_Vol)');
    console.log('========================================================');
    console.log(`Gefundene CRITICAL Signale: ${badSignals.length}`);
    badSignals.forEach(s => console.log(`[${s.date}] ${s.message}`));
}

runComparison();
