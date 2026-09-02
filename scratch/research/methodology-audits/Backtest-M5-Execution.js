import 'dotenv/config';
import mysql from 'mysql2/promise';

async function run() {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    // Wir nehmen den Tag mit dem größten Gap-Down: April 2025
    // Da die Zeitstempel in UTC sind und wir nach dem "2025-04-06T22:00:00.000Z" (Sonntag Nacht / Montag Morgen Pre-Market) schauen
    // Der tatsächliche Handelstag ist Montag, der 7. April 2025.
    
    console.log("--- Signal-vs-Execution Hypothese: M5 Backtest ---");
    console.log("Asset: SPY");
    console.log("Szenario: Makro-Verkaufssignal ausgelöst am Freitag. Wir stehen vor einem massiven Gap-Down am Montag.");

    // Hole den Schlusskurs vom Freitag (letzte Kerze vor dem Gap)
    const prevDayQuery = `
        SELECT close, record_time 
        FROM market_data_m5 
        WHERE symbol = 'SPY' 
          AND record_time < '2025-04-07 00:00:00'
        ORDER BY record_time DESC 
        LIMIT 1;
    `;
    const [prevRows] = await connection.query(prevDayQuery);
    const prevClose = parseFloat(prevRows[0].close);
    
    // Hole alle M5 Kerzen des Crash-Tages (07.04.2025)
    const crashDayQuery = `
        SELECT record_time, open, high, low, close, volume
        FROM market_data_m5
        WHERE symbol = 'SPY'
          AND record_time >= '2025-04-07 00:00:00'
          AND record_time < '2025-04-08 00:00:00'
        ORDER BY record_time ASC;
    `;
    const [crashCandles] = await connection.query(crashDayQuery);
    
    if(crashCandles.length === 0) {
        console.log("Keine Kerzen für den Crash-Tag gefunden.");
        await connection.end();
        return;
    }

    const firstCandle = crashCandles[0];
    const naiveExecutionPrice = parseFloat(firstCandle.open);
    const naiveSlippage = ((naiveExecutionPrice - prevClose) / prevClose) * 100;

    console.log(`\n[Vortag] Schlusskurs (Referenz für Makro-Signal): $${prevClose.toFixed(2)}`);
    console.log(`\n--- Strategie A: Naive Execution (Verkauf zur Markteröffnung) ---`);
    console.log(`Verkauf bei: $${naiveExecutionPrice.toFixed(2)} (${new Date(firstCandle.record_time).toISOString()})`);
    console.log(`Ergebnis: ${naiveSlippage.toFixed(2)}% Slippage / Reibungsverlust`);

    console.log(`\n--- Strategie B: Fractal Execution (VWAP Mean-Reversion) ---`);
    console.log(`Logik: Wir berechnen den Intraday-VWAP. Wir verkaufen erst, wenn sich der Markt vom initialen Schock etwas erholt und der Preis den VWAP nach oben kreuzt. Fallback: Verkauf am Tagesende.`);
    
    let smartExecutionPrice = null;
    let smartExecutionTime = null;
    let cumVolume = 0;
    let cumTypicalVolume = 0;

    for (let i = 0; i < crashCandles.length; i++) {
        const c = crashCandles[i];
        const open = parseFloat(c.open);
        const high = parseFloat(c.high);
        const low = parseFloat(c.low);
        const close = parseFloat(c.close);
        const volume = parseFloat(c.volume) || 1; // Fallback falls volume 0
        
        // Berechne Intraday VWAP
        const typicalPrice = (high + low + close) / 3;
        cumTypicalVolume += typicalPrice * volume;
        cumVolume += volume;
        const currentVwap = cumTypicalVolume / cumVolume;
        
        // Wenn der Markt den initialen Dip absorbiert hat und über den VWAP steigt -> Verkaufen!
        // Wir ignorieren die allerersten 3 Kerzen (15 Minuten), um die Eröffnungsvolatilität herauszufiltern.
        if (i >= 3 && close > currentVwap) {
            smartExecutionPrice = close;
            smartExecutionTime = c.record_time;
            break;
        }
    }

    // Fallback: Wenn der Markt den ganzen Tag unter dem VWAP blieb, verkaufen wir zur letzten Kerze
    if (!smartExecutionPrice) {
        const lastCandle = crashCandles[crashCandles.length - 1];
        smartExecutionPrice = parseFloat(lastCandle.close);
        smartExecutionTime = lastCandle.record_time;
        console.log(`(Info: VWAP wurde nie überschritten. Fallback-Verkauf am Tagesende.)`);
    }

    const smartSlippage = ((smartExecutionPrice - prevClose) / prevClose) * 100;
    
    console.log(`Verkauf bei: $${smartExecutionPrice.toFixed(2)} (${new Date(smartExecutionTime).toISOString()})`);
    console.log(`Ergebnis: ${smartSlippage.toFixed(2)}% Slippage / Reibungsverlust`);

    console.log(`\n--- FAZIT ---`);
    const savedCapital = smartSlippage - naiveSlippage;
    console.log(`Durch das Abwarten auf eine Intraday-Reversion (Fractal Execution) wurden **+${savedCapital.toFixed(2)}%** Performance (Edge) auf das Portfolio gerettet, verglichen mit einem unlimitierten Verkauf zur Markteröffnung.`);

    await connection.end();
}

run().catch(console.error);
