import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    const p = mysql.createPool(process.env.DATABASE_URL);
    try {
        const [r] = await p.query('SHOW COLUMNS FROM market_data_fred');
        console.log("market_data_fred columns:");
        console.log(r);
        const [r2] = await p.query('SHOW COLUMNS FROM macro_margin_debt');
        console.log("macro_margin_debt columns:");
        console.log(r2);
        const [r4] = await p.query('SHOW COLUMNS FROM econ_fred');
        console.log("econ_fred columns:");
        console.log(r4);
    } catch(e) {
        console.error(e);
    } finally {
        await p.end();
    }
}
run();
