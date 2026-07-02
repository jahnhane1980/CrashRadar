import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);

    // Hole monatliche Durchschnittsdaten für Gold und DFII10 (Realzinsen)
    const [rows] = await db.query(`
        SELECT 
            DATE_FORMAT(y.record_date, '%Y-%m') as month, 
            AVG(y.close) as gold,
            AVG(f.value) as real_rate
        FROM market_data_yahoo y
        LEFT JOIN econ_fred f 
            ON DATE_FORMAT(y.record_date, '%Y-%m') = DATE_FORMAT(f.observation_date, '%Y-%m')
            AND f.series_id = 'DFII10'
        WHERE y.symbol = 'GC=F'
        GROUP BY DATE_FORMAT(y.record_date, '%Y-%m')
        ORDER BY month ASC
    `);

    if (rows.length === 0) {
        console.log("Keine Daten gefunden.");
        await db.end();
        return;
    }

    console.log("=== Analyse: Gold vs. Realzinsen (DFII10) ===");
    console.log("Hypothese: Gold steigt nur, wenn Zinsen (insbesondere reale Zinsen) fallen.\n");

    const periods = [
        { name: "Post-GFC (Zinsen auf null, QE)", start: "2009-03", end: "2011-09" },
        { name: "Zinswende & Gold-Bärenmarkt", start: "2013-01", end: "2015-12" },
        { name: "Corona-Krise (Zinsen auf null)", start: "2020-01", end: "2020-08" },
        { name: "Zinsschock 2022", start: "2021-12", end: "2022-10" },
        { name: "Aktueller Bullenmarkt", start: "2022-11", end: "2026-06" }
    ];

    for (const p of periods) {
        const periodData = rows.filter(r => r.month >= p.start && r.month <= p.end && r.real_rate !== null);
        if (periodData.length < 2) {
             console.log(`\nPhase: ${p.name} -> Keine ausreichenden Daten`);
             continue;
        }

        const start = periodData[0];
        const end = periodData[periodData.length - 1];

        const goldGrowth = ((end.gold - start.gold) / start.gold * 100).toFixed(1);
        const rateChange = (end.real_rate - start.real_rate).toFixed(2);

        console.log(`\nPhase: ${p.name}`);
        console.log(`Realzins (DFII10): ${start.real_rate.toFixed(2)}% -> ${end.real_rate.toFixed(2)}% (Veränderung: ${rateChange > 0 ? '+' : ''}${rateChange}%)`);
        console.log(`Gold:              $${start.gold.toFixed(0)} -> $${end.gold.toFixed(0)} (${goldGrowth > 0 ? '+' : ''}${goldGrowth}%)`);
        
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        const n = periodData.length;
        for (const row of periodData) {
            const x = parseFloat(row.real_rate);
            const y = row.gold;
            sumX += x; sumY += y;
            sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
        }
        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const correlation = denominator === 0 ? 0 : (numerator / denominator).toFixed(2);
        
        let verdict = "";
        if (correlation < -0.5) verdict = "(Stark Negativ: Zinsen sinken = Gold steigt)";
        else if (correlation > 0.5) verdict = "(Positiv: Beide steigen)";
        else verdict = "(Kein klarer Zusammenhang)";

        console.log(`Korrelation (R):   ${correlation} ${verdict}`);
    }

    await db.end();
}

main().catch(console.error);
