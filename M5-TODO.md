# M5 Data Ingestion: Technische Dokumentation & TODO

## 1. Provider & Authentifizierung
- **Provider:** Polygon.io
- **API-Key Referenz:** `process.env.POLYGONIO_API_KEY`
- **Code-Stelle:** `services/PolygonIoService.js:9` (sowie `services/MarketStatusService.js:7`)

## 2. API-Kommunikation
- **Client/Bibliothek:** `ky` (HTTP-Client basierend auf Fetch API, importiert in `src/services/PolygonIoService.js`)
- **Endpoint/URL:** 
  - Basis-URL: `https://api.polygon.io/v2` (definiert in `src/constants/ApiConfig.js:2`)
  - Pfad: `aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}`
  - Vollständige M5-URL: `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/5/minute/${fromDateStr}/${toDateStr}?adjusted=true&sort=asc&limit=50000&apiKey=${this.apiKey}`
  - Paginierungs-URL: Folgt `response.next_url` (Präfix `https://api.polygon.io/v2/` wird entfernt und `&apiKey=${this.apiKey}` angehängt)
  - Marktstatus-Check: `https://api.polygon.io/v1/marketstatus/now` (`src/constants/ApiConfig.js:3`)
- **Parameter & Headers:**
  - **HTTP-Methode:** `GET`
  - **Headers:** Standard `ky`-Headers (Authentifizierung erfolgt per Query-Parameter)
  - **Pfad-Parameter:**
    - `ticker`: Ticker-Symbol des Wertpapiers (z. B. `AAPL`)
    - `multiplier`: `5` (5 Einheiten)
    - `timespan`: `'minute'` (Minuten-Aggregat)
    - `from`: Startdatum im Format `YYYY-MM-DD`
    - `to`: Enddatum im Format `YYYY-MM-DD`
  - **Query-Parameter:**
    - `adjusted=true`: Bereinigung um Splits und Dividenden
    - `sort=asc`: Aufsteigende chronologische Sortierung
    - `limit=50000`: Maximale Bar-Anzahl pro Response
    - `apiKey=${process.env.POLYGONIO_API_KEY}`: API-Schlüssel
- **Call-Flow:**
  1. `Router.runM5Sync()` (`src/core/Router.js:159`):
     - Prüft Marktstatus via `MarketStatusService.isMarketOpen()` (`src/services/MarketStatusService.js:10`).
     - Holt Instanz von `M5Controller` aus `ControllerRegistry` (`src/core/ControllerRegistry.js:127`).
     - Startet `M5Controller.runSync(isMarketOpen)`.
  2. `M5Controller.runSync()` (`src/controllers/M5Controller.js:22`):
     - Ruft `TickerRepository.getTickersForJob('M5')` auf (`src/repositories/TickerRepository.js:43`).
     - Ermittelt für jeden Ticker:
       - `CandleRepository.getLatestM5Timestamp(ticker.id)` (`src/repositories/CandleRepository.js:45`).
       - `CandleRepository.getArchivedUntilTimestamp(ticker.id)` (`src/repositories/CandleRepository.js:9`).
       - Berechnet Sync-Spanne via `DateHelper.getSyncRange(latestTimestamp, { offsetSeconds: 300 })` (`src/core/DateHelper.js:51`).
     - Bewertet `isBackfill`, `isMarketOpen` und `isUpToDate`.
     - Übergibt Chunk-Callback an `PolygonIoService.fetchHistoricalData(...)`.
  3. `PolygonIoService.fetchHistoricalData()` (`src/services/PolygonIoService.js:31`):
     - Führt HTTP-GET via `ky` aus.
     - Reicht `response.results` an `onChunkReceived` weiter.
     - Verarbeitet `response.next_url` mit 12s Wartezeit (`pacingManager.sleepMs(12000)`).
     - Fängt HTTP 429 (`TOO_MANY_REQUESTS`) ab und wartet 65s (`pacingManager.sleepMs(65000)`).
  4. Callback / Persistierung:
     - Ruft `CandleRepository.upsertM5Candles(ticker.id, chunk)` auf (`src/repositories/CandleRepository.js:110`).

