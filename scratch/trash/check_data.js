import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    
    try {
        const [holdings] = await pool.query('SELECT COUNT(*) as count, MIN(report_date) as min_date, MAX(report_date) as max_date FROM fund_13f_holdings');
        console.log(`[fund_13f_holdings] Zeilen: ${holdings[0].count} | Von: ${holdings[0].min_date} | Bis: ${holdings[0].max_date}`);

        const [dix] = await pool.query('SELECT COUNT(*) as count, MIN(record_date) as min_date, MAX(record_date) as max_date FROM market_data_dix');
        console.log(`[market_data_dix] Zeilen: ${dix[0].count} | Von: ${dix[0].min_date} | Bis: ${dix[0].max_date}`);

        const [aaii] = await pool.query('SELECT COUNT(*) as count, MIN(record_date) as min_date, MAX(record_date) as max_date FROM market_data_aaii');
        console.log(`[market_data_aaii] Zeilen: ${aaii[0].count} | Von: ${aaii[0].min_date} | Bis: ${aaii[0].max_date}`);

        const [naaim] = await pool.query('SELECT COUNT(*) as count, MIN(record_date) as min_date, MAX(record_date) as max_date FROM market_data_naaim');
        console.log(`[market_data_naaim] Zeilen: ${naaim[0].count} | Von: ${naaim[0].min_date} | Bis: ${naaim[0].max_date}`);

        const [states] = await pool.query("SELECT job_id, cursor_data, updated_at FROM sync_states WHERE job_id LIKE 'sec_13f_%' OR job_id = 'squeezemetrics_dix' ORDER BY job_id");
        console.log('\n[sync_states] Tabelle:');
        console.table(states);
    } catch(err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

run();
