import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'tmp_data');
const OUT_FILE = path.join(__dirname, 'Indicator-Recent-6-Months.md');

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
    let lastVals = { TGA: 0, WRESBAL: 0, WALCL: 0, BORROW: 0, RRP: 0, SP500: 0 };
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

function runBacktest() {
    const datasets = {
        TGA: loadTgaData(),
        WRESBAL: loadFredData('fred_wresbal.json'),
        WALCL: loadFredData('fred_walcl.json'),
        BORROW: loadFredData('fred_borrow.json'),
        RRP: loadFredData('fred_rrpontsyd.json'),
        SP500: loadFredData('fred_sp500.json')
    };

    const timeline = createTimeline(datasets);
    
    let report = `# K-Faktor-Radar: Die letzten 6 Monate (Jan 2026 - Heute)\n\n`;
    report += `Dieses Skript zeigt den wöchentlichen Status der Liquidität und den daraus resultierenden Phasen-Zustand.\n\n`;
    report += `| Datum | SP500 | Phase | Auslöser (Trigger) | TGA | WALCL | BORROW | WRESBAL | RRP |\n`;
    report += `|---|---|---|---|---|---|---|---|---|\n`;

    let stateNames = ["🟢 NORMAL", "🟡 1. WARNUNG", "🔴 2. CRASH", "🚨 3. KAPITULATION", "🟩 4. RETTUNG"];
    
    function getValAgo(currentIndex, daysBack, key) {
        const targetDate = new Date(timeline[currentIndex].date);
        targetDate.setDate(targetDate.getDate() - daysBack);
        const targetStr = targetDate.toISOString().split('T')[0];
        for (let i = currentIndex; i >= 0; i--) {
            if (timeline[i].date <= targetStr) return timeline[i][key];
        }
        return timeline[0][key];
    }

    // Start-Datum für die letzten 6 Monate (z.B. ab 01.01.2026)
    let lastPrintedWeek = "";

    for (let i = 0; i < timeline.length; i++) {
        const t = timeline[i];
        if (t.date < '2026-01-01') continue; 
        
        // Nur ca. 1x pro Woche ausgeben, um es lesbar zu halten
        const weekStr = t.date.substring(0, 7) + '-' + Math.floor(new Date(t.date).getDate() / 7);
        if (weekStr === lastPrintedWeek) continue;
        lastPrintedWeek = weekStr;

        const tga_90d = t.TGA - getValAgo(i, 90, 'TGA');
        const wresbal_56d = t.WRESBAL - getValAgo(i, 56, 'WRESBAL');
        const rrp_30d = t.RRP - getValAgo(i, 30, 'RRP');
        const walcl_14d = t.WALCL - getValAgo(i, 14, 'WALCL');
        
        let newState = 0;
        let trigger = "-";

        if (walcl_14d > 50000) {
            newState = 4;
            trigger = `WALCL +${(walcl_14d/1000).toFixed(1)}B`;
        } else if (t.BORROW > 5000) {
            newState = 3;
            trigger = `BORROW = ${(t.BORROW/1000).toFixed(1)}B`;
        } else if (rrp_30d > 100000) {
            newState = 2;
            trigger = `RRP +${(rrp_30d/1000).toFixed(1)}B`;
        } else if (tga_90d > 150000) {
            newState = 1;
            trigger = `TGA +${(tga_90d/1000).toFixed(1)}B`;
        } else if (wresbal_56d < -100000) {
            newState = 1;
            trigger = `Reserves -${(Math.abs(wresbal_56d)/1000).toFixed(1)}B`;
        }

        const logStr = `| ${t.date} | **$${t.SP500.toFixed(2)}** | **${stateNames[newState]}** | ${trigger} | ${(t.TGA/1000).toFixed(1)}B | ${(t.WALCL/1000).toFixed(1)}B | ${(t.BORROW/1000).toFixed(1)}B | ${(t.WRESBAL/1000).toFixed(1)}B | ${(t.RRP/1000).toFixed(1)}B |`;
        report += logStr + "\n";
    }

    fs.writeFileSync(OUT_FILE, report);
    console.log(`✅ Bericht für die letzten 6 Monate erstellt: ${OUT_FILE}`);
}

runBacktest();