## 3. Datenbankstruktur
- **Tabelle:** `market_m5_candles` (im Haupt-Supabase-Projekt; zusätzlich `archive_market_m5_log` im Haupt-Projekt und `market_m5_candles` in der Archiv-DB)
- **Model/Schema-Datei:** Keine deklarative ORM-Model-Datei vorhanden. Definition und Feld-Mapping befinden sich direkt in `src/repositories/CandleRepository.js` (Zeilen 110–138) unter Nutzung des Supabase-Clients (`@supabase/supabase-js`, `src/core/SupabaseClient.js`).
- **Spalten & Typen:**
  | Spalte | Datentyp | Constraints / Index | Beschreibung |
  |---|---|---|---|
  | `ticker` | `INTEGER` / `BIGINT` | FOREIGN KEY (`ticker.id`), Composite Unique/PK Teil | Referenz auf Ticker-ID |
  | `timestamp` | `BIGINT` / `INTEGER` | Composite Unique/PK Teil, Index | Unix-Timestamp der Kerze in Sekunden (`Math.floor(candle.t / 1000)`) |
  | `open` | `NUMERIC` / `DOUBLE PRECISION` | NOT NULL | Eröffnungskurs (`candle.o`) |
  | `high` | `NUMERIC` / `DOUBLE PRECISION` | NOT NULL | Höchstkurs (`candle.h`) |
  | `low` | `NUMERIC` / `DOUBLE PRECISION` | NOT NULL | Tiefstkurs (`candle.l`) |
  | `close` | `NUMERIC` / `DOUBLE PRECISION` | NOT NULL | Schlusskurs (`candle.c`) |
  | `volume` | `BIGINT` / `INTEGER` | Default 0 | Gehandeltes Volumen, gerundet auf Ganzzahl (`Math.round(candle.v)`) |
  | `vwap` | `NUMERIC` / `DOUBLE PRECISION` | NULLABLE | Volumen-gewichteter Durchschnittskurs (`candle.vw`) |
  | `trades` | `INTEGER` / `BIGINT` | NULLABLE | Anzahl Transaktionen, gerundet auf Ganzzahl (`Math.round(candle.n)`) |
- **Insert/Update-Logik:**
  - Supabase Upsert mit Conflict-Target: `.upsert(mappedCandles, { onConflict: 'ticker, timestamp' })`.
  - Bei bestehenden Einträgen mit identischem Ticker und Timestamp werden die Felder aktualisiert ("On Conflict Do Update").

## 4. Offene Punkte / TODOs
- **API-Key Exposition in URL:** Der API-Key wird als Query-Parameter (`apiKey=...`) in die Request-URL eingebettet (`PolygonIoService.js:32, 46`). Besser wäre die Übertragung via `Authorization: Bearer <token>`-Header, um Leakage in Proxies, Server-Logs und Referrern zu verhindern.
- **Tagesgranularität im `from`-Parameter:** `DateHelper.getSyncRange` erzeugt Datumsstrings im Format `YYYY-MM-DD` (`toSqlDate`). Für untertägige M5-Syncs fordert dies bei Polygon immer ab 00:00:00 UTC des Starttages Daten an, was zu redundanten Übertragungen bereits vorhandener Tagesdaten führt. Polygon unterstützt auch Unix-Timestamps (Millisekunden) als `from`/`to`, was eine exakte Fortsetzung ermöglichen würde.
- **Fehlendes Inter-Ticker Pacing:** Bei Paginierung (`next_url`) wird 12s gewartet, und bei 429 65s. Zwischen verschiedenen Tickern in der `processItemsSafely`-Schleife (`M5Controller.js:31`) gibt es jedoch keine Zwangspause. Bei Free-Tier Kontingenten (5 Calls/Min) führt das bei mehr als 5 konfigurierten Tickern unweigerlich zu 429-Fehlern.
- **Fehlende Runtime-Validierung:** Die Rohdaten aus `response.results` werden ohne vorherige Validierung (z. B. via Zod) gemappt. Fehlen z. B. Preisdaten oder liefert Polygon ungültige Datentypen, schlägt der Prozess erst beim Supabase-Batch-Insert fehl.
- **Keine Transaktionsabsicherung über Chunks:** Werden große Datenmengen in mehreren Chunks gestreamt und bricht die Verbindung auf Seite 2 oder 3 ab, verbleibt ein unvollständiger Datenstand im System, der beim nächsten Durchlauf erneut überschrieben werden muss.
- **Strikte Abhängigkeit vom Archiv-Log:** Ist die Haupt-DB geleert und fehlt der Eintrag in `archive_market_m5_log` (`CandleRepository.js:10`), fällt `DateHelper.getSyncRange` auf den 2-Jahres-Backfill zurück.
