import { FinanceExpert } from '../src/FinanceExpert.js';

const expert = new FinanceExpert('./data/Liquidity.sqlite'); // Running from project root
const data = expert.getDailyGroupedData('2015-01-01');

// Helper for Correlation
function pearson(x, y) {
    const n = x.length;
    if(n === 0) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += x[i]; sumY += y[i]; sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
    }
    return (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
}

// Clean data (ensure we have values)
const clean = data.filter(d => 
    d.assets.SPY && d.assets.QQQ && 
    d.macroGroups.NetLiquidity.NetLiquidity && 
    d.macroGroups.FinancialConditions.DXY && 
    d.macroGroups.YieldCurve.Spread10y2y !== null
);

console.log(`Analyzing ${clean.length} days of data...\n`);

function analyzeROC(offsetDays) {
    const spyRet = [];
    const btcRet = [];
    const liqRet = [];
    const dxyRet = [];
    
    for (let i = offsetDays; i < clean.length; i++) {
        const prev = clean[i - offsetDays];
        const curr = clean[i];
        
        spyRet.push((curr.assets.SPY - prev.assets.SPY) / prev.assets.SPY);
        if (curr.assets.BTC && prev.assets.BTC) {
            btcRet.push((curr.assets.BTC - prev.assets.BTC) / prev.assets.BTC);
        }
        liqRet.push((curr.macroGroups.NetLiquidity.NetLiquidity - prev.macroGroups.NetLiquidity.NetLiquidity) / Math.abs(prev.macroGroups.NetLiquidity.NetLiquidity));
        dxyRet.push((curr.macroGroups.FinancialConditions.DXY - prev.macroGroups.FinancialConditions.DXY) / prev.macroGroups.FinancialConditions.DXY);
    }

    console.log(`--- ${offsetDays} Day Rate of Change (Momentum) ---`);
    console.log(`Correlation SPY vs Net Liquidity: ${(pearson(spyRet, liqRet)).toFixed(2)}`);
    console.log(`Correlation SPY vs DXY: ${(pearson(spyRet, dxyRet)).toFixed(2)}`);
    // Need a subset for BTC because it might have less data
    if (btcRet.length === liqRet.length) {
         console.log(`Correlation BTC vs Net Liquidity: ${(pearson(btcRet, liqRet)).toFixed(2)}`);
    }
}

analyzeROC(30); // 1-month momentum
analyzeROC(90); // 3-month momentum
analyzeROC(180); // 6-month momentum

// Spread Analysis (Inversion vs Un-inversion)
let invertedPeriods = 0;
let wasInverted = false;

// Check market performance during inverted vs normal
let spyReturnInverted = 0;
let spyReturnNormal = 0;
let daysInverted = 0;
let daysNormal = 0;

for (let i = 1; i < clean.length; i++) {
    const spread = clean[i].macroGroups.YieldCurve.Spread10y2y;
    const dailySpyRet = (clean[i].assets.SPY - clean[i-1].assets.SPY) / clean[i-1].assets.SPY;
    
    if (spread < 0) {
        spyReturnInverted += dailySpyRet;
        daysInverted++;
        wasInverted = true;
    } else {
        spyReturnNormal += dailySpyRet;
        daysNormal++;
        wasInverted = false;
    }
}
console.log(`\n--- Yield Curve Spread Analysis ---`);
console.log(`Avg Daily SPY Return when Yield Curve is POSITIVE (Normal): ${((spyReturnNormal/daysNormal)*100).toFixed(4)}%`);
console.log(`Avg Daily SPY Return when Yield Curve is NEGATIVE (Inverted): ${((spyReturnInverted/daysInverted)*100).toFixed(4)}%`);
