import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function analyzeSahmRule() {
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

        console.log("Lade historische Sahm Rule (SAHMREALTIME) Daten...");
        const [sahmRows] = await pool.query(`
            SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value 
            FROM econ_fred 
            WHERE series_id = 'SAHMREALTIME' AND observation_date >= '1999-01-01'
            ORDER BY observation_date ASC
        `);

        // Forward-Fill der monatlichen Sahm Rule auf tagesaktuelle Werte
        const sahmMap = {};
        let currentSahm = 0;
        let sahmIndex = 0;
        
        for (let i = 0; i < spyRows.length; i++) {
            const currentDate = spyRows[i].date;
            // Update currentSahm if we reached a new observation date
            while (sahmIndex < sahmRows.length && sahmRows[sahmIndex].date <= currentDate) {
                currentSahm = parseFloat(sahmRows[sahmIndex].value);
                sahmIndex++;
            }
            spyRows[i].sahm = currentSahm;
        }

        const crashes = [
            { name: 'Dotcom Bubble', start: '2000-01-01', end: '2003-01-01' },
            { name: 'Finanzkrise (GFC)', start: '2007-01-01', end: '2009-12-31' },
            { name: 'Corona Flash-Crash', start: '2019-12-01', end: '2020-06-01' },
            { name: 'Zinskrise', start: '2021-06-01', end: '2023-01-01' },
            { name: 'Crash 2025', start: '2024-10-01', end: '2026-01-01' }
        ];

        console.log("\n========================================================");
        console.log("   SAHM RULE EVALUATION: LEADING ODER LAGGING?");
        console.log("========================================================\n");

        for (const crash of crashes) {
            const windowData = spyRows.filter(r => r.date >= crash.start && r.date <= crash.end);
            if (windowData.length === 0) continue;

            // 1. Finde das absolute Top
            let topDay = windowData[0];
            for (const day of windowData) {
                if (day.close > topDay.close) {
                    topDay = day;
                }
            }

            // 2. Finde den absoluten Bottom (NACH dem Top)
            const postTopData = windowData.filter(r => r.date >= topDay.date);
            let bottomDay = postTopData[0] || topDay;
            for (const day of postTopData) {
                if (day.close < bottomDay.close) {
                    bottomDay = day;
                }
            }

            // 3. Finde den Tag, an dem Sahm Rule >= 0.50 auslöst (um das Top herum)
            const sahmAlarmDay = windowData.find(r => r.sahm >= 0.50);

            console.log(`--- ${crash.name} ---`);
            console.log(`Top Datum:    ${topDay.date} | SPY: $${topDay.close.toFixed(2)} | Sahm Rule am Top: ${topDay.sahm.toFixed(2)}`);
            
            if (sahmAlarmDay) {
                const alarmDateObj = new Date(sahmAlarmDay.date);
                const topDateObj = new Date(topDay.date);
                const diffTime = alarmDateObj - topDateObj;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let classification = diffDays < 0 ? "🟢 LEADING (Frühindikator)" : "🔴 LAGGING (Nachlaufend)";
                
                console.log(`Alarm Datum:  ${sahmAlarmDay.date} | Sahm Rule bricht >= 0.50`);
                console.log(`-> Vorlauf:   ${diffDays} Tage (Relativ zum Top) -> ${classification}`);
            } else {
                console.log(`Alarm Datum:  KEIN ALARM IM FENSTER ERREICHT!`);
            }

            console.log(`Bottom Datum: ${bottomDay.date} | SPY: $${bottomDay.close.toFixed(2)} | Sahm Rule am Bottom: ${bottomDay.sahm.toFixed(2)}`);
            console.log("");
        }

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzeSahmRule();
