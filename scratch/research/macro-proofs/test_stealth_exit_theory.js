import fs from 'fs';
import path from 'path';

function runTheoryTest() {
    console.log("=== EMPIRISCHER TEST: THE STEALTH EXIT (DIX) ===");
    const dixPath = path.join(process.cwd(), 'scratch', 'DIX_raw.csv');
    
    if (!fs.existsSync(dixPath)) {
        console.error("DIX_raw.csv fehlt!");
        return;
    }

    const raw = fs.readFileSync(dixPath, 'utf-8').trim().split('\n');
    const data = [];
    
    for (let i = 1; i < raw.length; i++) {
        const parts = raw[i].split(',');
        if (parts.length >= 3) {
            data.push({
                date: parts[0],
                price: parseFloat(parts[1]),
                dix: parseFloat(parts[2]) * 100 // In Prozent
            });
        }
    }

    // Definiere die großen Makro-Tops
    const tops = [
        { name: "Volmageddon (Jan 2018)", peakDate: "2018-01-26", windowStart: "2017-11-01" },
        { name: "Q4 2018 Crash (Sep 2018)", peakDate: "2018-09-20", windowStart: "2018-07-01" },
        { name: "Covid Crash (Feb 2020)", peakDate: "2020-02-19", windowStart: "2019-12-01" },
        { name: "Zins-Top (Nov 2021)", peakDate: "2021-11-19", windowStart: "2021-08-01" },
        { name: "Tech/KI Top 1 (Jul 2024)", peakDate: "2024-07-16", windowStart: "2024-05-01" }
    ];

    console.log(`Datenpunkte geladen: ${data.length} Tage (S&P 500 / DIX). Schwellenwert: DIX < 40%\n`);

    for (const top of tops) {
        // Finde den Peak-Preis
        const peakEntry = data.find(d => d.date === top.peakDate);
        if (!peakEntry) continue;

        console.log(`--- Analyse: ${top.name} ---`);
        console.log(`Top erreicht am: ${top.peakDate} (S&P Kurs: ${peakEntry.price.toFixed(2)})`);

        // Filtere die Vorlaufzeit (Divergenz-Fenster)
        const window = data.filter(d => d.date >= top.windowStart && d.date <= top.peakDate);
        
        let firstWarning = null;
        let warningsCount = 0;
        let avgDixInWindow = 0;

        for (const day of window) {
            avgDixInWindow += day.dix;
            if (day.dix < 40.0) {
                warningsCount++;
                if (!firstWarning) firstWarning = day;
            }
        }
        avgDixInWindow = avgDixInWindow / window.length;

        if (firstWarning) {
            // Berechne Vorlaufzeit
            const firstDate = new Date(firstWarning.date);
            const peakDateObj = new Date(top.peakDate);
            const diffTime = Math.abs(peakDateObj - firstDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const priceDiff = peakEntry.price - firstWarning.price;
            const priceStatus = priceDiff > 0 ? "Markt stieg danach noch weiter an" : "Markt stagnierte";

            console.log(`🚨 ERSTE WARNUNG (DIX < 40%): ${firstWarning.date} (DIX: ${firstWarning.dix.toFixed(1)}%)`);
            console.log(`   -> S&P Kurs bei erster Warnung: ${firstWarning.price.toFixed(2)}`);
            console.log(`   -> Vorlaufzeit: ${diffDays} Kalendertage VOR dem eigentlichen Top!`);
            console.log(`   -> Preis-Aktion nach Warnung: ${priceStatus} (+${priceDiff.toFixed(2)} Punkte bis zum Crash)`);
            console.log(`   -> Anzahl der Warn-Tage im Fenster: ${warningsCount} / ${window.length}`);
        } else {
            console.log(`Keine DIX < 40% Warnung. Durchschnittlicher DIX: ${avgDixInWindow.toFixed(1)}%`);
        }
        console.log("");
    }
}

runTheoryTest();
