import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function createCalendarTable() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  
  const ddl = `
    CREATE TABLE IF NOT EXISTS macro_calendar_events (
      id VARCHAR(64) NOT NULL,
      category VARCHAR(32) NOT NULL,
      subcategory VARCHAR(32) NOT NULL,
      title VARCHAR(128) NOT NULL,
      event_date DATE NOT NULL,
      event_time VARCHAR(32) DEFAULT NULL,
      status ENUM('SCHEDULED', 'CONFIRMED', 'ESTIMATED', 'COMPLETED', 'EXTENDED') NOT NULL DEFAULT 'SCHEDULED',
      criticality ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
      metadata_json JSON DEFAULT NULL,
      source VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_event_date (event_date),
      KEY idx_category_status (category, status),
      KEY idx_subcategory (subcategory)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    console.log('Creating table macro_calendar_events...');
    await pool.query(ddl);
    console.log('Table macro_calendar_events successfully created or already exists.');
  } catch (e) {
    console.error('Error creating table:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createCalendarTable();
