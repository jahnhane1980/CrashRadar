import 'dotenv/config';
import mysql from 'mysql2/promise';

async function run() {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    console.log("Analyzing SPY Gap Downs in M5 Data...");

    // Query to find the daily Open and Close by getting the first and last M5 candle of each day
    // Then calculate the gap percentage using LAG
    const query = `
        WITH DailyCandles AS (
            SELECT 
                DATE(record_time) as trading_day,
                MIN(record_time) as first_candle_time,
                MAX(record_time) as last_candle_time
            FROM market_data_m5
            WHERE symbol = 'SPY'
            GROUP BY DATE(record_time)
        ),
        DailyPrices AS (
            SELECT 
                d.trading_day,
                (SELECT open FROM market_data_m5 WHERE symbol = 'SPY' AND record_time = d.first_candle_time LIMIT 1) as daily_open,
                (SELECT close FROM market_data_m5 WHERE symbol = 'SPY' AND record_time = d.last_candle_time LIMIT 1) as daily_close
            FROM DailyCandles d
        ),
        GapAnalysis AS (
            SELECT 
                trading_day,
                daily_open,
                LAG(daily_close) OVER (ORDER BY trading_day) as prev_close
            FROM DailyPrices
        )
        SELECT 
            trading_day,
            prev_close,
            daily_open,
            ROUND(((daily_open - prev_close) / prev_close) * 100, 2) as gap_percent
        FROM GapAnalysis
        WHERE prev_close IS NOT NULL
        ORDER BY gap_percent ASC
        LIMIT 10;
    `;

    const [rows] = await connection.query(query);
    console.log("\nTop 10 Biggest Gap Downs (SPY):");
    console.table(rows);

    await connection.end();
}

run().catch(console.error);
