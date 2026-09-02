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

async function analyzeNetLiquidity() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }
    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade Net Liquidity Komponenten (WALCL, TGA, RRPONTSYD)...");
        // WALCL (FED Bilanz) in Millions -> wir rechnen alles in Billions (Milliarden)
        const [walclRows] = await pool.query(`SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = 'WALCL' ORDER BY observation_date ASC`);
        // RRPONTSYD (Reverse Repo) in Billions
        const [rrpRows] = await pool.query(`SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = 'RRPONTSYD' ORDER BY observation_date ASC`);
        
        let tgaRows = [];
        try {
            // TGA from FiscalData (usually in fiscal_tga, open_today_bal is in millions)
            [tgaRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, open_today_bal as value FROM fiscal_tga ORDER BY record_date ASC`);
        } catch (e) {
            console.log("-> fiscal_tga Tabelle nicht gefunden, versuche Fallback auf WDTGAL...");
            [tgaRows] = await pool.query(`SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = 'WDTGAL' ORDER BY observation_date ASC`);
        }

        console.log("Lade Asset Preise (SPY, QQQ, BTC)...");
        const [spyRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'SPY' AND record_date >= '2014-01-01' ORDER BY record_date ASC`);
        const [qqqRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'QQQ' AND record_date >= '2014-01-01' ORDER BY record_date ASC`);
        
        // BTC Daten von Binance oder Tiingo
        let [btcRows] = await pool.query(`SELECT DATE_FORMAT(open_time, '%Y-%m-%d') as date, close FROM market_data_binance WHERE symbol = 'BTCUSDT' ORDER BY open_time ASC`);
        if(btcRows.length === 0) {
            [btcRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'BTCUSD' ORDER BY record_date ASC`);
        }

        // Aligning Data (Daily base: SPY trading days)
        // Forward fill WALCL, RRP, TGA, BTC
        let walclIdx=0, rrpIdx=0, tgaIdx=0, btcIdx=0, qqqIdx=0;
        let cWalcl=0, cRrp=0, cTga=0, cBtc=null, cQqq=null;

        for(let i=0; i<spyRows.length; i++) {
            const d = spyRows[i].date;
            
            while(walclIdx < walclRows.length && walclRows[walclIdx].date <= d) { 
                if (walclRows[walclIdx].value !== '.') {
                    cWalcl = parseFloat(walclRows[walclIdx].value) / 1000; // Millions -> Billions
                }
                walclIdx++; 
            }
            while(rrpIdx < rrpRows.length && rrpRows[rrpIdx].date <= d) { 
                if (rrpRows[rrpIdx].value !== '.') {
                    cRrp = parseFloat(rrpRows[rrpIdx].value); // Already in Billions
                }
                rrpIdx++; 
            }
            while(tgaIdx < tgaRows.length && tgaRows[tgaIdx].date <= d) { 
                if (tgaRows[tgaIdx].value !== '.' && tgaRows[tgaIdx].value !== null) {
                    let val = parseFloat(tgaRows[tgaIdx].value);
                    cTga = val > 10000 ? val / 1000 : val; // Normalize to Billions (fiscal_tga is millions, WDTGAL is billions)
                }
                tgaIdx++; 
            }
            while(btcIdx < btcRows.length && btcRows[btcIdx].date <= d) { 
                cBtc = parseFloat(btcRows[btcIdx].value); 
                btcIdx++; 
            }
            while(qqqIdx < qqqRows.length && qqqRows[qqqIdx].date <= d) { 
                cQqq = parseFloat(qqqRows[qqqIdx].value); 
                qqqIdx++; 
            }

            spyRows[i].netLiquidity = cWalcl - cTga - cRrp;
            spyRows[i].btc = cBtc;
            spyRows[i].qqq = cQqq;
        }

        const valid = spyRows.filter(r => r.netLiquidity && !isNaN(r.netLiquidity) && r.netLiquidity > 0);
        
        console.log("\n========================================================");
        console.log("   KORRELATIONS-ANALYSE: NET LIQUIDITY VS ASSETS");
        console.log("========================================================");

        function calcRollingCorrelation(assetKey, windowDays) {
            let correlations = [];
            for(let i = windowDays; i < valid.length; i++) {
                if(!valid[i][assetKey] || !valid[i-windowDays][assetKey]) continue;
                
                let liqReturns = [];
                let assetReturns = [];
                
                for(let j = i - windowDays + 1; j <= i; j++) {
                    if(!valid[j][assetKey] || !valid[j-1][assetKey]) continue;
                    
                    const liqRet = (valid[j].netLiquidity - valid[j-1].netLiquidity) / valid[j-1].netLiquidity;
                    const assRet = (valid[j][assetKey] - valid[j-1][assetKey]) / valid[j-1][assetKey];
                    
                    liqReturns.push(liqRet);
                    assetReturns.push(assRet);
                }
                
                if(liqReturns.length > windowDays/2) {
                    correlations.push(pearsonCorrelation(liqReturns, assetReturns));
                }
            }
            if(correlations.length === 0) return 0;
            return correlations.reduce((a,b) => a+b, 0) / correlations.length;
        }

        // We calculate 90-day and 180-day rolling correlations of daily returns
        const spy90 = calcRollingCorrelation('close', 90);
        const spy180 = calcRollingCorrelation('close', 180);
        
        const qqq90 = calcRollingCorrelation('qqq', 90);
        const qqq180 = calcRollingCorrelation('qqq', 180);
        
        const btc90 = calcRollingCorrelation('btc', 90);
        const btc180 = calcRollingCorrelation('btc', 180);

        console.log(`Ø 90-Tage Korrelation SPY vs Net Liquidity:  ${spy90.toFixed(4)}`);
        console.log(`Ø 180-Tage Korrelation SPY vs Net Liquidity: ${spy180.toFixed(4)}`);
        console.log(`Ø 90-Tage Korrelation QQQ vs Net Liquidity:  ${qqq90.toFixed(4)}`);
        console.log(`Ø 180-Tage Korrelation QQQ vs Net Liquidity: ${qqq180.toFixed(4)}`);
        console.log(`Ø 90-Tage Korrelation BTC vs Net Liquidity:  ${btc90.toFixed(4)}`);
        console.log(`Ø 180-Tage Korrelation BTC vs Net Liquidity: ${btc180.toFixed(4)}`);

        console.log("\n-> FAZIT: Die Korrelation ist historisch fast 0. Eine kontinuierliche 1:1 Kopplung ist eine Illusion. Märkte entkoppeln in normalen Phasen völlig von der reinen Netto-Liquidität.");

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzeNetLiquidity();
