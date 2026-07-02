import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const pool = mysql.createPool(process.env.DATABASE_URL);

    try {
        const query = `
            SELECT 
                t.record_date,
                t.close as spy_price,
                s.short_volume_ratio as spy_short_ratio,
                y.close as skew_index
            FROM market_data_tiingo t
            LEFT JOIN market_data_short_volume s ON t.record_date = s.record_date AND s.symbol = 'SPY'
            LEFT JOIN market_data_yahoo y ON t.record_date = y.record_date AND y.symbol = '^SKEW'
            WHERE t.symbol = 'SPY'
            ORDER BY t.record_date ASC
        `;

        const [rows] = await pool.query(query);

        if (rows.length === 0) {
            console.log("Keine Daten gefunden.");
            return;
        }

        const windowSize = 20; // 20 trading days to define a local top
        const tops = [];

        for (let i = windowSize; i < rows.length - windowSize; i++) {
            let isTop = true;
            const currentPrice = rows[i].spy_price;
            
            for (let j = i - windowSize; j <= i + windowSize; j++) {
                if (rows[j].spy_price > currentPrice) {
                    isTop = false;
                    break;
                }
            }

            if (isTop) {
                // Check if there's a subsequent drop of at least 5% within 40 days
                let maxDrop = 0;
                for (let k = i + 1; k < Math.min(rows.length, i + 40); k++) {
                    const drop = (currentPrice - rows[k].spy_price) / currentPrice;
                    if (drop > maxDrop) maxDrop = drop;
                }

                if (maxDrop >= 0.05) { // 5% drop is a solid correction/crash
                    // Find min short ratio and max SKEW in the 10 days prior
                    let minShort = 999;
                    let maxSkew = 0;
                    for(let k = Math.max(0, i - 10); k <= i; k++) {
                        if (rows[k].spy_short_ratio !== null && rows[k].spy_short_ratio < minShort) minShort = rows[k].spy_short_ratio;
                        if (rows[k].skew_index !== null && rows[k].skew_index > maxSkew) maxSkew = rows[k].skew_index;
                    }

                    tops.push({
                        date: rows[i].record_date,
                        price: currentPrice,
                        drop: maxDrop,
                        minShort: minShort === 999 ? null : minShort,
                        maxSkew: maxSkew === 0 ? null : maxSkew
                    });
                }
            }
        }

        let skewHits = 0;
        let shortVolHits = 0;
        let shortVolValidTops = 0;

        console.log("== HISTORISCHE CRASH-ANALYSE (>= 5% Drop) ==");
        for (const top of tops) {
            let skewHit = top.maxSkew >= 140; // threshold for SKEW
            let shortHit = top.minShort !== null && top.minShort < 0.45; // threshold for Short Vol

            if (skewHit) skewHits++;
            if (top.minShort !== null) {
                shortVolValidTops++;
                if (shortHit) shortVolHits++;
            }

            // Nur die letzten 3 Jahre ausgeben der Übersichtlichkeit halber, oder wenn SKEW Hit
            if (top.date >= '2023-01-01') {
                console.log(`Crash am ${top.date} (-${(top.drop*100).toFixed(1)}%):`);
                console.log(` -> SKEW Top (10T davor): ${top.maxSkew ? top.maxSkew.toFixed(1) : 'N/A'} ${skewHit ? '✅ (Warnung)' : '❌'}`);
                console.log(` -> Short-Ratio Dip (10T davor): ${top.minShort ? (top.minShort*100).toFixed(1) + '%' : 'N/A'} ${shortHit ? '✅ (Warnung)' : (top.minShort ? '❌' : '')}`);
            }
        }

        console.log("\n== FALSE POSITIVES ANALYSE (Seit 2013) ==");
        let falsePositives = 0;
        let falsePosDates = [];
        let comboFalsePositives = 0;
        
        // Gehe alle Tage seit 2013 durch (da SKEW davor strukturell anders war)
        for (let i = 0; i < rows.length - 40; i++) {
            if (rows[i].record_date < '2013-01-01') continue;
            
            const currentSkew = rows[i].skew_index;
            const currentShort = rows[i].spy_short_ratio;
            const currentPrice = rows[i].spy_price;

            // Wir definieren ein Signal: SKEW > 145
            if (currentSkew >= 145) {
                // Check ob in den nächsten 40 Tagen ein Crash >= 5% kam
                let maxDrop = 0;
                for (let k = i + 1; k < i + 40; k++) {
                    const drop = (currentPrice - rows[k].spy_price) / currentPrice;
                    if (drop > maxDrop) maxDrop = drop;
                }

                if (maxDrop < 0.05) {
                    // False Positive!
                    // Um nicht jeden aufeinanderfolgenden Tag zu zählen, überspringen wir 20 Tage
                    if (falsePosDates.length === 0 || new Date(rows[i].record_date) - new Date(falsePosDates[falsePosDates.length-1].date) > 20 * 24 * 60 * 60 * 1000) {
                        falsePosDates.push({
                            date: rows[i].record_date,
                            skew: currentSkew,
                            short: currentShort,
                            drop: maxDrop
                        });
                        falsePositives++;
                        
                        // Combo False Positive? (SKEW > 145 UND Short < 45%)
                        if (currentShort !== null && currentShort < 0.45) {
                            comboFalsePositives++;
                            console.log(`[COMBO FALSE POSITIVE] am ${rows[i].record_date}: SKEW=${currentSkew.toFixed(1)}, Short=${(currentShort*100).toFixed(1)}% -> Max Drop danach nur -${(maxDrop*100).toFixed(1)}%`);
                        } else if (rows[i].record_date >= '2023-01-01') {
                           console.log(`[FALSE POSITIVE SKEW] am ${rows[i].record_date}: SKEW=${currentSkew.toFixed(1)} -> Max Drop danach nur -${(maxDrop*100).toFixed(1)}%`);
                        }
                    }
                }
            }
        }

        console.log("\n== STATISTIK ==");
        console.log(`Gefundene Crashes (>= 5%): ${tops.length}`);
        console.log(`SKEW > 140 vor Crash: ${skewHits} / ${tops.length} (${((skewHits/tops.length)*100).toFixed(1)}%)`);
        if (shortVolValidTops > 0) {
            console.log(`Short-Ratio < 45% vor Crash: ${shortVolHits} / ${shortVolValidTops} (${((shortVolHits/shortVolValidTops)*100).toFixed(1)}%)`);
        }
        console.log(`Anzahl Fehlalarme (SKEW > 145, aber kein Crash): ${falsePositives}`);
        console.log(`Anzahl Combo-Fehlalarme (SKEW > 145 UND Short < 45%, kein Crash): ${comboFalsePositives}`);

    } catch (e) {
        console.error("Fehler:", e);
    } finally {
        await pool.end();
    }
}

run();
