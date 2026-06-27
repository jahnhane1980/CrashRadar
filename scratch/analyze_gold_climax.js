import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);

    // Hole tägliche Golddaten (Preis und Volumen)
    const [rows] = await db.query(`
        SELECT record_date, close, volume
        FROM market_data_yahoo
        WHERE symbol = 'GC=F'
        ORDER BY record_date ASC
    `);

    if (rows.length === 0) {
        console.log("Keine Gold-Daten gefunden.");
        await db.end();
        return;
    }

    console.log("=== Analyse: Gold Volume Climax ===\n");

    const MA_PERIOD = 50; // 50-Tage Durchschnittsvolumen als Basis
    const VOLUME_MULTIPLIER = 2.5; // Ab wann ist ein Volumen "extrem"? (z.B. > 2.5x)
    const PRICE_DROP_THRESHOLD = -2.0; // Wie viel Prozent muss der Preis fallen für einen Selling Climax?

    for (let i = MA_PERIOD; i < rows.length; i++) {
        const current = rows[i];
        if (!current.volume || current.volume <= 0) continue;

        // Berechne das durchschnittliche Volumen der letzten 50 Tage
        let sumVolume = 0;
        for (let j = 1; j <= MA_PERIOD; j++) {
            sumVolume += rows[i - j].volume;
        }
        const avgVolume = sumVolume / MA_PERIOD;

        if (avgVolume === 0) continue;

        // Volumen Ratio
        const volRatio = current.volume / avgVolume;

        // Preisänderung zum Vortag
        const prevClose = rows[i - 1].close;
        const priceChangePct = ((current.close - prevClose) / prevClose) * 100;

        // SELLING CLIMAX: Massives Volumen + Starker Preisverfall
        if (volRatio >= VOLUME_MULTIPLIER && priceChangePct <= PRICE_DROP_THRESHOLD) {
            const dateStr = new Date(current.record_date).toISOString().substring(0, 10);
            console.log(`[SELLING CLIMAX] Datum: ${dateStr}`);
            console.log(`  Gold Preis: $${current.close.toFixed(2)} (${priceChangePct.toFixed(2)}%)`);
            console.log(`  Volumen: ${current.volume.toLocaleString()} (Avg: ${Math.round(avgVolume).toLocaleString()} -> ${volRatio.toFixed(1)}x)`);
            console.log(`-----------------------------------------------------`);
        }
        
        // BUYING CLIMAX: Massives Volumen + Starker Preisanstieg
        else if (volRatio >= VOLUME_MULTIPLIER && priceChangePct >= Math.abs(PRICE_DROP_THRESHOLD)) {
            const dateStr = new Date(current.record_date).toISOString().substring(0, 10);
            console.log(`[BUYING CLIMAX]  Datum: ${dateStr}`);
            console.log(`  Gold Preis: $${current.close.toFixed(2)} (+${priceChangePct.toFixed(2)}%)`);
            console.log(`  Volumen: ${current.volume.toLocaleString()} (Avg: ${Math.round(avgVolume).toLocaleString()} -> ${volRatio.toFixed(1)}x)`);
            console.log(`-----------------------------------------------------`);
        }
    }

    await db.end();
}

main().catch(console.error);
