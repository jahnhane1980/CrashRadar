import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.resolve(__dirname, '../../data/archive/Gold-GDX-Performance-Test.csv');

function loadData() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`CSV file not found at ${CSV_PATH}. Bitte stelle sicher, dass die Daten dort liegen.`);
        return [];
    }
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        data.push({
            date: cols[0],
            gdx: parseFloat(cols[1]),
            gold: parseFloat(cols[3])
        });
    }
    return data;
}

function findBottoms(data, crashName, startDate, endDate) {
    const period = data.filter(d => d.date >= startDate && d.date <= endDate);
    if (period.length === 0) return null;

    let goldMin = period[0].gold;
    let goldMinDate = period[0].date;
    let gdxMin = period[0].gdx;
    let gdxMinDate = period[0].date;

    for (const d of period) {
        if (d.gold < goldMin) {
            goldMin = d.gold;
            goldMinDate = d.date;
        }
        if (d.gdx < gdxMin) {
            gdxMin = d.gdx;
            gdxMinDate = d.date;
        }
    }

    return {
        crashName,
        goldMinDate,
        gdxMinDate,
        diffDays: Math.abs(new Date(gdxMinDate) - new Date(goldMinDate)) / (1000 * 60 * 60 * 24),
        gdxFirst: gdxMinDate < goldMinDate,
        goldFirst: goldMinDate < gdxMinDate,
        sameDay: goldMinDate === gdxMinDate
    };
}

function runAnalysis() {
    const data = loadData();
    if (data.length === 0) return;

    console.log("=== BEWEIS-TEST: WER BILDET ZUERST DEN BODEN (STARTET ZUERST)? GOLD ODER GDX? ===\n");

    const crashes = [
        { name: "Finanzkrise (GFC) 2008", start: "2008-08-01", end: "2009-02-01" },
        { name: "Gold Bärenmarkt Tief 2015", start: "2015-08-01", end: "2016-02-01" },
        { name: "Corona Crash 2020", start: "2020-02-15", end: "2020-04-15" },
        { name: "Zins-Schock Tief 2022", start: "2022-08-01", end: "2022-12-01" },
        { name: "Q1 2026 Liquidations-Crash", start: "2026-01-01", end: "2026-04-01" }
    ];

    for (const crash of crashes) {
        const result = findBottoms(data, crash.name, crash.start, crash.end);
        if (result) {
            console.log(`[${result.crashName}]`);
            console.log(`  -> Gold tiefster Punkt: ${result.goldMinDate}`);
            console.log(`  -> GDX tiefster Punkt:  ${result.gdxMinDate}`);
            
            if (result.sameDay) {
                console.log(`  => RESULTAT: Gold und GDX bildeten am selben Tag den Boden!`);
            } else if (result.goldFirst) {
                console.log(`  => RESULTAT: GOLD bildete den Boden ${result.diffDays} Tage VOR GDX!`);
            } else {
                console.log(`  => RESULTAT: GDX bildete den Boden ${result.diffDays} Tage VOR Gold!`);
            }
            console.log("--------------------------------------------------");
        }
    }
}

runAnalysis();
