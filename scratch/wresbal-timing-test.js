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

const events = [
    { name: "Repo-Krise", focus: "2019-09-18", range: 30 },
    { name: "Corona-Crash", focus: "2020-03-23", range: 30 },
    { name: "SVB Bank Run", focus: "2023-03-15", range: 30 },
    { name: "April-Dip 2026", focus: "2026-04-10", range: 30 }
];

console.log("=== WRESBAL vs SP500 TIMING ANALYSE ===");

for (const ev of events) {
    console.log(`\n--- ${ev.name} (Fokus: ${ev.focus}) ---`);
    const start = new Date(ev.focus);
    start.setDate(start.getDate() - ev.range);
    const end = new Date(ev.focus);
    end.setDate(end.getDate() + ev.range);
    
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    // Wir filtern nur Mittwoche (FRED WRESBAL Release Tag) oder markante Punkte
    let lastWresbal = -1;
    for (const t of timeline) {
        if (t.date >= startStr && t.date <= endStr) {
            // Nur ausgeben, wenn WRESBAL sich ändert (wird mittwochs aktualisiert)
            if (t.WRESBAL !== lastWresbal) {
                console.log(`${t.date} | SP500: $${t.SP500.toFixed(2).padStart(7)} | WRESBAL: ${(t.WRESBAL/1000).toFixed(1).padStart(6)} B | Delta: ${lastWresbal === -1 ? '0.0' : ((t.WRESBAL - lastWresbal)/1000).toFixed(1)} B`);
                lastWresbal = t.WRESBAL;
            }
        }
    }
}
