import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'tmp_data');

function loadFredData(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!raw.observations) return [];
        return raw.observations
            .filter(o => o.value !== '.')
            .map(o => ({ date: o.date, value: parseFloat(o.value) }));
    } catch (e) {
        return [];
    }
}

function createTimeline(datasets) {
    const timeline = {};
    for (const key of Object.keys(datasets)) {
        for (const row of datasets[key]) {
            if (!timeline[row.date]) timeline[row.date] = {};
            timeline[row.date][key] = row.value;
        }
    }
    const dates = Object.keys(timeline).sort();
    const result = [];
    let lastVals = { WRESBAL: 0, SP500: 0 };
    for (const date of dates) {
        for (const key of Object.keys(lastVals)) {
            if (timeline[date][key] !== undefined) {
                lastVals[key] = timeline[date][key];
            }
        }
        result.push({ date, ...lastVals });
    }
    return result;
}

const datasets = {
    WRESBAL: loadFredData('fred_wresbal.json') || loadFredData('fred_totresns.json'),
    SP500: loadFredData('fred_sp500.json')
};

const timeline = createTimeline(datasets);

function getIndexByDateOffset(currentIndex, daysOffset) {
    const targetDate = new Date(timeline[currentIndex].date);
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetStr = targetDate.toISOString().split('T')[0];
    
    if (daysOffset > 0) {
        for (let i = currentIndex; i < timeline.length; i++) {
            if (timeline[i].date >= targetStr) return i;
        }
        return timeline.length - 1;
    } else {
        for (let i = currentIndex; i >= 0; i--) {
            if (timeline[i].date <= targetStr) return i;
        }
        return 0;
    }
}

console.log("=== WRESBAL FAILURE TEST (Der umgekehrte Beweis) ===\n");
console.log("Wir suchen nach Momenten, wo WRESBAL massiv geflutet wurde (> +50 Mrd. in 4 Wochen),");
console.log("der Markt aber trotzdem in den darauffolgenden 8 Wochen eingebrochen ist.\n");

let failureCount = 0;
let successCount = 0;
let lastInjectionDate = new Date('2000-01-01');

for (let i = 0; i < timeline.length; i++) {
    const t = timeline[i];
    
    // Nur einmal pro Woche checken
    if (new Date(t.date).getDay() !== 3) continue; 
    
    const idx4WeeksAgo = getIndexByDateOffset(i, -28);
    const wresbal4WeeksAgo = timeline[idx4WeeksAgo].WRESBAL;
    const deltaWresbal = t.WRESBAL - wresbal4WeeksAgo;
    
    // Bedingung: Massive Liquiditäts-Injektion (Größer als +50 Milliarden $)
    if (deltaWresbal >= 50000) {
        
        // Cooldown: Überspringe, wenn wir in den letzten 4 Wochen schon ein Event getrackt haben (um Spam zu vermeiden)
        const currentDate = new Date(t.date);
        const daysSinceLast = (currentDate - lastInjectionDate) / (1000 * 60 * 60 * 24);
        if (daysSinceLast < 28) continue;
        lastInjectionDate = currentDate;

        // Wie reagiert der S&P500 in den NÄCHSTEN 8 Wochen?
        const idx8WeeksAhead = getIndexByDateOffset(i, 56);
        let minSP500 = t.SP500;
        let maxSP500 = t.SP500;
        
        for (let j = i; j <= idx8WeeksAhead; j++) {
            if (timeline[j].SP500 < minSP500) minSP500 = timeline[j].SP500;
            if (timeline[j].SP500 > maxSP500) maxSP500 = timeline[j].SP500;
        }
        
        const drawdownPct = ((minSP500 - t.SP500) / t.SP500) * 100;
        const rallyPct = ((maxSP500 - t.SP500) / t.SP500) * 100;

        // FAILURE Definition: Der Markt bricht trotz der WRESBAL-Spritze um mehr als -5% ein.
        if (drawdownPct <= -5.0) {
            failureCount++;
            console.log(`❌ FAILURE (Versagen der Liquidität):`);
            console.log(`Datum: ${t.date} | WRESBAL-Spritze: +${(deltaWresbal/1000).toFixed(1)} Mrd. $`);
            console.log(`SP500 bei Injektion: $${t.SP500.toFixed(2)}`);
            console.log(`SP500 fiel danach bis auf: $${minSP500.toFixed(2)} (${drawdownPct.toFixed(2)}% Drawdown)`);
            console.log(`--------------------------------------------------`);
        } else {
            successCount++;
            // Nur loggen für extrem krasse Injektionen > 150 Mrd, sonst zu viel Spam
            if (deltaWresbal >= 150000) {
                console.log(`✅ SUCCESS (Boden gefunden):`);
                console.log(`Datum: ${t.date} | WRESBAL-Spritze: +${(deltaWresbal/1000).toFixed(1)} Mrd. $`);
                console.log(`SP500 stieg danach auf bis zu: $${maxSP500.toFixed(2)} (+${rallyPct.toFixed(2)}%)`);
                console.log(`--------------------------------------------------`);
            }
        }
    }
}

console.log(`\n=== ZUSAMMENFASSUNG ===`);
console.log(`Total massive WRESBAL-Injektionen (> 50 Mrd. $): ${successCount + failureCount}`);
console.log(`Erfolgreiche Abwehr (Kein weiterer Absturz > 5%): ${successCount}`);
console.log(`Fehlgeschlagene Abwehr (Markt stürzte trotzdem ab): ${failureCount}`);
