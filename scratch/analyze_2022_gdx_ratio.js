import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AnalysisRepository } from '../src/core/repositories/AnalysisRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    const repo = new AnalysisRepository();
    try {
        const dates = ['2022-05-18', '2022-07-20', '2022-09-26', '2022-10-21'];
        for (const d of dates) {
            const [tiingo] = await repo.pool.query("SELECT close, volume FROM market_data_tiingo WHERE symbol = 'GDX' AND record_date = ?", [d]);
            const [yahoo] = await repo.pool.query("SELECT close, volume FROM market_data_yahoo WHERE symbol = 'GDX' AND record_date = ?", [d]);
            const row = tiingo[0] || yahoo[0];
            console.log(`Datum: ${d} | GDX Close: ${row?.close} | GDX Volume: ${row?.volume}`);
        }
    } finally {
        await repo.close();
    }
}
run();
