import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    // Hole alle Daten seit dem Tiefpunkt im November 2022
    const [rows] = await db.query(`
        SELECT record_date, margin_debt 
        FROM macro_margin_debt 
        WHERE record_date >= '2022-11-01'
        ORDER BY record_date ASC 
    `);
    
    console.log("Entwicklung Margin Debt im aktuellen Bullenmarkt (seit Tiefpunkt 2022-11):");
    
    let trough = rows[0].margin_debt;
    let current = rows[rows.length - 1].margin_debt;

    // Wir geben jedes Quartal oder markante Sprünge aus, um es übersichtlich zu halten
    // Aber wir können auch einfach jeden 3. Monat ausgeben.
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const d = new Date(r.record_date);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        
        // Gebe Tiefpunkt aus, aktuellen Punkt, und jedes Quartal
        if (i === 0 || i === rows.length - 1 || d.getMonth() % 3 === 0) {
            const growthFromTrough = ((r.margin_debt - trough) / trough * 100).toFixed(1);
            console.log(`${year}-${month}: $${r.margin_debt.toLocaleString()} Millionen (${growthFromTrough > 0 ? '+' : ''}${growthFromTrough}%)`);
        }
    }

    console.log(`\nGesamtwachstum seit Tiefpunkt: +${((current - trough) / trough * 100).toFixed(1)}%`);
    await db.end();
}

main().catch(console.error);
