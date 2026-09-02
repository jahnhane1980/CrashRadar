import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfade definieren
const cboeFilePath = path.resolve(__dirname, '../../data/archive/cboe/SPY_1999-12-01_to_2026-06-27.csv');

async function runBottomBacktest() {
    console.log('========================================================');
    console.log('   STARTING CBOE-VIX-RSI BOTTOM-FINDER BACKTEST');
    console.log('========================================================\n');

    // 1. CBOE Options-Volumen einlesen
    console.log(`Lese CBOE-Volumendaten aus ${path.basename(cboeFilePath)}...`);
    if (!fs.existsSync(cboeFilePath)) {
        console.error(`❌ Fehler: Datei ${cboeFilePath} existiert nicht.`);
        return;
    }

    const cboeLines = fs.readFileSync(cboeFilePath, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const volumeMap = {};
    // Header überspringen
    for (let i = 1; i < cboeLines.length; i++) {
        const parts = cboeLines[i].split(',');
        if (parts.length >= 6) {
            const rawDate = parts[0]; // Format: "2007/01/03"
            const normalizedDate = rawDate.replace(/\//g, '-');
            const volume = parseFloat(parts[5]);
            if (!isNaN(volume)) {
                volumeMap[normalizedDate] = (volumeMap[normalizedDate] || 0) + volume;
            }
        }
    }

    const cboeDates = Object.keys(volumeMap).sort();
    console.log(`✅ ${cboeDates.length} Tage CBOE-Volumendaten geladen. Range: ${cboeDates[0]} bis ${cboeDates[cboeDates.length - 1]}`);

    // 2. SPY & VIX Daten von Yahoo Finance laden
    const startDate = '2007-01-01';
    const endDate = '2026-07-07';

    console.log(`\nHole SPY & ^VIX Daten von Yahoo Finance (${startDate} bis ${endDate})...`);
    let spyRaw, vixRaw;
    try {
        spyRaw = await yahooFinance.historical('SPY', { period1: startDate, period2: endDate, interval: '1d' });
        vixRaw = await yahooFinance.historical('^VIX', { period1: startDate, period2: endDate, interval: '1d' });
    } catch (err) {
        console.error('❌ Fehler beim Abrufen der Yahoo Finance Daten:', err.message);
        return;
    }

    // Map raw data by date
    const spyMap = {};
    spyRaw.forEach(d => {
        const dStr = d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date);
        if (d.close !== null && d.close !== undefined) {
            spyMap[dStr] = {
                close: d.close,
                open: d.open,
                high: d.high,
                low: d.low
            };
        }
    });

    const vixMap = {};
    vixRaw.forEach(d => {
        const dStr = d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date);
        if (d.close !== null && d.close !== undefined) {
            vixMap[dStr] = d.close;
        }
    });

    // 3. Zusammenführen und Metriken berechnen
    const mergedData = [];
    const allDates = Object.keys(spyMap).sort();

    for (const date of allDates) {
        if (vixMap[date] !== undefined) {
            mergedData.push({
                date,
                spyClose: spyMap[date].close,
                spyOpen: spyMap[date].open,
                spyHigh: spyMap[date].high,
                spyLow: spyMap[date].low,
                vixClose: vixMap[date],
                cboeVol: volumeMap[date] || 0
            });
        }
    }

    console.log(`✅ Daten zusammengeführt: ${mergedData.length} Handelstage.`);

    // 4. RSI(14) auf SPY berechnen
    calculateRsi(mergedData, 14);

    // 5. CBOE-Optionen 20-Tage MA und Ratio berechnen
    calculateCboeMa(mergedData, 20);

    // 6. Bullische RSI Divergenzen identifizieren
    detectDivergences(mergedData);

    // 7. Backtest ausführen
    runBacktestAnalysis(mergedData);
}

