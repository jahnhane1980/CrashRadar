import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);

    // Hole SPY und Margin Debt
    const [rows] = await db.query(`
        SELECT DATE_FORMAT(m.record_date, '%Y-%m') as month, ANY_VALUE(m.record_date) as record_date, ANY_VALUE(m.margin_debt) as margin_debt, ANY_VALUE(s.close) as spy
        FROM macro_margin_debt m
        LEFT JOIN market_data_tiingo s ON DATE_FORMAT(m.record_date, '%Y-%m') = DATE_FORMAT(s.record_date, '%Y-%m')
        WHERE s.symbol = 'SPY'
        GROUP BY DATE_FORMAT(m.record_date, '%Y-%m')
        ORDER BY month ASC
    `);

    // Wir definieren die Tiefpunkte der großen Crashes (SPY Bottom)
    const bottoms = [
        { name: "Dot-Com", date: "2002-09" }, // oder 2002-10
        { name: "Finanzkrise (GFC)", date: "2009-02" }, // oder 2009-03
        { name: "Corona-Crash", date: "2020-03" },
        { name: "Bear Market 2022", date: "2022-10" }
    ];

    for (const b of bottoms) {
        const bottomIndex = rows.findIndex(r => r.record_date.toISOString().startsWith(b.date));
        if (bottomIndex === -1) continue;

        console.log(`\n--- Erholungsphase: ${b.name} (Tiefpunkt: ${b.date}) ---`);
        const startDebt = rows[bottomIndex].margin_debt;
        const startSpy = rows[bottomIndex].spy;

        for (const monthsAfter of [0, 3, 6, 9, 12, 18]) {
            if (bottomIndex + monthsAfter < rows.length) {
                const r = rows[bottomIndex + monthsAfter];
                const debtGrowth = ((r.margin_debt - startDebt) / startDebt * 100).toFixed(1);
                const spyGrowth = ((r.spy - startSpy) / startSpy * 100).toFixed(1);
                console.log(`Monat +${String(monthsAfter).padEnd(2, ' ')} (${r.record_date.toISOString().substring(0,7)}): Margin Debt = ${debtGrowth.padStart(5, ' ')}% | SPY = ${spyGrowth.padStart(5, ' ')}%`);
            }
        }
    }

    await db.end();
}

main().catch(console.error);
