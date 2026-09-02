import 'dotenv/config';
import mysql from 'mysql2/promise';

async function run() {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    console.log("Connected to DB. Tables:");
    const [tables] = await connection.query('SHOW TABLES');
    console.log(tables.map(t => Object.values(t)[0]));

    // Check structure of market_data_m5
    console.log("\nStructure of market_data_m5:");
    const [columns] = await connection.query('SHOW COLUMNS FROM market_data_m5');
    console.log(columns.map(c => c.Field));

    // Get count of SPY in M5
    const [count] = await connection.query("SELECT COUNT(*) as c, MIN(record_time) as min_date, MAX(record_time) as max_date FROM market_data_m5 WHERE symbol = 'SPY'");
    console.log("\nSPY M5 Stats:");
    console.log(count[0]);

    await connection.end();
}

run().catch(console.error);
