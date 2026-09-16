import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function analyzeMacroIndicators() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }
    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade Daten für Bankreserven (TOTRESNS), TGA (WDTGAL), NFCI und SPY...");
        
        const [spyRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'SPY' AND record_date >= '2005-01-01' ORDER BY record_date ASC`);
        const [resRows] = await pool.query(`SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = 'TOTRESNS' AND observation_date >= '2005-01-01' ORDER BY observation_date ASC`);
        const [tgaRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close_balance as value FROM fiscal_tga WHERE record_date >= '2005-01-01' ORDER BY record_date ASC`);
        const [nfciRows] = await pool.query(`SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = 'NFCI' AND observation_date >= '2005-01-01' ORDER BY observation_date ASC`);

        const tops = {
            '2008': '2007-10-09',
            '2018': '2018-09-20',
            '2022': '2022-01-03'
        };

        const threeMonthsBefore = (dateStr) => {
            let d = new Date(dateStr);
            d.setMonth(d.getMonth() - 3);
            return d.toISOString().split('T')[0];
        };

        const getClosestValue = (rows, dateStr) => {
            let val = null;
            let target = new Date(dateStr);
            for(let i=rows.length-1; i>=0; i--) {
                if(new Date(rows[i].date) <= target && rows[i].value !== '.') {
                    val = parseFloat(rows[i].value);
                    break;
                }
            }
            return val;
        };

        console.log("\n========================================================");
        console.log("   TEST 1: BANKRESERVEN (TOTRESNS) RÜCKGANG VOR CRASH");
        console.log("========================================================");
        
        for(const [year, topDate] of Object.entries(tops)) {
            if(year === '2008') continue; 
            const startDate = threeMonthsBefore(topDate);
            const valStart = getClosestValue(resRows, startDate);
            const valEnd = getClosestValue(resRows, topDate);
            if(valStart !== null && valEnd !== null) {
                const diff = (valEnd - valStart); 
                console.log(`Zins-Crash ${year} (Peak: ${topDate}):`);
                console.log(`-> 3 Monate davor: ${valStart} Mrd. $`);
                console.log(`-> Am Top: ${valEnd} Mrd. $`);
                console.log(`-> Veränderung: ${diff.toFixed(2)} Mrd. $`);
            }
        }
        
        console.log("\n========================================================");
        console.log("   TEST 2: TGA KONTO ANSTIEG VOR CRASH 2022");
        console.log("========================================================");
        const tgaStart2022 = threeMonthsBefore(tops['2022']);
        const tgaValStart = getClosestValue(tgaRows, tgaStart2022);
        const tgaValEnd = getClosestValue(tgaRows, tops['2022']);
        if(tgaValStart !== null && tgaValEnd !== null) {
            console.log(`Inflations-Crash 2022 (Peak: ${tops['2022']}):`);
            console.log(`-> 3 Monate davor: ${tgaValStart} Mrd. $ (Fiskal-TGA in Mrd $)`);
            console.log(`-> Am Top: ${tgaValEnd} Mrd. $`);
            console.log(`-> Anstieg (Liquiditätsentzug): ${(tgaValEnd - tgaValStart).toFixed(2)} Mrd. $`);
        }

        console.log("\n========================================================");
        console.log("   TEST 3: CHICAGO FED STRESS INDEX (NFCI) VOR 2008");
        console.log("========================================================");
        const nfciStart2008 = threeMonthsBefore(tops['2008']);
        const nfciValStart = getClosestValue(nfciRows, nfciStart2008);
        const nfciValEnd = getClosestValue(nfciRows, tops['2008']);
        if(nfciValStart !== null && nfciValEnd !== null) {
            console.log(`Finanzkrise 2008 (Peak: ${tops['2008']}):`);
            console.log(`-> 3 Monate davor: ${nfciValStart}`);
            console.log(`-> Am Top: ${nfciValEnd}`);
            if(nfciValEnd > nfciValStart) {
                console.log(`-> Bestätigt: Drastischer Anstieg in den Plus-Bereich (Warnsignal).`);
            }
        }

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzeMacroIndicators();
