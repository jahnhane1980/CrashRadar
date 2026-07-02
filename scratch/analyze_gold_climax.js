import dotenv from 'dotenv';
dotenv.config();
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { RegimeLabeler } from '../src/analysis/RegimeLabeler.js';

async function runGoldAnalysis() {
    console.log("Starte Gold (GC=F) Volume Climax Analyse...");
    const expert = new FinanceExpert(process.env.DATABASE_URL);
    
    // Wir holen Daten ab 2018, um Corona (2020) und 2022 Crash abzudecken
    const data = await expert.getDailyGroupedData('2018-01-01');
    
    // Labeler nutzen, um die echten SPY Bottoms zu kennen
    const spyCandles = data.map(d => ({
        date: d.date,
        close: d.assets.SPY,
        high: d.assets.SPY_High || d.assets.SPY,
        low: d.assets.SPY_Low || d.assets.SPY
    })).filter(c => c.close);
    
    const labeler = new RegimeLabeler(data, 'SPY');
    const labeledSpy = labeler.generateLabels();
    const spyBottoms = labeledSpy.filter(c => c.regime === 'CYCLE_BOTTOM').map(c => c.date);
    
    console.log(`\nGefundene historische SPY Bottoms (Ground Truth):`);
    spyBottoms.forEach(b => console.log(`- ${b}`));

    console.log("\n===============================================");
    console.log("SUCHE NACH GOLD VOLUME CLIMAX EREIGNISSEN");
    console.log("===============================================\n");

    const CLIMAX_MULTIPLIER = 3.0; // 3x höheres Volumen als normal
    const SMA_DAYS = 50;
    
    let climaxEvents = [];

    // 2-Stufen Logik: Trauma + Healing
    let traumaActive = false;
    let traumaDate = null;
    let traumaPrice = null;
    let traumaVolume = null;
    
    // SMA 20 für Breakout
    const BREAKOUT_SMA_DAYS = 20;

    for (let i = Math.max(SMA_DAYS, BREAKOUT_SMA_DAYS); i < data.length; i++) {
        const current = data[i];
        const gcClose = current.assets['Gold'];
        const gcVol = current.assets['Gold_Volume'];
        
        if (!gcClose || !gcVol) continue;

        // Berechne 50-Tage Durchschnittsvolumen
        let sumVol = 0, countVol = 0;
        for (let j = i - SMA_DAYS; j < i; j++) {
            if (data[j].assets['Gold_Volume'] > 0) {
                sumVol += data[j].assets['Gold_Volume'];
                countVol++;
            }
        }
        if (countVol === 0) continue;
        const avgVol = sumVol / countVol;
        
        // Berechne SMA 20 (Für Breakout)
        let sumPrice = 0, countPrice = 0;
        for (let j = i - BREAKOUT_SMA_DAYS; j < i; j++) {
            if (data[j].assets['Gold']) {
                sumPrice += data[j].assets['Gold'];
                countPrice++;
            }
        }
        if (countPrice === 0) continue;
        const sma20 = sumPrice / countPrice;

        // STUFE 1: TRAUMA-ERKENNUNG (Panik/Margin Call)
        // Volumen > 3x und Preis fällt stark (-2% in 10 Tagen)
        const past10 = data[i-10]?.assets['Gold'];
        const drop10 = past10 ? ((gcClose - past10) / past10) * 100 : 0;
        
        if (gcVol > avgVol * 3.0 && drop10 <= -2.0) {
            traumaActive = true;
            traumaDate = current.date;
            traumaPrice = gcClose;
            traumaVolume = (gcVol / avgVol).toFixed(1);
            console.log(`[TRAUMA ERKANNT] ${current.date} | Vol: ${traumaVolume}x | Drop 10T: ${drop10.toFixed(2)}% | Warte auf Heilung...`);
        }
        
        // Wenn Trauma zu alt wird (> 30 Tage), verfällt es
        if (traumaActive && (new Date(current.date) - new Date(traumaDate)) / (1000 * 60 * 60 * 24) > 30) {
            traumaActive = false;
        }

        // STUFE 2: HEILUNG (Breakout über SMA 20)
        // Wenn wir ein frisches Trauma haben UND Gold bricht JETZT von unten über den SMA 20 aus
        const prevClose = data[i-1]?.assets['Gold'];
        if (traumaActive && prevClose < sma20 && gcClose > sma20) {
            
            // SPY Performance in den 20 Tagen danach
            const future20 = Math.min(i + 20, data.length - 1);
            const spyNow = current.assets.SPY;
            const spyFuture = data[future20].assets.SPY;
            const spyReturn = (spyNow && spyFuture) ? ((spyFuture - spyNow) / spyNow) * 100 : null;

            climaxEvents.push({
                date: current.date,
                traumaDate: traumaDate,
                volMultiplier: traumaVolume,
                spyReturn: spyReturn ? spyReturn.toFixed(2) : 'N/A'
            });
            
            console.log(`✅ [BODEN GEFUNDEN] ${current.date} (Trauma am ${traumaDate}) | Gold SMA20 Breakout! | SPY 20T Return: +${climaxEvents[climaxEvents.length-1].spyReturn}%`);
            
            // Trauma resetten, damit wir nicht mehrmals beim gleichen Event feuern
            traumaActive = false;
        }
    }
    
    console.log("\n===============================================");
    console.log("FAZIT: 2-STUFEN-SYSTEM (SNEAKY BOTTOM DETECTOR)");
    console.log("===============================================\n");
    console.log(`Gefundene Signale: ${climaxEvents.length}`);

    await expert.close();
}

runGoldAnalysis().catch(console.error);
