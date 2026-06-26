import mysql from 'mysql2/promise';
import 'dotenv/config';

async function createTable() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Keine DATABASE_URL gefunden.");

  const connection = await mysql.createConnection(dbUrl);
  
  console.log("Erstelle Tabelle fund_sec_edgar...");
  
  const query = `
    CREATE TABLE IF NOT EXISTS fund_sec_edgar (
      ticker VARCHAR(50) NOT NULL,
      record_date DATE NOT NULL,
      interest_expense DECIMAL(36,18),
      total_assets DECIMAL(36,18),
      net_income DECIMAL(36,18),
      PRIMARY KEY (ticker, record_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  
  await connection.query(query);
  console.log("Tabelle fund_sec_edgar erfolgreich erstellt!");
  
  await connection.end();
}

createTable().catch(console.error);
