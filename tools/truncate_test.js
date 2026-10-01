import 'dotenv/config';
import mysql from 'mysql2/promise';

async function truncateTestDb() {
  const dbUrl = process.env.DATABASE_URL;
  const conn = await mysql.createConnection(dbUrl);

  try {
    const [tables] = await conn.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'liquidity_test' AND TABLE_TYPE = 'BASE TABLE'
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { TABLE_NAME } of tables) {
      await conn.query(`TRUNCATE TABLE \`liquidity_test\`.\`${TABLE_NAME}\``);
      console.log(`Geleert: liquidity_test.${TABLE_NAME}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n[OK] liquidity_test ist sauber bereinigt.');
  } finally {
    await conn.end();
  }
}

truncateTestDb();
