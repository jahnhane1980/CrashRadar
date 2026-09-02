import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'tmp_data');
const OUT_FILE = path.join(__dirname, 'Crash-Analyzer-Report.md');

const CRASHES = [
    { name: "Finanzkrise 2008", peak: "2007-10-09", trough: "2009-03-09", drop: "-56%" },
    { name: "Zins-Panik 2018", peak: "2018-09-20", trough: "2018-12-24", drop: "-20%" },
    { name: "Corona-Crash 2020", peak: "2020-02-19", trough: "2020-03-23", drop: "-34%" },
    { name: "Inflations-Schock 2022", peak: "2022-01-03", trough: "2022-10-12", drop: "-25%" },
    { name: "Tech-Crash 2025", peak: "2025-02-19", trough: "2025-04-08", drop: "-19%" }
];

function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function loadFredData(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!raw.observations) return null;
        return raw.observations
            .filter(o => o.value !== '.')
            .map(o => ({ date: o.date, value: parseFloat(o.value) }));
    } catch (e) {
        return null;
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

function analyzeWindow(data, startDate, endDate) {
    if (!data || data.length === 0) return { delta: 0, deltaPct: 0, startVal: 0, endVal: 0, maxVal: 0, minVal: 0 };
    
    const windowData = data.filter(d => d.date >= startDate && d.date <= endDate);
    if (windowData.length === 0) return { delta: 0, deltaPct: 0, startVal: 0, endVal: 0, maxVal: 0, minVal: 0 };

    const startVal = windowData[0].value;
    const endVal = windowData[windowData.length - 1].value;
    const maxVal = Math.max(...windowData.map(d => d.value));
    const minVal = Math.min(...windowData.map(d => d.value));
    
    const delta = endVal - startVal;
    const deltaPct = startVal === 0 ? 0 : (delta / startVal) * 100;
    
    return { delta, deltaPct, startVal, endVal, maxVal, minVal };
}

function formatVal(val, unit = "") {
    if (val === 0) return "0";
    if (Math.abs(val) > 1000) return (val / 1000).toFixed(2) + "K" + unit;
    return val.toFixed(2) + unit;
}

function runAnalysis() {
    const datasets = {
        TGA: loadTgaData(),
        OUTLAYS: loadFredData('fred_mtso133fms.json'),
        WALCL: loadFredData('fred_walcl.json'),
        RRP: loadFredData('fred_rrpontsyd.json'),
        WRESBAL: loadFredData('fred_wresbal.json') || loadFredData('fred_totresns.json'),
        BORROW: loadFredData('fred_borrow.json'),
        PSAVERT: loadFredData('fred_psavert.json'),
        USNUM: loadFredData('fred_usnum.json'), // Treasury Securities at Banks
        WAGES: loadFredData('fred_les1252881600q.json'), // Real Wages
        MMF: loadFredData('fred_mmmffaq027s.json') // Money Market Funds
    };

    let report = `# Makro-Crash-Analyse (Vor, Während und Nach dem Absturz)\n\n`;

    for (const crash of CRASHES) {
        report += `## 💥 ${crash.name}\n`;
        report += `**AKTIENMARKT (SPY/QQQ):** Peak am ${crash.peak} ➔ Boden am ${crash.trough} (Drawdown: ${crash.drop})\n\n`;

        const preStart = addDays(crash.peak, -90);
        const postEnd = addDays(crash.trough, 90);

        report += `### 1. DER STAAT (Einnahmen & Ausgaben)\n`;
        const tgaPre = analyzeWindow(datasets.TGA, preStart, crash.peak);
        const tgaCrash = analyzeWindow(datasets.TGA, crash.peak, crash.trough);
        const outlaysCrash = analyzeWindow(datasets.OUTLAYS, crash.peak, postEnd);
        
        report += `- **TGA Konto (Kriegskasse):** Vor dem Crash ${tgaPre.delta > 0 ? 'Gestiegen' : 'Gefallen'} um ${formatVal(tgaPre.delta)} Mio. $ (von ${formatVal(tgaPre.startVal)} auf ${formatVal(tgaPre.endVal)})\n`;
        report += `- **TGA Konto Im Crash:** ${tgaCrash.delta > 0 ? 'Gefüllt' : 'Geleert'} um ${formatVal(tgaCrash.delta)} Mio. $\n`;
        report += `- **Staatsausgaben (Outlays):** Monatliche Ausgaben erreichten im/nach dem Crash einen Spitzenwert von ${formatVal(outlaysCrash.maxVal)} Mio. $\n\n`;

        report += `### 2. DIE FED (Panik-Raum & Liquidität)\n`;
        const walclPre = analyzeWindow(datasets.WALCL, preStart, crash.peak);
        const walclCrash = analyzeWindow(datasets.WALCL, crash.peak, crash.trough);
        const rrpCrash = analyzeWindow(datasets.RRP, crash.peak, crash.trough);
        const borrowCrash = analyzeWindow(datasets.BORROW, crash.peak, crash.trough);
        const resCrash = analyzeWindow(datasets.WRESBAL, crash.peak, crash.trough);

        report += `- **FED Bilanz (WALCL):** Vor dem Crash ${formatVal(walclPre.delta)} Mio. $, im Crash ${walclCrash.delta > 0 ? 'erweitert um +' + formatVal(walclCrash.delta) + ' Mio. $ ⚠️ (Stealth QE)' : 'geschrumpft um ' + formatVal(walclCrash.delta) + ' Mio. $'}\n`;
        if (rrpCrash.maxVal > 0) report += `- **Reverse Repo (RRP):** Im Crash von ${formatVal(rrpCrash.startVal)} auf ${formatVal(rrpCrash.endVal)} Mrd. $\n`;
        if (borrowCrash.maxVal > 1000) report += `- **Discount Window:** Explodierte auf Spitzenwerte von ${formatVal(borrowCrash.maxVal)} Mio. $!\n`;
        report += `- **Bankreserven:** Veränderung im Crash: ${formatVal(resCrash.delta)} Mio. $\n\n`;

        report += `### 3. DER BÜRGER (Sparquote & Löhne)\n`;
        const psaPre = analyzeWindow(datasets.PSAVERT, preStart, crash.peak);
        const psaCrash = analyzeWindow(datasets.PSAVERT, crash.peak, postEnd);
        const wagesCrash = analyzeWindow(datasets.WAGES, crash.peak, postEnd);
        
        report += `- **Sparquote:** Vor dem Crash bei ${formatVal(psaPre.endVal)}%, im/nach dem Crash Spitze bei ${formatVal(psaCrash.maxVal)}%\n`;
        if (wagesCrash.startVal > 0) report += `- **Reallöhne (Median Weekly):** Im Crash-Fenster Tiefpunkt bei ${formatVal(wagesCrash.minVal)} $\n\n`;

        report += `### 4. SCHATTENLIQUIDITÄT & BANKBILANZEN\n`;
        const usnumPre = analyzeWindow(datasets.USNUM, preStart, crash.peak);
        const mmfPre = analyzeWindow(datasets.MMF, preStart, crash.peak);
        
        report += `- **Staatsanleihen in Bankbilanzen (USNUM):** Vor dem Crash ${usnumPre.delta > 0 ? 'aufgebaut' : 'abgebaut'} um ${formatVal(usnumPre.delta)} Mrd. $\n`;
        report += `- **Geldmarktfonds-Volumen (MMF):** Vor dem Crash ${mmfPre.delta > 0 ? 'gewachsen' : 'geschrumpft'} um ${formatVal(mmfPre.delta)} Mio. $\n\n`;
        report += `---\n\n`;
    }

    fs.writeFileSync(OUT_FILE, report);
}

runAnalysis();
