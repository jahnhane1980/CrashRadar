import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'tmp_data');
const OUT_FILE = path.join(__dirname, 'Indicator-Backtest-Log.md');

// .env laden, falls dotenv installiert ist (für FRED_API_KEY)
const ROOT_DIR = path.resolve(__dirname, '..');
try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.join(ROOT_DIR, '.env') });
} catch (e) {}
const FRED_API_KEY = process.env.FRED_API_KEY;

// Hilfsfunktion: JSON laden
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

// FiscalData TGA laden
function loadTgaData() {
    let tgaData = [];
    const files = ['fiscaldata_tga.json', 'fiscaldata_tga_recent.json'];
    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        if (fs.existsSync(filePath)) {
            try {
                const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (raw.data) {
                    const filtered = raw.data
                        .filter(o => o.account_type && (o.account_type.includes('Federal Reserve Account') || o.account_type.includes('Treasury General Account') || o.account_type.includes('Treasury General Account (TGA) Closing Balance')))
                        .map(o => ({ date: o.record_date, value: parseFloat(o.close_today_bal) }));
                    tgaData = tgaData.concat(filtered);
                }
            } catch (e) {}
        }
    }
    const unique = {};
    for (const item of tgaData) {
        unique[item.date] = item;
    }
    return Object.values(unique).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// SP500 holen, falls nicht vorhanden
