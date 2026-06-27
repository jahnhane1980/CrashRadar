import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await db.query(`
        SELECT record_date, margin_debt 
        FROM macro_margin_debt 
        ORDER BY record_date DESC 
        LIMIT 8
    `);
    
    console.log("Margin Debt (Letzte 8 verfuegbare Monate):");
    rows.reverse().forEach(r => {
        const d = new Date(r.record_date);
        console.log(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}: $${r.margin_debt.toLocaleString()} Millionen`);
    });

    await db.end();
}

main().catch(console.error);
