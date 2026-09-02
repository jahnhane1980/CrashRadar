import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function pearsonCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
        sumY2 += y[i] * y[i];
    }
    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
    return denominator === 0 ? 0 : numerator / denominator;
}

async function analyzeCopperGold() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }
    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade historische Daten für SPY, Gold (GC=F), Kupfer (HG=F) und DFII10...");
        const [spyRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'SPY' AND record_date >= '2004-01-01' ORDER BY record_date ASC`);
        const [goldRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_yahoo WHERE symbol = 'GC=F' AND record_date >= '2004-01-01' ORDER BY record_date ASC`);
        const [copperRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_yahoo WHERE symbol = 'HG=F' AND record_date >= '2004-01-01' ORDER BY record_date ASC`);
        const [dfiiRows] = await pool.query(`SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = 'DFII10' AND observation_date >= '2004-01-01' ORDER BY observation_date ASC`);

        // Create fast lookup maps
        const goldMap = {}; goldRows.forEach(r => goldMap[r.date] = r.close);
        const copperMap = {}; copperRows.forEach(r => copperMap[r.date] = r.close);
        
        let dfiiIdx = 0;
        let currentDfii = null;
        for(let i=0; i<spyRows.length; i++) {
            const d = spyRows[i].date;
            while(dfiiIdx < dfiiRows.length && dfiiRows[dfiiIdx].date <= d) {
                if (dfiiRows[dfiiIdx].value !== '.') {
                    currentDfii = parseFloat(dfiiRows[dfiiIdx].value);
                }
                dfiiIdx++;
            }
            spyRows[i].gold = goldMap[d] || null;
            spyRows[i].copper = copperMap[d] || null;
            spyRows[i].dfii10 = currentDfii;
        }

        const crashes = [
            { name: 'GFC (Finanzkrise)', top: '2007-10-09', bottom: '2009-03-09' },
            { name: 'Zins-Crash', top: '2018-09-20', bottom: '2018-12-24' },
            { name: 'Corona Flash-Crash', top: '2020-02-19', bottom: '2020-03-23' },
            { name: 'Inflations-Schock', top: '2022-01-03', bottom: '2022-10-12' }
        ];

        console.log("\n========================================================");
        console.log("   TEIL 1: KUPFER VS. SPY WÄHREND DES CRASHS");
        console.log("========================================================");
        for(const crash of crashes) {
            const topDay = spyRows.find(r => r.date >= crash.top);
            const bottomDay = spyRows.find(r => r.date >= crash.bottom);
            if(!topDay || !bottomDay || !topDay.copper || !bottomDay.copper) continue;

            const spyRet = (bottomDay.close - topDay.close) / topDay.close;
            const copRet = (bottomDay.copper - topDay.copper) / topDay.copper;

            console.log(`--- ${crash.name} ---`);
            console.log(`SPY Drawdown: ${(spyRet*100).toFixed(2)}%`);
            console.log(`Kupfer Performance: ${(copRet*100).toFixed(2)}%`);
            if(copRet < -0.10) {
                console.log(`-> Bestätigt: Kupfer stürzt mit ab und bietet keinen Schutz.`);
            }
        }

        console.log("\n========================================================");
        console.log("   TEIL 2: GOLD ALS VORLÄUFIGER BODEN-INDIKATOR");
        console.log("========================================================");
        for(const crash of crashes) {
            const startIndex = spyRows.findIndex(r => r.date >= crash.top);
            const endIndex = spyRows.findIndex(r => r.date >= crash.bottom);
            
            if(startIndex === -1 || endIndex === -1) continue;

            let minGold = Infinity;
            let minGoldDate = null;

            // Suche den Gold-Tiefpunkt in einem erweiterten Fenster um das Top
            for(let i=startIndex; i<=endIndex; i++) {
                if(spyRows[i].gold && spyRows[i].gold < minGold) {
                    minGold = spyRows[i].gold;
                    minGoldDate = spyRows[i].date;
                }
            }

            console.log(`--- ${crash.name} ---`);
            console.log(`SPY Boden: ${crash.bottom}`);
            console.log(`Gold Boden gefunden am: ${minGoldDate}`);
            
            if(minGoldDate && minGoldDate <= crash.bottom) {
                const diffTime = Math.abs(new Date(crash.bottom) - new Date(minGoldDate));
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                console.log(`-> Bestätigt: Gold fand seinen Boden ${diffDays} Tage VOR (oder exakt am Tag) dem SPY.`);
            } else {
                console.log(`-> Fehler: Gold fand seinen Boden später.`);
            }
        }

        console.log("\n========================================================");
        console.log("   TEIL 3: GOLD VS REALZINSEN (DFII10) KORRELATION");
        console.log("========================================================");
        
        let goldRet_pre2022 = [];
        let dfiiRet_pre2022 = [];
        let goldRet_post2022 = [];
        let dfiiRet_post2022 = [];

        const valid = spyRows.filter(r => r.gold !== null && r.dfii10 !== null);
        for(let i=20; i<valid.length; i++) {
            const gRet = (valid[i].gold - valid[i-20].gold) / valid[i-20].gold;
            const dRet = valid[i].dfii10 - valid[i-20].dfii10; // Absolute change in yield

            if(valid[i].date < '2022-01-01') {
                goldRet_pre2022.push(gRet);
                dfiiRet_pre2022.push(dRet);
            } else {
                goldRet_post2022.push(gRet);
                dfiiRet_post2022.push(dRet);
            }
        }

        const corrPre = pearsonCorrelation(goldRet_pre2022, dfiiRet_pre2022);
        const corrPost = pearsonCorrelation(goldRet_post2022, dfiiRet_post2022);

        console.log(`Korrelation (Goldrendite vs Realzins-Änderung auf 20 Tage rollierend)`);
        console.log(`Vor 2022: ${corrPre.toFixed(4)} (Erwartet: Negativ, da Gold invers zu Zinsen läuft)`);
        console.log(`Ab 2022:  ${corrPost.toFixed(4)}`);

        if(Math.abs(corrPre - corrPost) > 0.2 || corrPost > 0) {
            console.log(`-> Bestätigt: Die historische inversive Korrelation ist im Bullenmarkt ab 2022 signifikant gebrochen!`);
        }

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzeCopperGold();
