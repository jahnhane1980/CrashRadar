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

function getPriceAtOffset(targetDate, monthsOffset, asset) {
    const target = new Date(targetDate);
    target.setMonth(target.getMonth() + monthsOffset);
    const targetStr = target.toISOString().split('T')[0];
    
    // Nearest future available date
    return data.find(d => d.date >= targetStr && d.assets[asset] !== null);
}

// Finde den absoluten Tiefpunkt (Trough) eines Assets WÄHREND der Crashphase
function findLocalTrough(startDate, endDate, asset) {
    const slice = data.filter(d => d.date >= startDate && d.date <= endDate && d.assets[asset] !== null);
    if (!slice.length) return null;
    return slice.reduce((min, cur) => cur.assets[asset] < min.assets[asset] ? cur : min, slice[0]);
}

console.log("=== Analyse: Verhalten von Gold und Kupfer um Crash-Phasen ===\n");

crashes.forEach(c => {
    const peakDataGold = data.find(d => d.date >= c.peak && d.assets.Gold !== null);
    const troughDataGold = data.find(d => d.date >= c.trough && d.assets.Gold !== null);
    const peakDataCopper = data.find(d => d.date >= c.peak && d.assets.Copper !== null);
    const troughDataCopper = data.find(d => d.date >= c.trough && d.assets.Copper !== null);

    if(!peakDataGold || !troughDataGold || !peakDataCopper || !troughDataCopper) return;

    const pre6mGold = getPriceAtOffset(c.peak, -6, 'Gold');
    const pre6mCopper = getPriceAtOffset(c.peak, -6, 'Copper');

    const goldTrough = findLocalTrough(c.peak, c.trough, 'Gold');
    
    console.log(`[ ${c.name} ] - SPY Crash: ${c.peak} bis ${c.trough}`);
    
    // --- GOLD ---
    const gPrePerf = ((peakDataGold.assets.Gold - pre6mGold.assets.Gold) / pre6mGold.assets.Gold * 100).toFixed(1);
    const gCrashPerf = ((troughDataGold.assets.Gold - peakDataGold.assets.Gold) / peakDataGold.assets.Gold * 100).toFixed(1);
    const gMaxDrop = ((goldTrough.assets.Gold - peakDataGold.assets.Gold) / peakDataGold.assets.Gold * 100).toFixed(1);
    
    // Wenn Gold sein Tief VOR dem Aktienmarkt hatte, wie viele Tage davor?
    const daysBeforeSPY = goldTrough ? Math.round((new Date(c.trough) - new Date(goldTrough.date)) / (1000*60*60*24)) : 0;
    
    console.log(`  GOLD:`);
    console.log(`    Vorlauf (-6m):     ${gPrePerf > 0 ? '+' : ''}${gPrePerf}%`);
    console.log(`    Gesamt Crash:      ${gCrashPerf > 0 ? '+' : ''}${gCrashPerf}% (SPY Peak bis SPY Trough)`);
    console.log(`    Maximaler Drawdown währenddessen: ${gMaxDrop}% (Tief am ${goldTrough.date})`);
    if(daysBeforeSPY > 0) {
        console.log(`    -> Gold hat sein Tief ${daysBeforeSPY} Tage VOR dem SPY-Tief erreicht!`);
    } else {
        console.log(`    -> Gold fiel zusammen mit oder nach dem SPY weiter.`);
    }

    // --- KUPFER ---
    const cPrePerf = ((peakDataCopper.assets.Copper - pre6mCopper.assets.Copper) / pre6mCopper.assets.Copper * 100).toFixed(1);
    const cCrashPerf = ((troughDataCopper.assets.Copper - peakDataCopper.assets.Copper) / peakDataCopper.assets.Copper * 100).toFixed(1);
    
    console.log(`  KUPFER (Dr. Copper):`);
    console.log(`    Vorlauf (-6m):     ${cPrePerf > 0 ? '+' : ''}${cPrePerf}%`);
    console.log(`    Gesamt Crash:      ${cCrashPerf > 0 ? '+' : ''}${cCrashPerf}% (SPY Peak bis SPY Trough)\n`);
});
