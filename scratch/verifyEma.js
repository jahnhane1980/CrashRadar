import 'dotenv/config';
import { AnalysisRepository } from '../src/core/repositories/AnalysisRepository.js';

function calculateEMA(prices, period) {
    const emaArr = new Array(prices.length).fill(null);
    const multiplier = 2 / (period + 1);
    
    // Berechne den ersten SMA als Startpunkt für den EMA
    let sum = 0;
    let count = 0;
    for (let i = 0; i < prices.length; i++) {
        if (prices[i] !== null) {
            sum += prices[i];
            count++;
            if (count === period) {
                emaArr[i] = sum / period;
                break;
            }
        }
    }
    
    // Berechne den Rest als EMA
    for (let i = period; i < prices.length; i++) {
        if (prices[i] !== null && emaArr[i-1] !== null) {
            emaArr[i] = (prices[i] - emaArr[i-1]) * multiplier + emaArr[i-1];
        } else if (prices[i] !== null) {
            // Falls aus irgendeinem Grund eine Lücke war, nutze weiter den letzten EMA
            // (Einfaches Fallback)
            let lastValidEma = null;
            for(let j = i-1; j>=0; j--) { if (emaArr[j] !== null) { lastValidEma = emaArr[j]; break; } }
            if (lastValidEma) {
                emaArr[i] = (prices[i] - lastValidEma) * multiplier + lastValidEma;
            }
        }
    }
    return emaArr;
}

async function run() {
    console.log("Loading data from Database (from 1999)...");
    const dbUrl = process.env.DATABASE_URL;
    const repo = new AnalysisRepository(dbUrl);
    
    // Hole Daten weit genug zurück
    const rawData = await repo.getAllRawData('1999-01-01');
    const tiingo = rawData.tiingo;
    
    const datesSet = new Set(tiingo.map(d => new Date(d.date).toISOString().split('T')[0]));
    const dates = Array.from(datesSet).sort();
    
    console.log(`Loaded ${dates.length} days of data.`);
    
    const spyPrices = [];
    const qqqPrices = [];
    
    let lastSpy = null;
    let lastQqq = null;
    
    for (const d of dates) {
        const rowSpy = tiingo.find(x => x.symbol === 'SPY' && new Date(x.date).toISOString().split('T')[0] === d);
        if (rowSpy) lastSpy = rowSpy.close;
        spyPrices.push(lastSpy);
        
        const rowQqq = tiingo.find(x => x.symbol === 'QQQ' && new Date(x.date).toISOString().split('T')[0] === d);
        if (rowQqq) lastQqq = rowQqq.close;
        qqqPrices.push(lastQqq);
    }
    
    const spyEMA200 = calculateEMA(spyPrices, 200);
    const qqqEMA200 = calculateEMA(qqqPrices, 200);
    
    // Historische Crash-Peaks aus der Analyse.md
    const crashPeaks = [
        { name: "Dotcom-Blase", date: "2000-03-24", asset: "SPY" }, // SPY Peak
        { name: "Dotcom-Blase (QQQ)", date: "2000-03-09", asset: "QQQ" }, // QQQ Peak (9. März)
        { name: "Finanzkrise", date: "2007-10-09", asset: "SPY" },
        { name: "Zins-Panik", date: "2018-09-20", asset: "SPY" },
        { name: "Corona-Crash", date: "2020-02-19", asset: "SPY" },
        { name: "Inflations-Schock (SPY)", date: "2022-01-03", asset: "SPY" },
        { name: "Inflations-Schock (QQQ)", date: "2021-11-19", asset: "QQQ" },
        { name: "Tech-Crash", date: "2025-02-19", asset: "SPY" }
    ];
    
    console.log("\n--- Überprüfung: Distanz zum 200-Tage EMA bei Crash-Tops ---");
    
    for (const peak of crashPeaks) {
        // Finde den Index des Datums (oder den nächstgelegenen vorherigen Handelstag)
        let idx = dates.findIndex(d => d === peak.date);
        if (idx === -1) {
            // Suche den letzten gültigen Handelstag vor diesem Datum
            for (let i = dates.length - 1; i >= 0; i--) {
                if (dates[i] <= peak.date) {
                    idx = i;
                    break;
                }
            }
        }
        
        if (idx !== -1 && idx >= 200) {
            const dateStr = dates[idx];
            let distSpy = null;
            let distQqq = null;
            
            if (spyPrices[idx] && spyEMA200[idx]) {
                distSpy = ((spyPrices[idx] - spyEMA200[idx]) / spyEMA200[idx]) * 100;
            }
            if (qqqPrices[idx] && qqqEMA200[idx]) {
                distQqq = ((qqqPrices[idx] - qqqEMA200[idx]) / qqqEMA200[idx]) * 100;
            }
            
            console.log(`\nCrash: ${peak.name} (Top: ${dateStr})`);
            if (distSpy !== null) console.log(`  SPY: Price=${spyPrices[idx].toFixed(2)}, EMA200=${spyEMA200[idx].toFixed(2)}, Distanz = ${distSpy.toFixed(2)}%`);
            if (distQqq !== null) console.log(`  QQQ: Price=${qqqPrices[idx].toFixed(2)}, EMA200=${qqqEMA200[idx].toFixed(2)}, Distanz = ${distQqq.toFixed(2)}%`);
            
            // Haben wir einen False Negative (> 7.5%)?
            if (distSpy > 7.5) {
                console.log(`  ⚠️ WARNUNG: SPY war > 7.5% über dem EMA200! Ein Filter hätte dieses Top ignoriert.`);
            }
            if (distQqq > 8.0) {
                console.log(`  ⚠️ WARNUNG: QQQ war > 8.0% über dem EMA200! Ein Filter hätte dieses Top ignoriert.`);
            }
        } else {
            console.log(`\nCrash: ${peak.name} (Top: ${peak.date}) -> Keine ausreichenden historischen Daten gefunden (Zu nah am Start 1999 oder Datum existiert nicht).`);
        }
    }

    await repo.close();
}

run().catch(console.error);
