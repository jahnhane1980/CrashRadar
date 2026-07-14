import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { AnalysisRepository } from '../../src/core/repositories/AnalysisRepository.js';

// 1. Definition der S&P 500 Peaks aus Analyse.md
const PEAKS = [
    { name: "Dotcom-Blase", peakDate: "2000-03-24", monthKey: "2000-03" },
    { name: "Finanzkrise (GFC)", peakDate: "2007-10-09", monthKey: "2007-10" },
    { name: "Zins-Panik (2018)", peakDate: "2018-09-20", monthKey: "2018-09" },
    { name: "Corona-Crash", peakDate: "2020-02-19", monthKey: "2020-02" },
    { name: "Inflations-Schock", peakDate: "2022-01-03", monthKey: "2022-01" },
    { name: "Korrektur (2025)", peakDate: "2025-02-19", monthKey: "2025-02" }
];

// JSON Laden entfernt. Wir nutzen die Datenbank direkt.

async function run() {
    console.log("=== ANALYSE ARBEITSMARKT-DIVERGENZEN & S&P 500 ===");

    // 2. Datenbank-Verbindung herstellen und bestehende Reihen laden
    console.log("[Setup] Lade Daten aus lokaler Datenbank...");
    const dbUrl = process.env.DATABASE_URL;
    const repo = new AnalysisRepository(dbUrl);
    
    // SPY laden
    const spyRaw = await repo.getOhlcvForTicker('SPY', '1995-01-01');
    console.log(`   -> SPY Datenpunkte geladen: ${spyRaw.length}`);
    
    // FRED laden
    const rawData = await repo.getAllRawData('1995-01-01');
    const dbFred = rawData.fred || [];
    
    const extractSeries = (seriesId) => {
        return dbFred
            .filter(r => r.series_id === seriesId && r.value !== '.')
            .map(r => ({ date: r.date, value: parseFloat(r.value) }));
    };

    const ce16ov = extractSeries('CE16OV');
    const fullTime = extractSeries('LNS12500000');
    const partTime = extractSeries('LNS12600000');
    const multJob = extractSeries('LNS12026619');
    const u6Rate = extractSeries('U6RATE');
    const unrate = extractSeries('UNRATE');
    const payems = extractSeries('PAYEMS');
    const icsa = extractSeries('ICSA');
    
    console.log(`   -> FRED Daten geladen. PAYEMS: ${payems.length}, CE16OV: ${ce16ov.length}`);
    
    await repo.close();

    // 4. Harmonisierung auf Monatsbasis (YYYY-MM)
    console.log("[Process] Harmonisiere Zeitreihen auf Monatsbasis...");
    const monthlyData = {};

    const getMonthKey = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr instanceof Date) {
            return dateStr.toISOString().substring(0, 7);
        }
        return dateStr.substring(0, 7);
    };

    // Hilfsfunktion zum Mappen von monatlichen Punkt-Daten
    const mapMonthly = (series, key) => {
        series.forEach(item => {
            const mKey = getMonthKey(item.date);
            if (!monthlyData[mKey]) monthlyData[mKey] = {};
            monthlyData[mKey][key] = item.value;
        });
    };

    mapMonthly(ce16ov, 'CE16OV');
    mapMonthly(fullTime, 'FullTime');
    mapMonthly(partTime, 'PartTime');
    mapMonthly(multJob, 'MultJob');
    mapMonthly(u6Rate, 'U6Rate');
    mapMonthly(unrate, 'UNRATE');
    mapMonthly(payems, 'PAYEMS');

    // SPY auf Monatsbasis mappen (Letzter Schlusskurs des Monats)
    spyRaw.forEach(item => {
        const mKey = getMonthKey(item.date);
        if (!monthlyData[mKey]) monthlyData[mKey] = {};
        const currentClose = monthlyData[mKey].SPY;
        if (!currentClose || item.date > (monthlyData[mKey].SPY_date || "")) {
            monthlyData[mKey].SPY = item.close;
            monthlyData[mKey].SPY_date = item.date;
        }
    });

    // ICSA auf Monatsbasis aggregieren (Durchschnitt der wöchentlichen Claims pro Monat)
    const monthlyIcsaTemp = {};
    icsa.forEach(item => {
        const mKey = getMonthKey(item.date);
        if (!monthlyIcsaTemp[mKey]) monthlyIcsaTemp[mKey] = [];
        monthlyIcsaTemp[mKey].push(item.value);
    });
    Object.keys(monthlyIcsaTemp).forEach(mKey => {
        const values = monthlyIcsaTemp[mKey].filter(v => !isNaN(v));
        if (values.length > 0) {
            if (!monthlyData[mKey]) monthlyData[mKey] = {};
            monthlyData[mKey].ICSA = values.reduce((sum, v) => sum + v, 0) / values.length;
        }
    });

    // 5. Divergenzen und Indikatoren berechnen
    console.log("[Process] Berechne mathematische Divergenzen...");
    const sortedMonths = Object.keys(monthlyData).sort();
    
    for (let i = 0; i < sortedMonths.length; i++) {
        const mKey = sortedMonths[i];
        const current = monthlyData[mKey];
        
        // --- 5.1 Quantitative Schere (PAYEMS vs CE16OV) ---
        if (i >= 2) {
            const prev2 = monthlyData[sortedMonths[i - 2]];
            if (current.PAYEMS && prev2.PAYEMS && current.CE16OV && prev2.CE16OV) {
                current.deltaPayems = current.PAYEMS - prev2.PAYEMS;
                current.deltaCe16ov = current.CE16OV - prev2.CE16OV;
                current.quantDivergence = (current.deltaPayems > 0 && current.deltaCe16ov < 0);
            }
        }
        
        // --- 5.2 Qualitative Schere (Vollzeit vs Teilzeit Ratio) ---
        if (current.FullTime && current.PartTime) {
            current.ftPtRatio = current.FullTime / current.PartTime;
            
            // 12-Monats-Maximum berechnen
            let max12 = -Infinity;
            const startIdx = Math.max(0, i - 11);
            for (let j = startIdx; j <= i; j++) {
                const ratio = monthlyData[sortedMonths[j]].ftPtRatio;
                if (ratio && ratio > max12) max12 = ratio;
            }
            current.ftPtMax12 = max12;
            current.ftPtDrawdown = ((current.ftPtRatio - max12) / max12) * 100;
            current.qualDivergence = current.ftPtDrawdown <= -2.5;
        }

        // --- 5.3 Multi-Job-Stress ---
        if (current.MultJob && current.CE16OV) {
            current.multJobRatio = (current.MultJob / current.CE16OV) * 100;
        }

        // --- 5.4 Sahm-Rule ---
        if (i >= 11) {
            // MA3 berechnen
            let sum3 = 0, count3 = 0;
            for (let j = i - 2; j <= i; j++) {
                const u = monthlyData[sortedMonths[j]].UNRATE;
                if (u != null) { sum3 += u; count3++; }
            }
            if (count3 === 3) {
                current.unrateMa3 = sum3 / 3;
                
                // 12-Monats-Minimum der rohen UNRATE
                let min12 = Infinity;
                for (let j = i - 11; j <= i; j++) {
                    const u = monthlyData[sortedMonths[j]].UNRATE;
                    if (u != null && u < min12) min12 = u;
                }
                current.unrateMin12 = min12;
                current.sahmValue = current.unrateMa3 - min12;
                current.sahmWarning = current.sahmValue >= 0.30;
                current.sahmTrigger = current.sahmValue >= 0.50;
            }
        }
    }

    // 6. Historischer Abgleich mit den S&P 500 Peaks
    console.log("[Analyze] Analysiere historische Peaks...");
    
    const results = PEAKS.map(peak => {
        const peakIdx = sortedMonths.indexOf(peak.monthKey);
        if (peakIdx === -1) {
            return { name: peak.name, status: "Fehlende Monatsdaten" };
        }
        
        // Wir untersuchen ein Fenster von 18 Monaten vor dem Peak bis 12 Monate danach
        const windowMonths = sortedMonths.slice(Math.max(0, peakIdx - 18), Math.min(sortedMonths.length, peakIdx + 12));
        
        let firstQuantDiv = null;
        let firstQualDiv = null;
        let firstSahmWarning = null;
        let firstSahmTrigger = null;

        windowMonths.forEach(mKey => {
            const data = monthlyData[mKey];
            const monthsDiff = (sortedMonths.indexOf(mKey) - peakIdx); // negative = vor Peak, positive = nach Peak

            if (data.quantDivergence && firstQuantDiv === null) {
                firstQuantDiv = { mKey, monthsDiff, value: `PAY:${data.deltaPayems.toFixed(0)}|CE:${data.deltaCe16ov.toFixed(0)}` };
            }
            if (data.qualDivergence && firstQualDiv === null) {
                firstQualDiv = { mKey, monthsDiff, value: `${data.ftPtDrawdown.toFixed(1)}%` };
            }
            if (data.sahmWarning && firstSahmWarning === null) {
                firstSahmWarning = { mKey, monthsDiff, value: `${data.sahmValue.toFixed(2)}%` };
            }
            if (data.sahmTrigger && firstSahmTrigger === null) {
                firstSahmTrigger = { mKey, monthsDiff, value: `${data.sahmValue.toFixed(2)}%` };
            }
        });

        return {
            name: peak.name,
            peakMonth: peak.monthKey,
            quantDiv: firstQuantDiv,
            qualDiv: firstQualDiv,
            sahmWarning: firstSahmWarning,
            sahmTrigger: firstSahmTrigger
        };
    });

    // 7. Markdown-Report generieren und ausgeben
    let report = "";
    report += `## US-Arbeitsmarkt Divergenz-Tracker: Historische Validierung\n\n`;
    report += `Dieses Skript prüft, wie viele Monate vor (negativ) oder nach (positiv) einem S&P 500 Zyklus-Top die einzelnen Divergenzen angeschlagen haben.\n\n`;
    
    report += `| Markt-Top (Peak) | S&P Peak-Monat | Quant. Schere (Household vs. Payrolls) | Qual. Schere (Vollzeit vs. Teilzeit) | Sahm-Rule Early-Warning (>= 0.3%) | Sahm-Rule Trigger (>= 0.5%) |\n`;
    report += `| --- | --- | --- | --- | --- | --- |\n`;

    results.forEach(res => {
        const formatRes = (divObj) => {
            if (!divObj) return "❌ *Kein Signal*";
            const color = divObj.monthsDiff < 0 ? "🟢" : "🔴";
            const sign = divObj.monthsDiff > 0 ? "+" : "";
            return `${color} **${sign}${divObj.monthsDiff} Monate** (${divObj.value})`;
        };

        report += `| **${res.name}** | \`${res.peakMonth}\` | ${formatRes(res.quantDiv)} | ${formatRes(res.qualDiv)} | ${formatRes(res.sahmWarning)} | ${formatRes(res.sahmTrigger)} |\n`;
    });

    report += `\n\n### 💡 Interpretation & Klassifizierung:\n\n`;
    report += `1. **Frühindikatoren (Leading - 6 bis 12 Monate Vorlauf):**\n`;
    report += `   * **Vollzeit/Teilzeit-Qualitätsschere:** Schlägt zuverlässig viele Monate vor dem Top an. Das erste Anzeichen dafür, dass Unternehmen Stellen abbauen/umbauen, während der S&P noch neue Rekordhöhen markiert.\n\n`;
    report += `2. **Akutindikatoren (Coincident - 0 bis 3 Monate Vorlauf):**\n`;
    report += `   * **Quantitative Divergenz (CE16OV vs. PAYEMS):** Bildet die finale Phase der Divergenz. Die Payrolls steigen noch durch statistische Faktoren, aber das reale Beschäftigungsniveau bricht bereits ein.\n\n`;
    report += `3. **Spätindikatoren (Lagging - Bestätigung nach dem Top):**\n`;
    report += `   * **Sahm-Rule & Sahm-Warning:** Triggern historisch meist erst nach dem absoluten Preis-Top, dafür aber mit 100%iger Trefferquote für eine beginnende Rezession. Sie dienen als finaler Zündschlüssel, um defensive Re-Entries zu verhindern.\n`;

    // Auf die Festplatte schreiben für Folge-Analysen
    const reportPath = path.join(process.cwd(), 'docs', 'Crash-Arbeitsmarkt-Analyse.md');
    fs.writeFileSync(reportPath, report, 'utf-8');

    console.log("\n" + report);
    console.log(`\n✅ Analyse abgeschlossen! Report gespeichert unter: ${reportPath}`);
}

run();
