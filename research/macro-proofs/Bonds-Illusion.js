import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function analyzeBondsIllusion() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }
    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade SPY Daten...");
        const [spyRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'SPY' AND record_date >= '2002-07-01' ORDER BY record_date ASC`);
        
        console.log("Lade TLT (Anleihen) Daten...");
        const [tltRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'TLT' AND record_date >= '2002-07-01' ORDER BY record_date ASC`);

        // Synchronize data via simple map
        let tltMap = {};
        for(const row of tltRows) {
            tltMap[row.date] = row.close;
        }

        for(let i=0; i<spyRows.length; i++) {
            spyRows[i].tlt = tltMap[spyRows[i].date] || null;
        }

        const valid = spyRows.filter(r => r.tlt !== null);

        console.log("\n========================================================");
        console.log("   ANLEIHEN-ILLUSION: TLT VERHALTEN BEI CRASHES");
        console.log("========================================================\n");

        const crashes = [
            { name: 'GFC (Finanzkrise)', preStart: '2007-04-09', top: '2007-10-09', bottom: '2009-03-09' },
            { name: 'Zins-Crash', preStart: '2018-03-20', top: '2018-09-20', bottom: '2018-12-24' },
            { name: 'Corona Flash-Crash', preStart: '2019-08-19', top: '2020-02-19', bottom: '2020-03-23' },
            { name: 'Inflations-Schock', preStart: '2021-07-03', top: '2022-01-03', bottom: '2022-10-12' }
        ];

        function getClosestDay(targetDate) {
            let closest = valid[0];
            let minDiff = Infinity;
            for(const day of valid) {
                const diff = Math.abs(new Date(day.date) - new Date(targetDate));
                if(diff < minDiff) {
                    minDiff = diff;
                    closest = day;
                }
            }
            return closest;
        }

        for(const crash of crashes) {
            const preStartDay = getClosestDay(crash.preStart);
            const topDay = getClosestDay(crash.top);
            const bottomDay = getClosestDay(crash.bottom);

            console.log(`--- ${crash.name} ---`);
            
            // 1. Phase: 6 Monate VOR dem Top
            const tltPreReturn = (topDay.tlt - preStartDay.tlt) / preStartDay.tlt;
            console.log(`Phase 1 (6 Monate VOR dem Crash: ${preStartDay.date} bis ${topDay.date}):`);
            console.log(`-> TLT Rendite: ${(tltPreReturn*100).toFixed(2)}%`);
            if(tltPreReturn <= 0.01) {
                console.log(`   Bestätigt: TLT ist NICHT vorher ausgebrochen.`);
            } else {
                console.log(`   Hinweis: TLT stieg an.`);
            }

            // 2. Phase: WÄHREND des Crashs
            const spyCrashReturn = (bottomDay.close - topDay.close) / topDay.close;
            const tltCrashReturn = (bottomDay.tlt - topDay.tlt) / topDay.tlt;
            console.log(`Phase 2 (WÄHREND des Crashs: ${topDay.date} bis ${bottomDay.date}):`);
            console.log(`-> SPY Rendite: ${(spyCrashReturn*100).toFixed(2)}%`);
            console.log(`-> TLT Rendite: ${(tltCrashReturn*100).toFixed(2)}%`);

            if(tltCrashReturn > 0) {
                console.log(`   Bestätigt: TLT explodierte erst als Feuerwehr WÄHREND des Crashs.`);
            } else {
                console.log(`   Bestätigt (Zins-Schock): TLT brannte gemeinsam mit Aktien ab.`);
            }
            
            console.log("");
        }

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzeBondsIllusion();
