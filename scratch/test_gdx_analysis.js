import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    const [gdxRows] = await db.query(`SELECT record_date, close, volume FROM market_data_tiingo WHERE symbol = 'GDX' ORDER BY record_date ASC`);
    await db.end();

    const data = gdxRows.map(r => ({
        date: r.record_date instanceof Date ? r.record_date.toISOString().substring(0, 10) : r.record_date,
        close: parseFloat(r.close),
        volume: parseFloat(r.volume)
    }));

    const SMA_WINDOW = 50;
    for (let i = 0; i < data.length; i++) {
        if (i >= SMA_WINDOW) {
            let sum = 0;
            for (let j = 1; j <= SMA_WINDOW; j++) {
                sum += data[i - j].volume;
            }
            data[i].volSma50 = sum / SMA_WINDOW;
            data[i].volRatio = data[i].volume / data[i].volSma50;
        } else {
            data[i].volSma50 = null;
            data[i].volRatio = null;
        }
    }

    const climaxes = [];
    const SPIKE_THRESHOLD = 3.0;
    const RETURN_THRESHOLD = 5.0; // 5% Schwelle für den Crash/Spike

    for (let i = SMA_WINDOW + 20; i < data.length; i++) {
        if (data[i].volRatio > SPIKE_THRESHOLD) {
            const pastClose = data[i-1].close;
            const currentClose = data[i].close;
            const dailyRet = ((currentClose - pastClose) / pastClose) * 100;
            
            let futureRet = "N/A";
            let futureRetVal = 0;
            if (i + 20 < data.length) { // 20 Handelstage = ca. 4 Wochen
                futureRetVal = ((data[i+20].close - currentClose) / currentClose) * 100;
                futureRet = futureRetVal.toFixed(2) + "%";
            }

            let type = "";
            if (dailyRet <= -RETURN_THRESHOLD) type = "🔴 Selling Climax (Panik)";
            else if (dailyRet >= RETURN_THRESHOLD) type = "🟢 Buying Climax (FOMO)";
            else continue; // Ignorieren, da < 5% Bewegung

            climaxes.push({
                Date: data[i].date,
                Daily_Ret: dailyRet.toFixed(2) + "%",
                Vol_Ratio: data[i].volRatio.toFixed(1) + "x",
                Type: type,
                Future_4_Weeks: futureRet,
                _futureVal: futureRetVal
            });
        }
    }

    // Filter redundante Spikes (nur 1 Spike pro Woche anzeigen)
    const filterOverlaps = (arr) => {
        const res = [];
        let lastEnd = null;
        for (const item of arr) {
            if (!lastEnd || new Date(item.Date) - new Date(lastEnd) > 7 * 24 * 60 * 60 * 1000) {
                res.push(item);
                lastEnd = item.Date;
            }
        }
        return res;
    };

    const cleanClimaxes = filterOverlaps(climaxes);
    
    // Statistiken
    let sellClimaxCount = 0;
    let sellClimaxWins = 0; // Win = Preis stieg danach
    let sellAvgRet = 0;

    let buyClimaxCount = 0;
    let buyClimaxWins = 0; // Win = Preis fiel danach (Falle schnappt zu)
    let buyAvgRet = 0;

    for (let c of cleanClimaxes) {
        if (c.Type.includes("Selling")) {
            sellClimaxCount++;
            if (c._futureVal > 0) sellClimaxWins++;
            sellAvgRet += c._futureVal;
        } else {
            buyClimaxCount++;
            if (c._futureVal < 0) buyClimaxWins++;
            buyAvgRet += c._futureVal;
        }
    }

    console.table(cleanClimaxes.map(c => ({
        Datum: c.Date,
        'Tages-Rendite': c.Daily_Ret,
        'Volumen': c.Vol_Ratio,
        'Alarm-Typ': c.Type,
        'Rendite (nach 4 Wochen)': c.Future_4_Weeks
    })));

    console.log("\n=== 📊 ZUSAMMENFASSUNG DER STRATEGIE ===");
    console.log(`\n🔴 SELLING CLIMAX (Boden gefunden):`);
    console.log(`Anzahl Alarme: ${sellClimaxCount}`);
    console.log(`Trefferquote (Rendite > 0% nach 4 Wochen): ${((sellClimaxWins/sellClimaxCount)*100).toFixed(1)}%`);
    console.log(`Durchschnittliche Rendite nach 4 Wochen: +${(sellAvgRet/sellClimaxCount).toFixed(2)}%`);

    console.log(`\n🟢 BUYING CLIMAX (Bullenfalle schnappt zu):`);
    console.log(`Anzahl Alarme: ${buyClimaxCount}`);
    console.log(`Trefferquote (Rendite < 0% nach 4 Wochen): ${((buyClimaxWins/buyClimaxCount)*100).toFixed(1)}%`);
    console.log(`Durchschnittlicher Absturz nach 4 Wochen: ${(buyAvgRet/buyClimaxCount).toFixed(2)}%`);

}

main().catch(console.error);
