/**
 * ============================================================================
 * 🔍 ARCHITEKTUR-BEFUND & MIGRATIONS-AUFTRAG: FRED DATEN-PIPELINE
 * ============================================================================
 * Status / Befund (Stand September 2026):
 * - In `src/core/adapters/fetch/` existiert aktuell KEIN `FredFetchAdapter.js`!
 * - In `config/Database-Fetcher-Config.json` ist kein Task für die Federal Reserve konfiguriert.
 * - `FredAdapter.js` in `src/core/adapters/storage/` existiert zwar, wird aber mangels
 *   Fetch-Adapter im täglichen `TimeSeriesFetcher` nie automatisiert aufgerufen.
 *
 * Konsequenz:
 * - Dieses Skript ist momentan die EINZIGE Möglichkeit, die unverzichtbaren Zins-
 *   und Devisen-Zeitreihen (DGS10, DGS2, DEXJPUS, IRLTLT01JPM156N, DEXCHUS, MYAGM2CNM189N)
 *   in die Tabelle `econ_fred` zu laden bzw. zu aktualisieren.
 *
 * 🎯 TODO / MIGRATIONSAUFTRAG (Sprint 1 / Daten-Pipeline):
 * - Erstelle `src/core/adapters/fetch/FredFetchAdapter.js` (anbindend an die FRED API bzw. St. Louis Fed CSVs).
 * - Registriere die Series in `config/Database-Fetcher-Config.json` unter `TimeSeriesFetcher`.
 * - Sobald die automatisierte Pipeline steht, kann dieses Standalone-Skript archiviert werden.
 * ============================================================================
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const SERIES_TO_BACKFILL = [
  'DGS10',
  'DGS2',
  'DEXJPUS',
  'IRLTLT01JPM156N',
  'DEXCHUS',
  'MYAGM2CNM189N'
];

async function fetchFredSeriesCsv(seriesId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${seriesId}: HTTP ${res.status}`);
  }
  const text = await res.text();
  const lines = text.trim().split('\n');
  const records = [];
  
  // Header: DATE,SERIES_ID
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length >= 2) {
      const date = parts[0].trim();
      const valStr = parts[1].trim();
      if (valStr !== '.' && valStr !== '') {
        const num = parseFloat(valStr);
        if (!isNaN(num)) {
          records.push([seriesId, date, num]);
        }
      }
    }
  }
  return records;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL missing in environment.');
    process.exit(1);
  }

  const pool = mysql.createPool(dbUrl);

  try {
    for (const seriesId of SERIES_TO_BACKFILL) {
      console.log(`[Backfill] Lade ${seriesId} von FRED...`);
      const records = await fetchFredSeriesCsv(seriesId);
      console.log(`[Backfill] ${seriesId}: ${records.length} Datenpunkte erhalten. Speichere in econ_fred...`);

      // Batch insert in Chunks von 2000
      const chunkSize = 2000;
      let inserted = 0;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const query = `
          INSERT INTO econ_fred (series_id, observation_date, value)
          VALUES ?
          ON DUPLICATE KEY UPDATE value = VALUES(value)
        `;
        await pool.query(query, [chunk]);
        inserted += chunk.length;
      }
      console.log(`[Backfill] ${seriesId}: ${inserted} Einträge erfolgreich gespeichert.`);
    }

    console.log('\n[Backfill] Alle Serien erfolgreich aktualisiert!');
    
    // Check Status in DB
    const [rows] = await pool.query(
      `SELECT series_id, COUNT(1) as cnt, MIN(observation_date) as min_date, MAX(observation_date) as max_date 
       FROM econ_fred 
       WHERE series_id IN (?) 
       GROUP BY series_id`,
      [SERIES_TO_BACKFILL]
    );
    console.table(rows);
  } catch (err) {
    console.error('[Backfill Error]', err);
  } finally {
    await pool.end();
  }
}

main();
