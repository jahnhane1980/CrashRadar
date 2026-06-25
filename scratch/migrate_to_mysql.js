import 'dotenv/config';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const SQLITE_PATH = './data/Liquidity.sqlite';

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Keine DATABASE_URL in .env gefunden!');
    process.exit(1);
  }

  console.log('🔄 Verbinde mit TiDB (MySQL)...');
  const mysqlDb = await mysql.createConnection(process.env.DATABASE_URL);
  console.log('✅ Verbunden mit TiDB.');

  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`❌ SQLite Datenbank nicht gefunden unter ${SQLITE_PATH}`);
    process.exit(1);
  }

  console.log('🔄 Verbinde mit lokaler SQLite...');
  const sqliteDb = new Database(SQLITE_PATH, { fileMustExist: true });
  console.log('✅ Verbunden mit SQLite.');

  const tables = [
    'sync_states',
    'market_data_binance',
    'market_data_tiingo',
    'market_data_yahoo',
    'econ_fred',
    'fiscal_tga',
    'fiscal_auctions',
    'macro_maturity_wall'
  ];

  console.log('\n🗑️  Lösche existierende Tabellen in TiDB (falls vorhanden)...');
  await mysqlDb.query('SET FOREIGN_KEY_CHECKS = 0;');
  for (const table of tables) {
    await mysqlDb.query(`DROP TABLE IF EXISTS ${table}`);
  }
  await mysqlDb.query('SET FOREIGN_KEY_CHECKS = 1;');

  console.log('\n🏗️  Erstelle Tabellen-Strukturen in TiDB...');
  
  const createStatements = [
    `CREATE TABLE sync_states (
      job_id VARCHAR(255) PRIMARY KEY,
      provider VARCHAR(255),
      cursor_data TEXT,
      updated_at VARCHAR(255)
    )`,
    `CREATE TABLE market_data_binance (
      symbol VARCHAR(255),
      interval_type VARCHAR(255),
      open_time BIGINT,
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      volume DOUBLE,
      quote_asset_volume DOUBLE,
      trades INT,
      taker_buy_base_asset_volume DOUBLE,
      close_time BIGINT,
      PRIMARY KEY (symbol, interval_type, open_time)
    )`,
    `CREATE TABLE market_data_tiingo (
      symbol VARCHAR(255),
      record_date VARCHAR(255),
      resolution VARCHAR(255),
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      volume DOUBLE,
      PRIMARY KEY (symbol, record_date, resolution)
    )`,
    `CREATE TABLE market_data_yahoo (
      symbol VARCHAR(255),
      record_date VARCHAR(255),
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      volume DOUBLE,
      PRIMARY KEY (symbol, record_date)
    )`,
    `CREATE TABLE econ_fred (
      series_id VARCHAR(255),
      observation_date VARCHAR(255),
      value DOUBLE,
      PRIMARY KEY (series_id, observation_date)
    )`,
    `CREATE TABLE fiscal_tga (
      record_date VARCHAR(255) PRIMARY KEY,
      open_balance DOUBLE,
      close_balance DOUBLE
    )`,
    `CREATE TABLE fiscal_auctions (
      auction_date VARCHAR(255),
      cusip VARCHAR(255),
      security_type VARCHAR(255),
      issue_date VARCHAR(255),
      maturity_date VARCHAR(255),
      total_accepted DOUBLE,
      high_yield DOUBLE,
      PRIMARY KEY (auction_date, cusip)
    )`,
    `CREATE TABLE macro_maturity_wall (
      record_date VARCHAR(255) PRIMARY KEY,
      maturing_90d_billions DOUBLE
    )`
  ];

  for (const stmt of createStatements) {
    await mysqlDb.query(stmt);
  }
  console.log('✅ Alle Tabellen erstellt.');

  console.log('\n🚀 Starte Datenmigration...');
  
  for (const table of tables) {
    // Hole alle Daten aus SQLite
    let rows;
    try {
      rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
    } catch (e) {
      if (e.message.includes('no such table')) {
        console.log(`⚠️  Tabelle ${table} existiert nicht in SQLite. Überspringe.`);
        continue;
      }
      throw e;
    }

    if (rows.length === 0) {
      console.log(`⏭️  Tabelle ${table} ist leer. Überspringe.`);
      continue;
    }

    // Hole Spaltennamen
    const columns = Object.keys(rows[0]);
    
    // Batch Insert vorbereiten
    const insertQuery = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`;
    
    // Wir wandeln das Array von Objekten in ein Array von Arrays für mysql2 um
    const values = rows.map(row => columns.map(col => row[col]));

    // Batch Inserts in Chunks von 5000 (falls sehr viele Daten existieren)
    const chunkSize = 5000;
    let inserted = 0;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      await mysqlDb.query(insertQuery, [chunk]);
      inserted += chunk.length;
    }

    console.log(`✅ ${inserted} Datensätze in '${table}' migriert.`);
  }

  console.log('\n🎉 Migration erfolgreich abgeschlossen!');
  
  sqliteDb.close();
  await mysqlDb.end();
}

migrate().catch(console.error);
