import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);

    // Hole Gold und Margin Debt aggregiert nach Monat
    const [rows] = await db.query(`
        SELECT 
            DATE_FORMAT(m.record_date, '%Y-%m') as month, 
            ANY_VALUE(m.record_date) as record_date, 
            ANY_VALUE(m.margin_debt) as margin_debt, 
            AVG(y.close) as gold_avg,
            MAX(y.close) as gold_max
        FROM macro_margin_debt m
        LEFT JOIN market_data_yahoo y 
            ON DATE_FORMAT(m.record_date, '%Y-%m') = DATE_FORMAT(y.record_date, '%Y-%m')
        WHERE y.symbol = 'GC=F'
        GROUP BY DATE_FORMAT(m.record_date, '%Y-%m')
        ORDER BY month ASC
    `);

    if (rows.length === 0) {
        console.log("Keine kombinierten Daten gefunden.");
        await db.end();
        return;
    }

    console.log("=== Analyse: Margin Debt vs Gold ===");
    
    // Berechne Korrelation über verschiedene Zeiträume
    // Wir betrachten 1. Große Bärenmärkte (GFC, Corona, 2022) und 2. Massive Bullenmärkte

    const periods = [
        { name: "Finanzkrise (2007-10 bis 2009-02)", start: "2007-10", end: "2009-02" },
        { name: "Post-GFC Bullenmarkt (2009-03 bis 2011-09)", start: "2009-03", end: "2011-09" },
        { name: "Langer Bullenmarkt (2013-01 bis 2019-12)", start: "2013-01", end: "2019-12" },
        { name: "Corona Crash & Rallye (2020-01 bis 2021-12)", start: "2020-01", end: "2021-12" },
        { name: "Bärenmarkt 2022 (2021-12 bis 2022-10)", start: "2021-12", end: "2022-10" },
        { name: "Aktueller Bullenmarkt (2022-11 bis Heute)", start: "2022-11", end: "2026-06" }
    ];

    for (const p of periods) {
        const periodData = rows.filter(r => r.month >= p.start && r.month <= p.end);
        if (periodData.length < 2) continue;

        const start = periodData[0];
        const end = periodData[periodData.length - 1];

        const debtGrowth = ((end.margin_debt - start.margin_debt) / start.margin_debt * 100).toFixed(1);
        const goldGrowth = ((end.gold_avg - start.gold_avg) / start.gold_avg * 100).toFixed(1);

        console.log(`\nPhase: ${p.name}`);
        console.log(`Margin Debt: ${start.margin_debt.toLocaleString()}M -> ${end.margin_debt.toLocaleString()}M (${debtGrowth > 0 ? '+' : ''}${debtGrowth}%)`);
        console.log(`Gold (Avg):  $${start.gold_avg.toFixed(0)} -> $${end.gold_avg.toFixed(0)} (${goldGrowth > 0 ? '+' : ''}${goldGrowth}%)`);
        
        // Pearson Korrelation für diese Phase
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        const n = periodData.length;
        for (const row of periodData) {
            const x = row.margin_debt;
            const y = row.gold_avg;
            sumX += x; sumY += y;
            sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
        }
        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const correlation = denominator === 0 ? 0 : (numerator / denominator).toFixed(2);
        
        console.log(`Korrelation (R): ${correlation} ${correlation > 0.5 ? '(Gleichlauf)' : correlation < -0.5 ? '(Gegenläufig)' : '(Kein starker linearer Zshg.)'}`);
    }

    await db.end();
}

main().catch(console.error);
