import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;
  const pool = mysql.createPool(dbUrl);
  
  try {
    // Hole monatliche WLCFLL Daten
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(observation_date, '%Y-%m') as month, value 
      FROM econ_fred 
      WHERE series_id = 'WLCFLL' AND observation_date >= '2022-01-01'
      ORDER BY observation_date ASC
    `);

    // Let's filter to get one value per month
    const wlcfllByMonth = {};
    for (let r of rows) {
      if (!wlcfllByMonth[r.month]) wlcfllByMonth[r.month] = Number(r.value);
    }
    
    // Total auctions (Gross issuance of T-Bills + Notes) per month
    const [auctions] = await pool.query(`
      SELECT DATE_FORMAT(issue_date, '%Y-%m') as month, SUM(total_accepted)/1000000000 as total_issued_billions
      FROM fiscal_auctions
      WHERE issue_date >= '2022-01-01'
      GROUP BY month
      ORDER BY month ASC
    `);

    console.log("--- Foreign Absorption Analysis ---");
    let prevWlcfll = null;
    let totalForeignChange2023 = 0;
    let totalForeignChange2024 = 0;
    let totalForeignChange2025 = 0;
    
    for (let m of Object.keys(wlcfllByMonth).sort()) {
      let current = wlcfllByMonth[m];
      let diff = prevWlcfll !== null ? (current - prevWlcfll) / 1000 : 0; // WLCFLL is in millions, so diff in billions
      if (m.startsWith('2023')) totalForeignChange2023 += diff;
      if (m.startsWith('2024')) totalForeignChange2024 += diff;
      if (m.startsWith('2025')) totalForeignChange2025 += diff;
      prevWlcfll = current;
    }

    console.log(`Foreign Custody Net Change 2023: ${totalForeignChange2023.toFixed(2)} Billion USD`);
    console.log(`Foreign Custody Net Change 2024: ${totalForeignChange2024.toFixed(2)} Billion USD`);
    console.log(`Foreign Custody Net Change 2025: ${totalForeignChange2025.toFixed(2)} Billion USD`);

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
