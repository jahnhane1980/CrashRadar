import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;
  const pool = mysql.createPool(dbUrl);
  
  try {
    // 1. Hole WLCFLL (Foreign Custody of US Treasuries) und TOTRESNS (Bank Reserves)
    const [rows] = await pool.query(`
      SELECT observation_date as date, series_id, value 
      FROM econ_fred 
      WHERE series_id IN ('WLCFLL', 'TOTRESNS', 'WALCL') 
        AND observation_date >= '2020-01-01'
      ORDER BY observation_date ASC
    `);

    const dataByDate = {};
    for (let r of rows) {
      if (!dataByDate[r.date]) dataByDate[r.date] = {};
      dataByDate[r.date][r.series_id] = Number(r.value);
    }

    const dates = Object.keys(dataByDate).sort();
    
    // Wir betrachten bestimmte Zeitpunkte
    const milestones = ['2020-01-01', '2021-01-01', '2022-01-01', '2023-01-01', '2024-01-01', '2025-01-01', '2026-01-01', dates[dates.length-1]];
    
    console.log("--- Entwicklung: Ausländische Zentralbanken (WLCFLL) vs US Bankreserven (TOTRESNS) ---");
    console.log("Datum       | Foreign Custody (WLCFLL) | Bank Reserves (TOTRESNS) | Fed Balance Sheet (WALCL)");
    
    // Find closest dates to milestones
    for (let m of milestones) {
      let closestDate = dates.find(d => d >= m);
      if (closestDate && dataByDate[closestDate]) {
        const row = dataByDate[closestDate];
        const wl = row.WLCFLL ? (row.WLCFLL / 1000).toFixed(2) + " Mrd" : "N/A";
        const res = row.TOTRESNS ? (row.TOTRESNS / 1000).toFixed(2) + " Trillionen" : "N/A";
        const walcl = row.WALCL ? (row.WALCL / 1000000).toFixed(2) + " Trillionen" : "N/A";
        console.log(`${closestDate}  | ${wl.padEnd(24)} | ${res.padEnd(24)} | ${walcl}`);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
