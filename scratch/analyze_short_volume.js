import mysql from 'mysql2/promise';
import 'dotenv/config';

async function analyze() {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    const tickers = ['ZETA', 'NVTS', 'SOFI'];

    for (const ticker of tickers) {
        console.log(`\n==========================================`);
        console.log(`Analyse für: ${ticker}`);
        console.log(`==========================================`);

        const query = `
            SELECT 
                t.record_date,
                t.close,
                s.short_volume_ratio,
                s.short_volume,
                s.total_volume
            FROM market_data_tiingo t
            JOIN market_data_short_volume s 
              ON t.symbol = s.symbol AND t.record_date = s.record_date
            WHERE t.symbol = ?
            ORDER BY t.record_date ASC
        `;

        const [rows] = await pool.query(query, [ticker]);
        if (rows.length === 0) {
            console.log(`Keine Daten gefunden für ${ticker}`);
            continue;
        }

        // Berechne Durchschnittliches Short-Ratio
        const avgRatio = rows.reduce((sum, r) => sum + r.short_volume_ratio, 0) / rows.length;
        console.log(`Durchschnittliches Short-Volume-Ratio: ${(avgRatio * 100).toFixed(2)}%`);

        // Finde die Top 10 Tage mit dem höchsten Short-Ratio
        const sortedByShort = [...rows].sort((a, b) => b.short_volume_ratio - a.short_volume_ratio);
        const top10ShortDays = sortedByShort.slice(0, 10);

        console.log(`\nTop 10 Tage mit dem extremsten Short-Interesse (Ratio) und 10-Tages Forward-Return:`);
        
        let squeezeCount = 0;
        let crashCount = 0;

        top10ShortDays.forEach((day) => {
            const index = rows.findIndex(r => r.record_date === day.record_date);
            const futureIndex = Math.min(index + 10, rows.length - 1);
            
            if (futureIndex > index) {
                const futurePrice = rows[futureIndex].close;
                const currentPrice = day.close;
                const returnPct = ((futurePrice - currentPrice) / currentPrice) * 100;
                
                if (returnPct > 5) squeezeCount++;
                if (returnPct < -5) crashCount++;

                console.log(`- ${day.record_date}: Short-Ratio: ${(day.short_volume_ratio * 100).toFixed(1)}% | Kurs: $${currentPrice.toFixed(2)} -> Nach 10 Tagen: $${futurePrice.toFixed(2)} (${returnPct > 0 ? '+' : ''}${returnPct.toFixed(2)}%)`);
            }
        });

        console.log(`\nZusammenfassung für Extrem-Tage:`);
        console.log(`-> In ${squeezeCount} von 10 Fällen gab es danach einen Short-Squeeze/Rallye (> +5%)`);
        console.log(`-> In ${crashCount} von 10 Fällen hatten die Shorts recht und der Kurs crashte weiter (< -5%)`);
    }

    await pool.end();
}

analyze().catch(console.error);
