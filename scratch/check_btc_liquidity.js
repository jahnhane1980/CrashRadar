import 'dotenv/config';
import { FinanceExpert } from '../src/services/FinanceExpert.js';

function calculateCorrelation(xArray, yArray) {
    if (xArray.length !== yArray.length || xArray.length === 0) return 0;
    const n = xArray.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += xArray[i];
        sumY += yArray[i];
        sumXY += xArray[i] * yArray[i];
        sumX2 += xArray[i] * xArray[i];
        sumY2 += yArray[i] * yArray[i];
    }
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denominator === 0) return 0;
    return numerator / denominator;
}

async function checkLiquidityLongTerm() {
    try {
        const dbUrl = process.env.DATABASE_URL;
        const expert = new FinanceExpert(dbUrl);
        const data = await expert.getDailyGroupedData('2018-01-01');

        let btcRet90 = [];
        let liqRet90 = [];
        let btcRet180 = [];
        let liqRet180 = [];

        // Wir brauchen nur Tage mit validen Daten
        const validData = data.filter(row => 
            row.assets.BTC !== null && 
            row.macroGroups.NetLiquidity.NetLiquidity !== null && 
            row.macroGroups.NetLiquidity.NetLiquidity > 0
        );

        for (let i = 180; i < validData.length; i++) {
            const currentBtc = validData[i].assets.BTC;
            const currentLiq = validData[i].macroGroups.NetLiquidity.NetLiquidity;

            // 90 Tage Return
            const past90Btc = validData[i-90].assets.BTC;
            const past90Liq = validData[i-90].macroGroups.NetLiquidity.NetLiquidity;
            
            btcRet90.push((currentBtc - past90Btc) / past90Btc);
            liqRet90.push((currentLiq - past90Liq) / past90Liq);

            // 180 Tage Return
            const past180Btc = validData[i-180].assets.BTC;
            const past180Liq = validData[i-180].macroGroups.NetLiquidity.NetLiquidity;
            
            btcRet180.push((currentBtc - past180Btc) / past180Btc);
            liqRet180.push((currentLiq - past180Liq) / past180Liq);
        }
        
        const corr90 = calculateCorrelation(btcRet90, liqRet90);
        const corr180 = calculateCorrelation(btcRet180, liqRet180);
        
        console.log(`=========================================`);
        console.log(`Korrelation (90-Tage Returns) BTC vs. Net Liq: ${corr90.toFixed(4)}`);
        console.log(`Korrelation (180-Tage Returns) BTC vs. Net Liq: ${corr180.toFixed(4)}`);
        console.log(`=========================================`);

        await expert.close();
    } catch (e) {
        console.error("Fehler:", e);
    }
}

checkLiquidityLongTerm();