function calculateRsi(data, period) {
    let gains = 0;
    let losses = 0;

    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            data[i].rsi = null;
            continue;
        }

        const diff = data[i].spyClose - data[i - 1].spyClose;
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        if (i <= period) {
            gains += gain;
            losses += loss;
            if (i === period) {
                const avgGain = gains / period;
                const avgLoss = losses / period;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                data[i].rsi = 100 - (100 / (1 + rs));
                data[i].avgGain = avgGain;
                data[i].avgLoss = avgLoss;
            } else {
                data[i].rsi = null;
            }
        } else {
            const prevAvgGain = data[i - 1].avgGain;
            const prevAvgLoss = data[i - 1].avgLoss;
            const avgGain = (prevAvgGain * (period - 1) + gain) / period;
            const avgLoss = (prevAvgLoss * (period - 1) + loss) / period;
            data[i].avgGain = avgGain;
            data[i].avgLoss = avgLoss;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            data[i].rsi = 100 - (100 / (1 + rs));
        }
    }
}

function calculateCboeMa(data, period) {
    for (let i = 0; i < data.length; i++) {
        if (i < period) {
            data[i].cboeVolMA = null;
            data[i].cboeVolRatio = null;
            continue;
        }

        // MA berechnen über die VERGANGENEN 'period' Tage (ohne den aktuellen Tag)
        let sum = 0;
        for (let j = i - period; j < i; j++) {
            sum += data[j].cboeVol;
        }
        const ma = sum / period;
        data[i].cboeVolMA = ma;
        data[i].cboeVolRatio = ma > 0 ? data[i].cboeVol / ma : 0;
    }
}

function detectDivergences(data) {
    for (let i = 0; i < data.length; i++) {
        data[i].rsiDiv = null;
        if (i < 35 || data[i].rsi === null || data[i].rsi > 40) {
            continue;
        }

        const currentRsi = data[i].rsi;
        const currentPrice = data[i].spyClose;
        const currentLow = data[i].spyLow;

        // Suche nach einem Tiefpunkt (Trough) im RSI in den letzten 5 bis 30 Tagen
        for (let j = i - 5; j >= i - 30; j--) {
            if (j < 2) continue;
            const prevRsi = data[j].rsi;
            if (prevRsi === null || prevRsi > 35) continue;

            // Pivot-Low-Bedingung: RSI an Tag j ist ein lokales Minimum
            const isPivotLow = data[j].rsi <= data[j - 1].rsi &&
                               data[j].rsi <= data[j - 2].rsi &&
                               data[j].rsi <= data[j + 1].rsi &&
                               data[j].rsi <= data[j + 2].rsi;

            if (!isPivotLow) continue;

            const prevPrice = data[j].spyClose;
            const prevLow = data[j].spyLow;

            // Bullische Divergenz:
            // Preis erreicht tieferes Tief (Close oder Daily Low), aber RSI ist höher
            const priceLower = currentPrice < prevPrice || currentLow < prevLow;
            const rsiHigher = currentRsi > prevRsi;

            if (priceLower && rsiHigher) {
                data[i].rsiDiv = {
                    troughDate: data[j].date,
                    troughRsi: prevRsi,
                    troughPrice: prevPrice
                };
                break; // Erstes gefundenes valides Tief reicht
            }
        }
    }

    // Kennzeichnen, ob in den letzten 5 Tagen eine Divergenz aufgetreten ist
    for (let i = 0; i < data.length; i++) {
        let hasRecentDiv = false;
        let divInfo = null;
        for (let k = Math.max(0, i - 5); k <= i; k++) {
            if (data[k].rsiDiv) {
                hasRecentDiv = true;
                divInfo = data[k].rsiDiv;
                break;
            }
        }
        data[i].hasRecentRsiDiv = hasRecentDiv;
        data[i].recentRsiDivInfo = divInfo;
    }
}

