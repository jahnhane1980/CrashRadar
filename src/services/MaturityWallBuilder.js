import mysql from 'mysql2/promise';

export class MaturityWallBuilder {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl || process.env.DATABASE_URL;
    if (!this.databaseUrl) {
      throw new Error("No database URL provided for MaturityWallBuilder.");
    }
    this.pool = mysql.createPool(this.databaseUrl);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async build(startDate = '2015-01-01') {
    console.log('Starte Aggregation der Maturity Wall ab:', startDate);

    console.log('Berechne Maturity Wall per analytischem SQL-Query (Vermeidung von N+1)...');

    // MySQL: Wir nutzen DATE_ADD für das Datum und REPLACE INTO anstelle von INSERT OR REPLACE
    const insertQuery = `
      REPLACE INTO macro_maturity_wall (record_date, maturing_90d_billions)
      SELECT 
        t.record_date,
        (
          SELECT IFNULL(SUM(a.total_accepted), 0) / 1000000000.0
          FROM fiscal_auctions a
          WHERE a.security_type LIKE '%Bill%'
            AND a.issue_date <= t.record_date
            AND a.maturity_date > t.record_date
            AND a.maturity_date <= DATE_ADD(t.record_date, INTERVAL 90 DAY)
        ) as maturing_90d_billions
      FROM (
        SELECT DISTINCT record_date 
        FROM fiscal_tga 
        WHERE record_date >= ?
      ) t
    `;

    const [info] = await this.pool.query(insertQuery, [startDate]);
    console.log(`Es wurden ${info.affectedRows} Zeilen bearbeitet (MySQL affectedRows) und in die Datenbank geschrieben.`);

    console.log('Maturity Wall Aggregation erfolgreich abgeschlossen!');
  }
}

// /* v8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
  const builder = new MaturityWallBuilder();
  builder.build().then(() => builder.close()).catch(console.error);
}
// /* v8 ignore stop */
