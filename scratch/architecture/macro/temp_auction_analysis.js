import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("No DATABASE_URL found.");
    return;
  }
  
  const pool = mysql.createPool(dbUrl);
  
  try {
    // Check if we have data in fiscal_auctions
    const [count] = await pool.query('SELECT COUNT(*) as c FROM fiscal_auctions');
    console.log(`Rows in fiscal_auctions: ${count[0].c}`);
    
    if (count[0].c === 0) {
      console.log("No auction data available in the DB to analyze.");
      return;
    }

    // 1. Zinsentwicklung der T-Bills (4-Week, 8-Week etc.) seit Okt 2022 (Beginn SPY Bullenmarkt)
    const [yields] = await pool.query(`
      SELECT DATE_FORMAT(auction_date, '%Y-%m') as month,
             security_type,
             AVG(high_yield) as avg_yield
      FROM fiscal_auctions
      WHERE auction_date >= '2022-10-01'
        AND security_type LIKE '%Bill%'
        AND high_yield IS NOT NULL
      GROUP BY month, security_type
      ORDER BY month ASC
    `);
    
    console.log("\n--- Zinsentwicklung (T-Bills) seit Okt 2022 ---");
    const yieldByMonth = {};
    for (let r of yields) {
      if (!yieldByMonth[r.month]) yieldByMonth[r.month] = [];
      yieldByMonth[r.month].push(`${r.security_type}: ${Number(r.avg_yield).toFixed(2)}%`);
    }
    for (let m of Object.keys(yieldByMonth).sort()) {
      console.log(`${m} -> ${yieldByMonth[m].join(' | ')}`);
    }

    // 2. Fälligkeiten (Wann steht der große Berg an?)
    // Wir schauen in die Zukunft (ab heute 2026-07-10)
    const [futureMaturities] = await pool.query(`
      SELECT DATE_FORMAT(maturity_date, '%Y-%m') as month,
             SUM(total_accepted) / 1000000000 as total_billions
      FROM fiscal_auctions
      WHERE maturity_date >= '2026-07-01'
      GROUP BY month
      ORDER BY month ASC
      LIMIT 12
    `);
    
    console.log("\n--- Kommende Fälligkeiten (Der Große Berg) in Milliarden USD ---");
    for (let r of futureMaturities) {
      console.log(`${r.month}: $${Number(r.total_billions).toFixed(2)} Mrd.`);
    }

    // 3. Entwicklung des Volumens der ausgegebenen kurzfristigen Schulden
    const [volume] = await pool.query(`
      SELECT DATE_FORMAT(issue_date, '%Y-%m') as month,
             SUM(total_accepted) / 1000000000 as total_billions
      FROM fiscal_auctions
      WHERE issue_date >= '2022-10-01'
        AND security_type LIKE '%Bill%'
      GROUP BY month
      ORDER BY month ASC
    `);
    
    console.log("\n--- Neu ausgegebene T-Bills (Volumen in Milliarden USD) seit Okt 2022 ---");
    for (let r of volume) {
      console.log(`${r.month}: $${Number(r.total_billions).toFixed(2)} Mrd.`);
    }

  } catch (e) {
    console.error("Error running analysis:", e);
  } finally {
    await pool.end();
  }
}

run();
