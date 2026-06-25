import { FinanceExpert } from '../src/FinanceExpert.js';

const expert = new FinanceExpert('./data/Liquidity.sqlite');
const data = expert.getDailyGroupedData('2002-01-01');

const crashes = [
    { name: "Finanzkrise", start: "2007-10-09", end: "2009-03-09" },
    { name: "Zins-Panik 2018", start: "2018-09-20", end: "2018-12-24" },
    { name: "Corona-Crash", start: "2020-02-19", end: "2020-03-23" },
    { name: "Inflations-Schock 2022", start: "2022-01-03", end: "2022-10-12" }
];

crashes.forEach(crash => {
    const startData = data.find(d => d.date >= crash.start && d.assets.SPY !== null);
    const endData = data.find(d => d.date >= crash.end && d.assets.SPY !== null);
    
    if(startData && endData) {
        const startYield = startData.macroGroups.FinancialConditions.RealYield10y;
        const endYield = endData.macroGroups.FinancialConditions.RealYield10y;
        
        console.log(`\n=== ${crash.name} ===`);
        console.log(`10Y Real Yield: ${startYield}% ➔ ${endYield}%`);
        
        if (endYield < startYield) {
            console.log("Ergebnis: Zinsen sind gefallen. Das bedeutet: MASSIVE KÄUFE von Anleihen (Flight to Safety).");
        } else {
            console.log("Ergebnis: Zinsen sind gestiegen. Das bedeutet: MASSIVER VERKAUF von Anleihen parallel zu Aktien.");
        }
    }
});
