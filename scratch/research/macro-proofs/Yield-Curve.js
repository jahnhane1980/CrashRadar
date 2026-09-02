import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function analyzeYieldCurve() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }

    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade historische SPY Daten...");
        const [spyRows] = await pool.query(`
            SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close 
            FROM market_data_tiingo 
            WHERE symbol = 'SPY' AND record_date >= '1999-01-01'
            ORDER BY record_date ASC
        `);

        console.log("Lade historische 10Y-2Y Spread (T10Y2Y) Daten...");
        const [spreadRows] = await pool.query(`
            SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value 
            FROM econ_fred 
            WHERE series_id = 'T10Y2Y' AND observation_date >= '1999-01-01'
            ORDER BY observation_date ASC
        `);

        // Forward-Fill
        let spreadIndex = 0;
        let currentSpread = null;
        
        for (let i = 0; i < spyRows.length; i++) {
            const currentDate = spyRows[i].date;
            while (spreadIndex < spreadRows.length && spreadRows[spreadIndex].date <= currentDate) {
                if (spreadRows[spreadIndex].value !== '.' && spreadRows[spreadIndex].value !== null) {
                    currentSpread = parseFloat(spreadRows[spreadIndex].value);
                }
                spreadIndex++;
            }
            
            spyRows[i].spread = currentSpread;
            if(i > 0) {
                spyRows[i].dailyReturn = (spyRows[i].close - spyRows[i-1].close) / spyRows[i-1].close;
            } else {
                spyRows[i].dailyReturn = 0;
            }
        }

        const validDays = spyRows.filter(r => r.spread !== null);
        
        // 1. Average Returns
        const invertedDays = validDays.filter(r => r.spread < 0);
        const normalDays = validDays.filter(r => r.spread >= 0);

        const avgInverted = invertedDays.reduce((sum, r) => sum + r.dailyReturn, 0) / invertedDays.length;
        const avgNormal = normalDays.reduce((sum, r) => sum + r.dailyReturn, 0) / normalDays.length;

        console.log("\n========================================================");
        console.log("   TEIL 1: TAGESRENDITEN INVERTIERT VS NORMAL");
        console.log("========================================================");
        console.log(`Durchschnittliche SPY Tagesrendite (Invertiert, < 0): ${(avgInverted * 100).toFixed(4)}% (Tage: ${invertedDays.length})`);
        console.log(`Durchschnittliche SPY Tagesrendite (Normal, >= 0):    ${(avgNormal * 100).toFixed(4)}% (Tage: ${normalDays.length})`);
        
        if (avgInverted > avgNormal) {
            console.log("-> BEWIESEN: Der Aktienmarkt steigt in invertierten Phasen im Schnitt stärker (Blow-Off-Top Rallyes).");
        }

        // 2. Point of No Return (Schwellenwert / Steigung)
        console.log("\n========================================================");
        console.log("   TEIL 2: POINT OF NO RETURN (SCHWELLENWERTE & STEIGUNG)");
        console.log("========================================================");

        // 30-Tage Steigung (Momentum) berechnen
        for (let i = 30; i < validDays.length; i++) {
            validDays[i].spreadMomentum30d = validDays[i].spread - validDays[i-30].spread;
        }

        const thresholds = [0.0, 0.1, 0.2, 0.3, 0.4];
        let bestThreshold = null;
        let worstReturn = 0;

        for (const t of thresholds) {
            let totalForwardReturn = 0;
            let triggerCount = 0;
            let wasInverted = false;
            
            for (let i = 60; i < validDays.length - 120; i++) {
                // Reset-Bedingung: Muss tief invertiert gewesen sein (< -0.1)
                if (validDays[i].spread < -0.1) {
                    wasInverted = true;
                }
                
                // Trigger-Bedingung: Überschreitet Schwellenwert nach oben
                if (wasInverted && validDays[i-1].spread < t && validDays[i].spread >= t) {
                    // Rendite der nächsten 120 Handelstage (ca. 6 Monate)
                    const fwdReturn = (validDays[i+120].close - validDays[i].close) / validDays[i].close;
                    totalForwardReturn += fwdReturn;
                    triggerCount++;
                    wasInverted = false; // Reset
                }
            }
            
            if (triggerCount > 0) {
                const avgFwd = totalForwardReturn / triggerCount;
                console.log(`Schwelle: Spread kreuzt ${t.toFixed(1)} nach oben | Signale: ${triggerCount} | Ø SPY 6-Monats-Rendite danach: ${(avgFwd*100).toFixed(2)}%`);
                
                if (avgFwd < worstReturn) {
                    worstReturn = avgFwd;
                    bestThreshold = t;
                }
            }
        }

        console.log(`\n-> FAZIT SCHWELLENWERT: Der "Point of no return" liegt historisch ca. bei einem Spread von >= ${bestThreshold?.toFixed(1)}. Hier beginnen die massivsten Drawdowns.`);

        // Steigung an den historischen Makro-Tops
        console.log("\n-> Steigung (Momentum) des Spreads exakt zum Zeitpunkt von massiven SPY-Höhepunkten vor dem Crash:");
        const tops = [
            { name: "DotCom Bubble", dateStart: "2000-08-01", dateEnd: "2000-10-01" },
            { name: "GFC (Finanzkrise)", dateStart: "2007-09-01", dateEnd: "2007-11-01" },
        ];

        let avgMomentumAtTops = 0;
        let topCount = 0;

        for(const top of tops) {
            const window = validDays.filter(d => d.date >= top.dateStart && d.date <= top.dateEnd);
            if(window.length > 0) {
                let maxDay = window[0];
                for(const d of window) {
                    if(d.close > maxDay.close) maxDay = d;
                }
                console.log(`- ${top.name} Top (${maxDay.date}): Spread lag bei ${maxDay.spread.toFixed(2)} | 30-Tage Steigung: +${maxDay.spreadMomentum30d.toFixed(3)}`);
                avgMomentumAtTops += maxDay.spreadMomentum30d;
                topCount++;
            }
        }

        if(topCount > 0) {
            const avgMom = avgMomentumAtTops / topCount;
            console.log(`\n-> FAZIT STEIGUNG: Wenn der Markt crasht, hat die Zinskurve (T10Y2Y) im Schnitt eine 30-Tage Steigung von ca. +${avgMom.toFixed(3)}. Das Steepening läuft hier bereits rasant.`);
        }

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzeYieldCurve();
