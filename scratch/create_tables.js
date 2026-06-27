import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS market_data_short_volume (
        symbol VARCHAR(20) NOT NULL,
        record_date DATE NOT NULL,
        short_volume BIGINT NOT NULL,
        total_volume BIGINT NOT NULL,
        short_volume_ratio DECIMAL(5,4) NOT NULL,
        PRIMARY KEY (symbol, record_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS market_data_pcr (
        record_date DATE NOT NULL,
        total_pcr DECIMAL(8,4),
        equity_pcr DECIMAL(8,4),
        index_pcr DECIMAL(8,4),
        PRIMARY KEY (record_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Tables created successfully.");
    process.exit(0);
}

run();
