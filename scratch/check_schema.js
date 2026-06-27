import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await db.query(`DESCRIBE market_data_fred`);
    console.log(rows);
    await db.end();
}
main().catch(console.error);
