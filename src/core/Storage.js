import mysql from 'mysql2/promise';
import { StorageAdapterFactory } from './adapters/storage/StorageAdapterFactory.js';
import { Logger } from './Logger.js';

export class Storage {
  constructor(config = {}) {
    this.databaseUrl = config.databaseUrl || process.env.DATABASE_URL;
    if (!this.databaseUrl) {
      throw new Error("No database URL provided for Storage.");
    }
    
    // Wir nutzen einen Connection-Pool, was für asynchrone Systeme deutlich
    // performanter und sicherer ist.
    this.pool = mysql.createPool(this.databaseUrl);
  }

  async getSyncState(job_id) {
    const [rows] = await this.pool.query('SELECT cursor_data FROM sync_states WHERE job_id = ?', [job_id]);
    return rows.length > 0 ? { cursor_data: rows[0].cursor_data } : undefined;
  }

  async getExistingFilings(cik) {
    if (!this.pool) return [];
    try {
      const [rows] = await this.pool.query(
        'SELECT DISTINCT report_date, filing_date FROM fund_13f_holdings WHERE cik = ?',
        [cik]
      );
      return rows;
    } catch (err) {
      Logger.warn(`[Storage] getExistingFilings failed: ${err.message}`);
      return [];
    }
  }

  async insertDataAndState(task, data, newLastRecord) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Insert Data via Adapter
      const adapter = StorageAdapterFactory.getAdapter(task.provider);
      const { query, values } = adapter.getInsertQueryAndValues(task, data) || { query: null, values: [] };
      
      if (query && values && values.length > 0) {
        await connection.query(query, [values]);
      }

      // 2. Update State
      const stateQuery = `
        INSERT INTO sync_states (job_id, provider, cursor_data, updated_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          cursor_data = VALUES(cursor_data),
          updated_at = VALUES(updated_at)
      `;
      await connection.query(stateQuery, [task.id, task.provider, JSON.stringify(newLastRecord), new Date()]);

      await connection.commit();
      Logger.info(`[Storage] Inserted/Updated ${data.length} items and state for task '${task.id}'`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async acquireLock(lockKey, ttlSeconds = 600) {
    const query = `
      INSERT INTO sync_locks (lock_key, expires_at)
      VALUES (?, DATE_ADD(NOW(), INTERVAL ? SECOND))
      ON DUPLICATE KEY UPDATE
        expires_at = IF(expires_at < NOW(), VALUES(expires_at), expires_at);
    `;
    const [result] = await this.pool.query(query, [lockKey, ttlSeconds]);
    return Boolean(result && result.affectedRows > 0);
  }

  async releaseLock(lockKey) {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM sync_locks WHERE lock_key = ?;', [lockKey]);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
