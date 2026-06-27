import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  await db.query(`
    CREATE TABLE IF NOT EXISTS macro_margin_debt (
      record_date DATE NOT NULL,
      margin_debt BIGINT NOT NULL,
      free_credit_cash BIGINT,
      free_credit_margin BIGINT,
      PRIMARY KEY (record_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Table macro_margin_debt created successfully!");
  await db.end();
}

main().catch(console.error);