function runBacktestAnalysis(data) {
    const horizons = [5, 20, 60, 120];

    // Wir definieren verschiedene Signalgruppen
    const signals = [
        {
            name: 'VIX > 35 (Volatilitäts-Panic)',
            filter: d => d.vixClose > 35,
            results: []
        },
        {
            name: 'CBOE Options-Volumen Spike > 1.5x',
            filter: d => d.cboeVolRatio !== null && d.cboeVolRatio > 1.5,
            results: []
        },
        {
            name: 'RSI Divergenz (Bullisch, 5d Window)',
            filter: d => d.hasRecentRsiDiv === true,
            results: []
        },
        {
            name: 'KOMBI-SIGNAL (VIX > 35 AND CBOE > 1.5x AND RSI Div)',
            filter: d => d.vixClose > 35 && d.cboeVolRatio !== null && d.cboeVolRatio > 1.5 && d.hasRecentRsiDiv === true,
            results: []
        },
        {
            name: 'KOMBI-SIGNAL OPTIMIERT (VIX > 30 AND CBOE > 1.3x AND RSI Div)',
            filter: d => d.vixClose > 30 && d.cboeVolRatio !== null && d.cboeVolRatio > 1.3 && d.hasRecentRsiDiv === true,
            results: []
        }
    ];

    // Signale sammeln und Performance messen
    for (const sig of signals) {
        for (let i = 0; i < data.length; i++) {
            if (sig.filter(data[i])) {
                // Forward Returns und Drawdowns messen
                const performance = {};
                for (const h of horizons) {
                    if (i + h < data.length) {
                        const currentClose = data[i].spyClose;
                        const futureClose = data[i + h].spyClose;
                        const ret = ((futureClose - currentClose) / currentClose) * 100;

                        // Max Drawdown (tiefster Low-Punkt relativ zum Einstiegskurs)
                        let minLow = currentClose;
                        for (let k = i + 1; k <= i + h; k++) {
                            if (data[k].spyLow < minLow) {
                                minLow = data[k].spyLow;
                            }
                        }
                        const maxDd = ((minLow - currentClose) / currentClose) * 100;

                        performance[h] = { return: ret, drawdown: maxDd };
                    } else {
                        performance[h] = null;
                    }
                }

                sig.results.push({
                    date: data[i].date,
                    close: data[i].spyClose,
                    vix: data[i].vixClose,
                    cboeRatio: data[i].cboeVolRatio,
                    rsi: data[i].rsi,
                    performance
                });
            }
        }
    }

    // Ergebnisse ausgeben
    console.log('========================================================');
    console.log('   BACKTEST ERGEBNISSE: BOTTOM-FINDER VERGLEICH');
    console.log('========================================================');

    for (const sig of signals) {
        console.log(`\n📊 Signalgruppe: ${sig.name}`);
        console.log(`   Generierte Signale: ${sig.results.length}`);

        if (sig.results.length === 0) {
            console.log('   ❌ Keine Signale gefunden.');
            continue;
        }

        // Details der ersten paar Signale
        console.log('   Top Signale (Beispiele):');
        const sampleSignals = sig.results.slice(0, 8);
        sampleSignals.forEach(s => {
            console.log(`    - Datum: ${s.date} | SPY: ${s.close.toFixed(2)} | VIX: ${s.vix.toFixed(2)} | CBOE Ratio: ${s.cboeRatio ? s.cboeRatio.toFixed(2) : 'N/A'} | RSI: ${s.rsi ? s.rsi.toFixed(1) : 'N/A'}`);
        });

        if (sig.results.length > 8) {
            console.log(`    - ...und ${sig.results.length - 8} weitere Signale.`);
        }

        console.log('\n   Metriken pro Zeithorizont:');
        for (const h of horizons) {
            let totalValid = 0;
            let winCount = 0;
            let returnSum = 0;
            let maxDdSum = 0;

            for (const res of sig.results) {
                const perf = res.performance[h];
                if (perf !== null) {
                    totalValid++;
                    returnSum += perf.return;
                    maxDdSum += perf.drawdown;
                    if (perf.return > 0) {
                        winCount++;
                    }
                }
            }

            const winRate = totalValid > 0 ? (winCount / totalValid) * 100 : 0;
            const avgReturn = totalValid > 0 ? returnSum / totalValid : 0;
            const avgMaxDd = totalValid > 0 ? maxDdSum / totalValid : 0;

            console.log(
                `    👉 ${String(h).padStart(3, ' ')}-Tage Horizont: ` +
                `Win Rate = ${winRate.toFixed(1)}% (${winCount}/${totalValid}) | ` +
                `Avg Return = ${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(2)}% | ` +
                `Avg Max Drawdown = ${avgMaxDd.toFixed(2)}%`
            );
        }
    }

    console.log('\n========================================================');
    console.log('   ENDE DES BACKTESTS');
    console.log('========================================================');
}

runBottomBacktest();
