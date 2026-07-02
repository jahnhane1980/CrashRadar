import { FinanceExpert } from '../src/FinanceExpert.js';

const expert = new FinanceExpert('./data/Liquidity.sqlite');
// TLT inception is roughly mid 2002
const data = expert.getDailyGroupedData('2003-01-01');

// SPY Crashes from Analyse.md (excluding Dotcom due to TLT inception)
const crashes = [
    { name: "Finanzkrise", peak: "2007-10-09", trough: "2009-03-09" },
    { name: "Zins-Panik 2018", peak: "2018-09-20", trough: "2018-12-24" },
    { name: "Corona-Crash", peak: "2020-02-19", trough: "2020-03-23" },
    { name: "Inflations-Schock", peak: "2022-01-03", trough: "2022-10-12" },
    { name: "Recent 2025 Crash", peak: "2025-02-19", trough: "2025-04-08" }
];

function getPriceAtOffset(targetDate, monthsOffset) {
    const target = new Date(targetDate);
    target.setMonth(target.getMonth() + monthsOffset);
    const targetStr = target.toISOString().split('T')[0];
    
    // Finde den ersten verfügbaren Handelstag nach/am diesem Datum
    return data.find(d => d.date >= targetStr && d.assets.TLT !== null);
}

console.log("=== Analyse: Verhalten von Anleihen (TLT) VOR und WÄHREND des Aktien-Crashes ===\n");

crashes.forEach(c => {
    const peakData = data.find(d => d.date >= c.peak && d.assets.TLT !== null);
    const troughData = data.find(d => d.date >= c.trough && d.assets.TLT !== null);
    
    const pre6m = getPriceAtOffset(c.peak, -6);
    const pre3m = getPriceAtOffset(c.peak, -3);
    
    if(peakData && troughData && pre6m && pre3m) {
        console.log(`[ ${c.name} ] - SPY Peak: ${c.peak}`);
        console.log(`  TLT Preis 6 Monate vorher: $${pre6m.assets.TLT.toFixed(2)}`);
        console.log(`  TLT Preis 3 Monate vorher: $${pre3m.assets.TLT.toFixed(2)}`);
        console.log(`  TLT Preis am SPY Top:      $${peakData.assets.TLT.toFixed(2)}`);
        console.log(`  TLT Preis am SPY Tief:     $${troughData.assets.TLT.toFixed(2)}`);
        
        const prePerf = ((peakData.assets.TLT - pre6m.assets.TLT) / pre6m.assets.TLT * 100).toFixed(1);
        const crashPerf = ((troughData.assets.TLT - peakData.assets.TLT) / peakData.assets.TLT * 100).toFixed(1);
        
        console.log(`  -> Vorlauf-Phase (-6m bis SPY Top): ${prePerf > 0 ? '+' : ''}${prePerf}%`);
        console.log(`  -> Crash-Phase (SPY Top bis Tief):  ${crashPerf > 0 ? '+' : ''}${crashPerf}%\n`);
    }
});
