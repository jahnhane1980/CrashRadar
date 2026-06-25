import { FinanceExpert } from '../src/FinanceExpert.js';

const expert = new FinanceExpert('./data/Liquidity.sqlite');
const data = expert.getDailyGroupedData('1999-12-01');

const crashes = [
    { name: "Dotcom-Blase", peak: "2000-03-24", trough: "2002-10-09" },
    { name: "Finanzkrise", peak: "2007-10-09", trough: "2009-03-09" },
    { name: "Zins-Panik 2018", peak: "2018-09-20", trough: "2018-12-24" },
    { name: "Corona-Crash", peak: "2020-02-19", trough: "2020-03-23" },
    { name: "Inflations-Schock", peak: "2022-01-03", trough: "2022-10-12" },
    { name: "Recent 2025 Crash", peak: "2025-02-19", trough: "2025-04-08" }
];

// Helper to extract nested macro value
function getMacro(d, metric) {
    if (!d) return null;
    const { NetLiquidity, FinancialConditions, BankingHealth, YieldCurve } = d.macroGroups;
    if (metric === 'WALCL') return NetLiquidity.WALCL;
    if (metric === 'TGA') return NetLiquidity.TGA;
    if (metric === 'RRPONTSYD') return NetLiquidity.RRPONTSYD;
    if (metric === 'DXY') return FinancialConditions.DXY;
    if (metric === 'DFII10') return FinancialConditions.RealYield10y;
    if (metric === 'NFCI') return FinancialConditions.ChicagoFedIndex;
    if (metric === 'TOTRESNS') return BankingHealth.TotalReserves;
    if (metric === 'BORROW') return BankingHealth.EmergencyBorrowing;
    if (metric === 'T10Y2Y') return YieldCurve.Spread10y2y;
    return null;
}

function getMetricAtOffset(targetDate, monthsOffset, metric) {
    const target = new Date(targetDate);
    target.setMonth(target.getMonth() + monthsOffset);
    const targetStr = target.toISOString().split('T')[0];
    return data.find(d => d.date >= targetStr && getMacro(d, metric) !== null);
}

const metrics = [
    { id: 'NFCI', name: 'Chicago Fed Stress Index (0=Normal, >0=Stress)' },
    { id: 'DFII10', name: '10Y Real Yield (Inflation-Adjusted)' },
    { id: 'T10Y2Y', name: '10Y-2Y Yield Spread (Inversion)' },
    { id: 'TOTRESNS', name: 'Bank Reserves (Liquidity)' },
    { id: 'TGA', name: 'Treasury General Account (TGA)' }
];

console.log("=== Analyse: Einzelne FED/Fiscal-Indikatoren VOR dem Crash (-3 Monate bis Top) ===\n");

crashes.forEach(c => {
    console.log(`[ ${c.name} ] - SPY Peak: ${c.peak}`);
    const peakData = data.find(d => d.date >= c.peak);
    
    metrics.forEach(m => {
        const pre3m = getMetricAtOffset(c.peak, -3, m.id);
        const valPre = getMacro(pre3m, m.id);
        const valPeak = getMacro(peakData, m.id);
        
        if (valPre !== null && valPeak !== null) {
            let diff = valPeak - valPre;
            let displayVal = `${valPre.toFixed(2)} -> ${valPeak.toFixed(2)}`;
            console.log(`  * ${m.name}: ${displayVal} (Diff: ${diff > 0 ? '+' : ''}${diff.toFixed(2)})`);
        } else {
            console.log(`  * ${m.name}: Daten fehlen (Pre: ${valPre}, Peak: ${valPeak})`);
        }
    });
    console.log("-------------------------------------------------------------------");
});
