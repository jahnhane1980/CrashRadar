import 'dotenv/config';
import { FinanceExpert } from '../src/services/FinanceExpert.js';

const BOTTOMS = [
    { name: 'China Flash Crash', date: '2015-08-24' },
    { name: 'Industrial Recession', date: '2016-02-11' },
    { name: 'Christmas Eve Massacre', date: '2018-12-24' },
    { name: 'COVID-19 Crash', date: '2020-03-23' },
    { name: 'Inflation/Rate Shock', date: '2022-10-12' }
];

async function run() {
    const expert = new FinanceExpert(process.env.DATABASE_URL);
    const data = await expert.getDailyGroupedData('2015-01-01', { bypassMemoryGuard: true });
    
    console.log("# 📉 Historische Zyklus-Böden: Makro-Analyse");
    console.log("Analyse-Zeitraum: jeweils 3 Wochen VOR bis 3 Wochen NACH dem absoluten Tiefpunkt.\n");

    for (const bottom of BOTTOMS) {
        // Formatiere das Datum aus der DB für den Vergleich, falls nötig
        const bottomIndex = data.findIndex(d => d.date === bottom.date);
        
        if (bottomIndex === -1) {
            console.log(`## 🛑 ${bottom.name} (Tiefpunkt: ${bottom.date}) -> KEINE DATEN GEFUNDEN (Dates z.B. ${data[0].date} bis ${data[data.length-1].date})\n`);
            continue;
        }
        
        // 3 Wochen sind ca. 15 Handelstage
        const startIndex = Math.max(0, bottomIndex - 15);
        const endIndex = Math.min(data.length - 1, bottomIndex + 15);
        const windowData = data.slice(startIndex, endIndex + 1);

        console.log(`## 🛑 ${bottom.name} (Tiefpunkt: ${bottom.date})`);
        
        let maxVix = 0, maxVixDate = '';
        let maxVolRatio = 0, maxVolDate = '';
        let minSkew = 999, minSkewDate = '';
        let maxPcr = 0, maxPcrDate = '';
        let spyDrop = 0;
        let lowestSpy = 99999, highestSpy = 0;
        
        // Vorherige 50-Tage Durchschnittsvolumen berechnen (bis zum Start des Fensters)
        let sumVol = 0, countVol = 0;
        for (let i = Math.max(0, startIndex - 50); i < startIndex; i++) {
            if (data[i].assets.SPY_Volume) {
                sumVol += data[i].assets.SPY_Volume;
                countVol++;
            }
        }
        const avg50dVol = countVol > 0 ? sumVol / countVol : 1;

        for (const day of windowData) {
            const spy = day.assets.SPY;
            if (spy < lowestSpy) lowestSpy = spy;
            if (spy > highestSpy) highestSpy = spy;
            
            const vix = day.assets.VIX;
            if (vix > maxVix) { maxVix = vix; maxVixDate = day.date; }
            
            const skew = day.assets.SKEW;
            if (skew && skew < minSkew) { minSkew = skew; minSkewDate = day.date; }
            
            const pcr = day.macroGroups.Sentiment?.TotalPCR;
            if (pcr && pcr > maxPcr) { maxPcr = pcr; maxPcrDate = day.date; }
            
            const vol = day.assets.SPY_Volume;
            if (vol) {
                const ratio = vol / avg50dVol;
                if (ratio > maxVolRatio) { maxVolRatio = ratio; maxVolDate = day.date; }
            }
        }
        
        spyDrop = ((lowestSpy - highestSpy) / highestSpy) * 100;
        
        console.log(`- **SPY Drop (im Fenster)**: ${spyDrop.toFixed(2)}%`);
        console.log(`- **Max VIX (Panik)**: ${maxVix.toFixed(2)} am ${maxVixDate}`);
        if (minSkew !== 999) console.log(`- **Min SKEW (Absicherung aufgelöst)**: ${minSkew.toFixed(2)} am ${minSkewDate}`);
        if (maxPcr > 0) console.log(`- **Max Put/Call-Ratio**: ${maxPcr.toFixed(2)} am ${maxPcrDate}`);
        console.log(`- **Max SPY Volumen-Spike**: ${maxVolRatio.toFixed(2)}x (vs 50d) am ${maxVolDate}`);
        
        console.log("");
    }

    await expert.close();
}

run().catch(console.error);
