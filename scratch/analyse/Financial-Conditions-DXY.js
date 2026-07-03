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

async function analyzeDXY() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }
    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade SPY Daten...");
        const [spyRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'SPY' AND record_date >= '1999-01-01' ORDER BY record_date ASC`);
        
        console.log("Lade DXY Daten...");
        let [dxyRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_yahoo WHERE symbol = 'DX-Y.NYB' AND record_date >= '1999-01-01' ORDER BY record_date ASC`);
        
        if (dxyRows.length === 0) {
            console.log("Tabelle market_data_yahoo leer, versuche anderen Symbol-Namen oder Tabelle...");
            // Vielleicht anderer Ticker name in db
        }

        // Synchronize data
        let dxyIdx = 0;
        let cDxy = null;
        for(let i=0; i<spyRows.length; i++) {
            const d = spyRows[i].date;
            while(dxyIdx < dxyRows.length && dxyRows[dxyIdx].date <= d) {
                cDxy = parseFloat(dxyRows[dxyIdx].close);
                dxyIdx++;
            }
            spyRows[i].dxy = cDxy;
        }

        const valid = spyRows.filter(r => r.dxy && !isNaN(r.dxy) && r.dxy > 0);

        console.log("\n========================================================");
        console.log("   KORRELATIONS-ANALYSE: SPY VS DXY (FINANCIAL CONDITIONS)");
        console.log("========================================================");

        const windowDays = 126; // approx 6 months
        let correlations = [];

        // Daily returns correlation within 6 month windows
        for(let i = windowDays; i < valid.length; i++) {
            if(!valid[i].dxy || !valid[i-windowDays].dxy) continue;
            
            let spyReturns = [];
            let dxyReturns = [];
            
            for(let j = i - windowDays + 1; j <= i; j++) {
                if(!valid[j].dxy || !valid[j-1].dxy) continue;
                
                const spyRet = (valid[j].close - valid[j-1].close) / valid[j-1].close;
                const dxyRet = (valid[j].dxy - valid[j-1].dxy) / valid[j-1].dxy;
                
                spyReturns.push(spyRet);
                dxyReturns.push(dxyRet);
            }
            
            if(spyReturns.length > windowDays/2) {
                correlations.push(pearsonCorrelation(spyReturns, dxyReturns));
            }
        }

        const avgCorr = correlations.reduce((a,b)=>a+b, 0) / correlations.length;

        // Long term trend correlation: We correlate the 6-month returns themselves
        let spy6mReturns = [];
        let dxy6mReturns = [];
        for(let i = windowDays; i < valid.length; i++) {
            const spyRet = (valid[i].close - valid[i-windowDays].close) / valid[i-windowDays].close;
            const dxyRet = (valid[i].dxy - valid[i-windowDays].dxy) / valid[i-windowDays].dxy;
            spy6mReturns.push(spyRet);
            dxy6mReturns.push(dxyRet);
        }
        
        const macroCorr = pearsonCorrelation(spy6mReturns, dxy6mReturns);

        console.log(`Ø 6-Monats-Korrelation (Daily Returns innerh. des Fensters): ${avgCorr.toFixed(4)}`);
        console.log(`Makro-Trend Korrelation (Vergleich der rollierenden 6-Monats-Renditen seit 1999): ${macroCorr.toFixed(4)}`);

        if(macroCorr < -0.40) {
            console.log("\n-> FAZIT: Die These ist bestätigt. Die Renditen über 6 Monate korrelieren mit " + macroCorr.toFixed(2) + " signifikant negativ. Ein starker Dollar (DXY) drückt Risiko-Assets verlässlich nach unten.");
        } else {
            console.log("\n-> FAZIT: Die harte -0.49 Korrelation konnte so exakt evtl. nicht nachgestellt werden. Das Makro-Trend Ergebnis ist: " + macroCorr.toFixed(2));
        }

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzeDXY();
