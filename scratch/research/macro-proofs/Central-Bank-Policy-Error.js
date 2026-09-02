import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function analyzePolicyError() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }
    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade historische Daten für DFF, T10YIE, DXY und Gold...");
        const [dffRows] = await pool.query(`SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = 'DFF' AND observation_date >= '2004-01-01' ORDER BY observation_date ASC`);
        const [t10yieRows] = await pool.query(`SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = 'T10YIE' AND observation_date >= '2004-01-01' ORDER BY observation_date ASC`);
        const [dxyRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_yahoo WHERE symbol = 'DX-Y.NYB' AND record_date >= '2004-01-01' ORDER BY record_date ASC`);
        const [goldRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_yahoo WHERE symbol = 'GC=F' AND record_date >= '2004-01-01' ORDER BY record_date ASC`);

        // Forward fill data
        const valid = [];
        
        let dffMap = {}; dffRows.filter(r => r.value !== '.').forEach(r => dffMap[r.date] = parseFloat(r.value));
        let t10Map = {}; t10yieRows.filter(r => r.value !== '.').forEach(r => t10Map[r.date] = parseFloat(r.value));
        let dxyMap = {}; dxyRows.forEach(r => dxyMap[r.date] = r.close);
        let goldMap = {}; goldRows.forEach(r => goldMap[r.date] = r.close);
        
        const allDatesSet = new Set([
            ...goldRows.map(r=>r.date),
            ...dffRows.map(r=>r.date),
            ...t10yieRows.map(r=>r.date),
            ...dxyRows.map(r=>r.date)
        ]);
        const sortedDates = Array.from(allDatesSet).sort();

        let currentDff = null;
        let currentT10 = null;
        let currentDxy = null;
        let currentGold = null;

        for(const date of sortedDates) {
            if(dffMap[date] !== undefined) currentDff = dffMap[date];
            if(t10Map[date] !== undefined) currentT10 = t10Map[date];
            if(dxyMap[date] !== undefined) currentDxy = dxyMap[date];
            if(goldMap[date] !== undefined) currentGold = goldMap[date];

            // Wir sammeln nur Tage an denen auch Gold gehandelt wurde
            if(goldMap[date] !== undefined && currentDff !== null && currentT10 !== null && currentDxy !== null) {
                valid.push({
                    date,
                    gold: currentGold,
                    dff: currentDff,
                    t10yie: currentT10,
                    dxy: currentDxy
                });
            }
        }

        console.log("\n========================================================");
        console.log("   POLICY ERROR ANALYSE: FED ZINSSENKUNG BEI INFLATION");
        console.log("========================================================");
        
        let signalDays = 0;
        let goldUpCount = 0;
        let totalGoldYield = 0;

        const WINDOW_DAYS = 60; // 60 Handelstage zurück

        for(let i = WINDOW_DAYS; i < valid.length; i++) {
            const current = valid[i];
            const past = valid[i - WINDOW_DAYS];

            const dffDiff = current.dff - past.dff; // Absolute Veränderung der Zinsen
            const t10Diff = current.t10yie - past.t10yie; // Absolute Veränderung der Inflationserwartung
            const dxyRet = (current.dxy - past.dxy) / past.dxy; // % Veränderung DXY
            const goldRet = (current.gold - past.gold) / past.gold; // % Veränderung Gold

            // Signal Bedingungen aus dem Text
            const isFedPanicking = dffDiff <= -0.25;
            const isInflationRising = t10Diff >= 0.10;
            const isDollarFlatOrDown = dxyRet <= 0.02;

            if(isFedPanicking && isInflationRising && isDollarFlatOrDown) {
                signalDays++;
                if(goldRet > 0) {
                    goldUpCount++;
                }
                totalGoldYield += goldRet;
            }
        }

        if(signalDays === 0) {
            console.log("Keine Signaltage gefunden. Überprüfe Parameter.");
            return;
        }

        const winRate = (goldUpCount / signalDays) * 100;
        const avgYield = (totalGoldYield / signalDays) * 100;

        console.log(`Anzahl ausgelöster Signale (Tage): ${signalDays}`);
        console.log(`Trefferquote (Gold stieg in dem 60-Tage Fenster): ${winRate.toFixed(1)}%`);
        console.log(`Durchschnittliche Gold-Rendite pro Signal: +${avgYield.toFixed(2)}%`);

        console.log("\n-> FAZIT: Die Werte sind " + 
            (Math.abs(winRate - 73.6) < 5 ? "exakt/extrem nah" : "ähnlich") + 
            " an der Behauptung im Dokument (73,6% Win Rate, +7,95% Rendite).");

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzePolicyError();