async function ensureSP500() {
    const spFile = path.join(DATA_DIR, 'fred_sp500.json');
    if (fs.existsSync(spFile)) return;
    console.log("⬇️ Fetching SP500 from FRED...");
    if (!FRED_API_KEY) {
        console.warn("⚠️ Kein FRED_API_KEY gefunden. Kann SP500 nicht laden.");
        return;
    }
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=SP500&api_key=${FRED_API_KEY}&file_type=json&observation_start=2006-01-01`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        fs.writeFileSync(spFile, JSON.stringify(data, null, 2));
        console.log("💾 SP500 gespeichert.");
    } catch (e) {
        console.error("❌ Fehler bei SP500 fetch:", e.message);
    }
}

// Forward-Fill Funktion für Master-Kalender
function createTimeline(datasets) {
    const timeline = {};
    // Alle Daten sammeln
    for (const key of Object.keys(datasets)) {
        for (const row of datasets[key]) {
            if (!timeline[row.date]) timeline[row.date] = {};
            timeline[row.date][key] = row.value;
        }
    }
    
    // In Array umwandeln und sortieren
    const dates = Object.keys(timeline).sort();
    const result = [];
    let lastVals = { TGA: 0, WRESBAL: 0, WALCL: 0, BORROW: 0, RRP: 0, SP500: 0 };
    
    for (const date of dates) {
        // Forward fill
        for (const key of Object.keys(lastVals)) {
            if (timeline[date][key] !== undefined) {
                lastVals[key] = timeline[date][key];
            }
        }
        // Kopie der aktuellen Werte speichern
        result.push({ date, ...lastVals });
    }
    return result;
}

// Haupt-Logik
async function runBacktest() {
    await ensureSP500();

    console.log("Lade Datensätze...");
    const datasets = {
        TGA: loadTgaData(),
        WRESBAL: loadFredData('fred_wresbal.json'),
        WALCL: loadFredData('fred_walcl.json'),
        BORROW: loadFredData('fred_borrow.json'),
        RRP: loadFredData('fred_rrpontsyd.json'),
        SP500: loadFredData('fred_sp500.json')
    };

    const timeline = createTimeline(datasets);
    
    // Den State-Machine Report bauen
    let report = `# Backtest: Fiscal-FED-Indicator vs SP500 (2006 - Heute)\n\n`;
    report += `Dieses Skript simuliert das K-Faktor-Radar Tag für Tag und dokumentiert jeden Phasen-Wechsel.\n\n`;
    report += `| Datum | SP500 | Phase | Auslöser (Trigger) | TGA | WALCL | BORROW | WRESBAL | RRP |\n`;
    report += `|---|---|---|---|---|---|---|---|---|\n`;

    let currentState = 0; // 0=Normal, 1=Warnung, 2=Crash, 3=Kapitulation, 4=Rettung
    let stateNames = ["🟢 NORMAL", "🟡 1. WARNUNG", "🔴 2. CRASH", "🚨 3. KAPITULATION", "🟩 4. RETTUNG"];
    
    // Hilfsfunktion für historischen Wert X Tage zurück
    function getValAgo(currentIndex, daysBack, key) {
        // Wir suchen den Index, dessen Datum ca. daysBack zurückliegt
        const targetDate = new Date(timeline[currentIndex].date);
        targetDate.setDate(targetDate.getDate() - daysBack);
        const targetStr = targetDate.toISOString().split('T')[0];
        
        // Finde den nächsten Index
        for (let i = currentIndex; i >= 0; i--) {
            if (timeline[i].date <= targetStr) return timeline[i][key];
        }
        return timeline[0][key];
    }

    let lastLogStr = "";

    for (let i = 0; i < timeline.length; i++) {
        const t = timeline[i];
        if (i < 90) continue; // Wir brauchen 90 Tage Historie für Deltas
        
        // Deltas berechnen
        const tga_90d = t.TGA - getValAgo(i, 90, 'TGA');
        const wresbal_56d = t.WRESBAL - getValAgo(i, 56, 'WRESBAL');
        const rrp_30d = t.RRP - getValAgo(i, 30, 'RRP');
        const walcl_14d = t.WALCL - getValAgo(i, 14, 'WALCL');
        
        // Logik aus Fiscal-FED-Indicator.md
        let newState = 0;
        let trigger = "";

        // Prio 1: Rettung (WALCL > +50B) -> Override
        if (walcl_14d > 50000) {
            newState = 4;
            trigger = `WALCL +${(walcl_14d/1000).toFixed(1)}B (Stealth QE)`;
        } 
        // Prio 2: Kapitulation (BORROW > 5B)
        else if (t.BORROW > 5000) {
            newState = 3;
            trigger = `BORROW = ${(t.BORROW/1000).toFixed(1)}B (Panik)`;
        }
        // Prio 3: Crash Startet (RRP > +100B)
        else if (rrp_30d > 100000) {
            newState = 2;
            trigger = `RRP +${(rrp_30d/1000).toFixed(1)}B (Drain)`;
        }
        // Prio 4: Warnung (TGA > +150B OR WRESBAL < -100B)
        else if (tga_90d > 150000) {
            newState = 1;
            trigger = `TGA +${(tga_90d/1000).toFixed(1)}B (Staubsauger)`;
        }
        else if (wresbal_56d < -100000) {
            newState = 1;
            trigger = `Reserves -${(Math.abs(wresbal_56d)/1000).toFixed(1)}B (QT)`;
        }

        // Wenn sich der Status ändert, ins Log schreiben
        if (newState !== currentState) {
            // Um Spam zu vermeiden, nur schreiben, wenn es sich wirklich um eine relevante Änderung handelt
            // (z.B. nicht jeden Tag zwischen 0 und 1 flippen)
            const logStr = `| ${t.date} | **$${t.SP500.toFixed(2)}** | **${stateNames[newState]}** | ${trigger || '-'} | ${(t.TGA/1000).toFixed(1)}B | ${(t.WALCL/1000).toFixed(1)}B | ${(t.BORROW/1000).toFixed(1)}B | ${(t.WRESBAL/1000).toFixed(1)}B | ${(t.RRP/1000).toFixed(1)}B |`;
            
            // Verhindern, dass identische Logs (nur weil WALCL jeden Tag +50B auswirft) gespammt werden
            // Wir loggen nur bei einem harten Phasenübergang.
            report += logStr + "\n";
            currentState = newState;
        }
    }

    fs.writeFileSync(OUT_FILE, report);
    console.log(`✅ Backtest abgeschlossen! Ergebnis gespeichert unter: ${OUT_FILE}`);
}

runBacktest();
