# PROJECT-ANALYSIS.md — CrashRadar ETL Ingestion Engine

> Audit-Datum: 2026-10-02 | Scope: `index.js`, `config/`, `src/`, `.github/`

---

## 1. Executive Summary & Architektonischer Reifegrad

| Kategorie | Score | Bewertung |
|---|---|---|
| **CI/CD & Workflow-Design** | 4 / 10 | Kein Concurrency-Guard für `daily-fetch`, kein Job-Timeout, keine Artifact-Isolation |
| **Konfigurations-Design (DRY)** | 3 / 10 | 39+ identische FRED-Task-Blöcke, keine Template-Vererbung, kein JSON-Schema |
| **Runner / Concurrency / Locking** | 5 / 10 | Provider-Limits ohne Rate-Window, Lock-Mechanismus nicht atomar, keine Heartbeat-Erneuerung |
| **State Management (Cursor)** | 6 / 10 | Transaktion korrekt; Cursor-Schlüssel-Whitelist unvollständig, kein Revert-Mechanismus für Korrekturen |
| **Datenbankschema (Typen)** | 4 / 10 | `double` für Kurse, `varchar`-Datumsfelder nachweisbar, kein `decimal` |
| **Architektur / SOLID / DRY** | 6 / 10 | Adapter-Pattern solide; God-Switches im Fetcher-Core, OCP verletzt in FiscalDataAdapter |
| **Fehlertoleranz / Idempotenz** | 5 / 10 | Globale Fehler werden absorbiert; kein Dead-Letter-Queue, kein Payload-Logging bei Fehler |
| **Skalierbarkeit** | 4 / 10 | Single-Node-Prozess mit In-Process-Queue; keine horizontale Skalierbarkeit konzipiert |

**Gesamt-Reifegrad: ALPHA / Pre-Production.** Das System ist für Single-Node-Nachtläufe funktional, aber strukturell nicht für wachsende Provideranzahl, Parallelinstanzen oder kritische Datenkonsistenz ausgelegt.

---

## 2. Kritische Schwachstellen (Severity: HIGH / CRITICAL)

### 2.1 CRITICAL — Kein Concurrency-Guard für `daily-fetch.yml`

**Datei:** `.github/workflows/daily-fetch.yml` (gesamte Datei)

`m5-fetch.yml` besitzt eine `concurrency`-Group. `daily-fetch.yml` hat **keine**. Das cron-Trigger-Muster `0 1 * * 2-6` produziert exakt einen Run pro Nacht, jedoch gilt:

- Jeder `workflow_dispatch`-Aufruf (manuell) parallelisiert sofort mit dem laufenden Nacht-Cron.
- GitHub garantiert keine serialisierten Cron-Starts: bei Runner-Verfügbarkeitsengpässen kann ein neuer Cron starten, während der vorherige noch läuft.

Folge: Zwei parallele Instanzen konkurrieren zwar nicht um `m5_sync_lock`, aber um `sync_states`-Cursor für täglich laufende Tasks. `INSERT … ON DUPLICATE KEY UPDATE` auf `sync_states` ist nicht atomar mit dem vorgelagerten `getSyncState`-Read — ein klassisches TOCTOU-Problem. Zwei Runner lesen denselben Cursor, fetchen identische Zeiträume, schreiben identische Daten und setzen den Cursor auf denselben Stand.

**Mechanistisches Scheitern:** Race Window liegt zwischen `getSyncState()` (`TimeSeriesFetcher.js` Z. 207/253) und `insertDataAndState()` (Z. 220/307). Ohne serielle Lock-Absicherung auf Task-Ebene ist Doppelt-Ingestion unvermeidlich.

---

### 2.2 CRITICAL — Kein Workflow-Timeout → unbegrenzte Runner-Kosten

**Datei:** `.github/workflows/daily-fetch.yml`, `.github/workflows/m5-fetch.yml`

Keiner der Workflows definiert `timeout-minutes` auf Job- oder Step-Ebene. GitHub Actions Default-Timeout: **360 Minuten**. Ein hängender `requestManager.fetch()`-Call (z.B. TCP-Stall ohne `keepAlive`-Timeout auf TiDB-Pool-Ebene) blockiert den Runner für bis zu 6 Stunden.

`ky` setzt `timeout: 30000` (`RequestManager.js` Z. 56), aber **nur für einen Einzelrequest**. Die In-Process-Queue (`this.queues[providerId]`) akkumuliert unbegrenzt viele Promises. Schlägt eine Queue-Entry fehl und der Fehler wird im `.catch()`-Handler (Z. 125) ohne `reject`-Weiterleitung konsumiert, blockiert das den gesamten `Promise.allSettled()` nicht direkt, aber eine hängende HTTP-Verbindung (kein TCP-Reset, kein Server-Close) triggert den `ky`-Timeout nicht. Folge: der gesamte Run hängt bis GitHub den Runner nach 360 Minuten terminiert.

---

### 2.3 HIGH — Lock-Mechanismus nicht atomar: `affectedRows`-Semantik falsch

**Datei:** `src/core/Storage.js` Z. 71–79

```sql
INSERT INTO sync_locks (lock_key, expires_at)
VALUES (?, DATE_ADD(NOW(), INTERVAL ? SECOND))
ON DUPLICATE KEY UPDATE
  expires_at = IF(expires_at < NOW(), VALUES(expires_at), expires_at);
```

**Problem 1 — falsche `affectedRows`-Interpretation:**
Der `mysql2`-Treiber liefert `affectedRows`:
- `= 1` bei INSERT (Lock erworben ✓)
- `= 2` bei UPDATE mit geändertem Wert (Lock abgelaufen → Erwerb nach Ablauf, oder Lock aktiv → Wert identisch gesetzt durch `IF`-Umweg)
- `= 0` bei UPDATE ohne Wertänderung (je nach `CLIENT_FOUND_ROWS`-Flag)

Die aktuelle Prüfung `Boolean(result.affectedRows > 0)` (Z. 79) gibt `true` zurück in allen Fällen außer `affectedRows = 0`. Bei TiDB Cloud ohne explizites `flags: ['+FOUND_ROWS']` in der Connection-URL ist das Verhalten bei einem aktiven Lock mit unverändertem `expires_at` **undefiniert**. Zwei Prozesse können beide `true` erhalten und sich als Lock-Inhaber glauben.

**Problem 2 — keine Heartbeat-Erneuerung:**
TTL = 600s. Ein m5-Run mit 10 Tickers × Pagination-Schleife über Tage × 12,5s Throttling pro Request übersteigt leicht 600s. Nach TTL-Ablauf kann ein neuer Runner denselben Lock erwerben, während der erste noch in `insertDataAndState` schreibt.

**Problem 3 — kein Lock-Release bei `process.exit(0)` via SIGINT/SIGTERM:**
`index.js` Z. 13–24 ruft `activeRunner.cleanup()` → `storage.close()`. `releaseLock()` wird **nicht** aufgerufen. Der Lock bleibt bis TTL-Ablauf als Zombie.

---

### 2.4 HIGH — Phantom-Fortschritt durch FRED `"."`-Werte

**Datei:** `src/core/adapters/storage/FredAdapter.js` Z. 11, `src/services/PaginationStrategies.js` Z. 156–181

FRED gibt für noch nicht veröffentlichte Perioden `value: "."` zurück. `FredAdapter` schreibt `null` in die DB (`item.value === '.' ? null : item.value`). `insertDataAndState` committet erfolgreich, der Cursor rückt vor. Beim nächsten Lauf beginnt der Fetch **nach** diesem Datum. Kommt FRED später mit dem finalen Revisionswert, fetcht das System diesen Zeitpunkt nicht mehr nach. **Dauerhafte Datenlücke.**

Das gleiche Mechanismus betrifft alle Serien mit Revisionshorizont (NFP, JOLTS, PCE): vorläufige Werte werden eingefroren, Revisionen sind unsichtbar.

---

### 2.5 HIGH — `PolygonM5FetchAdapter` bypassed `RequestManager` vollständig

**Datei:** `src/core/adapters/fetch/PolygonM5FetchAdapter.js` Z. 64–68

```js
const headers = {
  Authorization: `Bearer ${process.env.POLYGONIO_API_KEY}`
};
const response = await fetch(url, { headers });
```

Der Adapter nutzt natives `fetch()`, nicht `RequestManager`. Folgen:
1. Auth liegt nicht in `Database-Fetcher-Config.json`, sondern implizit im Code.
2. Kein `Retry-After`-Header-Parsing — stattdessen Hard-coded 65s Sleep (Z. 74).
3. Kein Request-Caching via `RequestManager.cache`.
4. Kein zentrales Throttling über Provider-`requestsPerSecond`.
5. `POLYGONIO_API_KEY` ist nicht in `provider.auth.envVar` deklariert (Config Z. 157–162 enthält kein `auth`-Objekt).

---

### 2.6 HIGH — `SecEdgar13FFetchAdapter`: Temp-File-Kollisionsrisiko und I/O-Overhead

**Datei:** `src/core/adapters/fetch/SecEdgar13FFetchAdapter.js` Z. 153–168

```js
const tempFilePath = path.join(os.tmpdir(), `13f_${cik}_${filing.reportDate}_${Date.now()}.xml`);
fs.writeFileSync(tempFilePath, xmlText);
```

`Date.now()` im Dateinamen ist nicht kollisionssicher bei Millisekunden-Granularität unter Last. Bei zwei parallelen Runs (via `workflow_dispatch`) oder zwei CIKs mit identischem `reportDate` und Millisekunden-Gleichheit: stille Dateiüberschreibung.

Beim `process.kill(-9)` (OOM-Killer auf GitHub Runner) bleibt der Temp-File bestehen — kein Cleanup-Mechanismus außer dem `finally`-Block (der bei harten Kills nicht ausgeführt wird).

Zudem: `xmlText` liegt bereits vollständig im RAM. Der `fs.writeFileSync` + Stream-Parser-Roundtrip erzeugt unnötigen I/O. Direktes In-Memory-Parsing wäre korrekt.

---

### 2.7 HIGH — `RequestManager`-Cache semantisch falsch: fehlgeschlagene Promises gecached

**Datei:** `src/core/RequestManager.js` Z. 106–132

Der Cache speichert die **unresolved Promise**, nicht den Wert:

```js
this.cache.set(cacheKey, promise);
```

Schlägt der Request fehl (`reject`), wird Zeile 130 ausgeführt (`promise.catch(() => this.cache.delete(cacheKey))`). **Aber:** Die `delete`-Operation liegt im Promise-Chain des Consumer. Ruft ein zweiter Consumer dieselbe URL ab, bevor der erste Promise-Chain abgearbeitet ist, erhält er die fehlgeschlagene Promise zurück. Kein Retry-Versuch, sondern sofortiger Fehler.

Für Intraday-Daten: Der Cache hat kein TTL. Er wächst über den Prozess-Lebenszyklus unbegrenzt. Bei Full-Backfill-Runs mit 780+ FINRA-URLs akkumuliert der Cache 780+ Einträge ohne Eviction.

---

## 3. Architektur- & Design-Defizite

### 3.1 DRY-Verstoß: 39 identische FRED-Task-Deklarationen

**Datei:** `config/Database-Fetcher-Config.json` Z. 201–1229

Jeder der 39 FRED-Tasks hat exakt dieselbe Struktur — nur `id` und `series_id` variieren. Keine Template-Vererbung, kein Schemamodul. Jede Erweiterung (z.B. neues Feld `priority`) erfordert 39 manuelle Edits. Identisches Problem bei 25+ Tiingo-Tasks und 7 Finra-Short-Volume-Tasks.

---

### 3.2 OCP-Verletzung: `FiscalDataAdapter` als Task-ID-Switch

**Datei:** `src/core/adapters/storage/FiscalDataAdapter.js` Z. 6–43

```js
if (task.id === 'fiscaldata_tga') { ... }
else if (task.id === 'fiscaldata_auctions') { ... }
else if (task.id === 'fiscaldata_buybacks') { ... }
return { query: null, values: [] }; // stilles Verwerfen bei unbekanntem Task
```

Jeder neue FiscalData-Endpunkt erfordert Modifikation dieser Klasse. Der `return { query: null, values: [] }`-Fallback für unbekannte Task-IDs führt zu **stillem Datenverlust** ohne Exception. Identisches Muster in `YahooFinanceAdapter.js` (`task.method`-Switch).

---

### 3.3 OCP-Verletzung: `TimeSeriesFetcher` kennt Provider-Typen explizit

**Datei:** `src/services/TimeSeriesFetcher.js` Z. 127–131

```js
if (provider.type === PROVIDER_TYPES.PACKAGE) {
  await this.fetchViaPackage(task, provider);
} else if (provider.type === PROVIDER_TYPES.HTTP) {
  await this.fetchViaHttp(task, provider);
}
// Kein else-Branch: neuer Typ wird still ignoriert
```

Neuer Provider-Typ erfordert Core-Modifikation. Kein Strategy-Pattern für Transport-Layer. Fehlt ein `else { throw }` — ein unbekannter `provider.type` läuft kommentarlos durch.

---

### 3.4 SRP-Verletzung: `TimeSeriesFetcher` als God-Class

**Datei:** `src/services/TimeSeriesFetcher.js` (335 Zeilen)

Bündelt mindestens 5 unabhängige Verantwortlichkeiten:
1. Task-Orchestrierung + Concurrency-Limit-Verwaltung
2. Cursor-Berechnung (`getStartDate`, `getLatestRecord`)
3. HTTP-Fetch inkl. Auth-Header-Injection
4. Response-Normalisierung (`extractData`)
5. Storage-Write-Aufruf (Delegation, aber direkte Abhängigkeit)

---

### 3.5 Datenbanktypen: `double` für Finanzkurse

**Datei:** `src/core/adapters/storage/TiingoAdapter.js` Z. 8, `BinanceAdapter.js` Z. 4

Kurse werden als JS-`Number` (IEEE 754 double) ohne explizite Typkonvertierung übergeben. Für Differenz-Berechnungen und Aggregationen (z.B. `AVG(close)` über 800k Rows) akkumuliert Floating-Point-Drift. `DECIMAL(18,6)` wäre korrekt.

FRED: `item.value` ist ein String (`"3456.789"`), der direkt als SQL-Parameter übergeben wird. MySQL/TiDB konvertiert implizit zu `DOUBLE`. Präzision ist datenbankversionsabhängig.

---

### 3.6 Datenbanktypen: String-Datumsfelder statt `DATE`

Alle Adapter übergeben Datumsfelder als `YYYY-MM-DD`-String. Zielspalten (aus Adapter-Pattern ersichtlich) sind vermutlich `VARCHAR` oder `CHAR`. Konsequenz: keine nativen `DATE`-Funktionen ohne implizite Konversion, keine Clustered-Index-Effizienz für Bereichsabfragen in TiDB.

---

### 3.7 Doppelte `ErrorRegistry`-Instanzen: Logger vs. injizierte Registry

**Datei:** `src/core/Logger.js` Z. 15, `src/runners/TimeSeriesFetchRunner.js` Z. 56

`LoggerClass` instanziiert intern eine `ErrorRegistry`. `TimeSeriesFetchRunner` instanziiert eine **separate** `ErrorRegistry` als Dependency-Injection. `Logger.warn()` / `Logger.error()` schreiben in die **Logger-interne** Registry. `StandardRunner.run()` fragt die **injizierte** `errorRegistry` ab für die Ntfy-Benachrichtigung.

Fehler, die nur via `Logger.error()` erfasst werden (ohne expliziten `errorRegistry.addError()`-Call) — z.B. alle Fehler in `PaginationStrategies.js` Z. 23–25 und Z. 34–35 — erscheinen **nicht** in der Ntfy-Benachrichtigung.

---

### 3.8 `FinraFetchAdapter`: Cache-Akkumulation bei Full-Backfill

**Datei:** `src/core/adapters/fetch/FinraFetchAdapter.js` Z. 18–60

Das Day-Loop erzeugt eine URL pro Börsentag. Bei Full-Backfill ab 2023: ~780 sequenzielle Requests, alle via `requestManager.fetch()` geroutet. Der `RequestManager`-Cache wächst auf 780 Einträge ohne Eviction. Das ist für einen einzelnen Run funktional (Deduplizierung), aber das Cache-Wachstum ist konzeptionell ungewollt für diesen Use-Case.

---

### 3.9 `SecEdgar13FFetchAdapter`: `process.cwd()`-Kopplung und synchrones File-Read im Hot-Path

**Datei:** `src/core/adapters/fetch/SecEdgar13FFetchAdapter.js` Z. 21–26

```js
const configPath = path.join(process.cwd(), 'config', 'Smart-Money-Config.json');
const smartMoneyConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
```

`fs.readFileSync` bei jedem `fetch()`-Aufruf. CWD-Abhängigkeit macht den Adapter außerhalb des Projekt-Roots nicht verwendbar. Config sollte im Konstruktor geladen oder als Dependency injiziert werden.

---

## 4. Refactoring-Roadmap (priorisiert)

### Priorität 1 — Sofortige Produktions-Stabilisierung

#### 4.1 Concurrency-Guard für `daily-fetch.yml` + Job-Timeout

```yaml
# .github/workflows/daily-fetch.yml
concurrency:
  group: daily-ingestion
  cancel-in-progress: false

jobs:
  fetch-data:
    timeout-minutes: 90
    runs-on: ubuntu-latest
```

#### 4.2 Lock-Logik auf kollisionsfreie Semantik umstellen

```sql
-- Atomare Prüfung ohne affectedRows-Ambiguität:
INSERT INTO sync_locks (lock_key, acquired_at, expires_at)
SELECT ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND)
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM sync_locks
  WHERE lock_key = ? AND expires_at > NOW()
);
```

Lock erworben genau dann wenn `affectedRows = 1`.

#### 4.3 Heartbeat-Erneuerung für Long-Running Locks

```js
// In TimeSeriesFetchRunner.run(), nach acquireLock:
const heartbeat = setInterval(async () => {
  await storage.renewLock('m5_sync_lock', 600);
}, 120_000);
// In finally: clearInterval(heartbeat)
```

Erfordert neue `renewLock(key, ttlSeconds)`-Methode in `Storage.js`.

#### 4.4 Lock-Release bei SIGINT/SIGTERM

```js
// index.js — SIGINT-Handler erweitern:
process.on('SIGINT', async () => {
  Logger.info('[Process] SIGINT — releasing locks and exiting...');
  if (activeRunner?.cleanup) await activeRunner.cleanup();
  // NEU: Lock explizit freigeben (erfordert Storage-Referenz im Outer Scope)
  if (activeStorage) await activeStorage.releaseLock('m5_sync_lock');
  process.exit(0);
});
```

---

### Priorität 2 — Konfigurationskonsolidierung

#### 4.5 FRED-Task-Template-System

```json
{
  "templates": {
    "fred_series": {
      "provider": "FRED",
      "endpoint": "/fred/series/observations",
      "params": { "file_type": "json" }
    }
  },
  "tasks": [
    { "$template": "fred_series", "id": "fred_walcl", "params": { "series_id": "WALCL" } },
    { "$template": "fred_series", "id": "fred_dff",   "params": { "series_id": "DFF" } }
  ]
}
```

Config-Ladestufe in `TimeSeriesFetchRunner.run()` (Z. 38) expandiert Templates vor Übergabe an den Fetcher. Reduziert 39 Task-Blöcke auf 39 Einzeiler.

#### 4.6 Tiingo-Task-Liste aus kompaktem Array generieren

```json
{
  "tiingoTickers": [
    { "id": "tiingo_spy_daily", "ticker": "SPY" },
    { "id": "tiingo_xlf_macro", "ticker": "XLF", "overrideStartDate": "2007-01-01" }
  ]
}
```

Config-Expander materialisiert vollständige Task-Objekte mit fixen Feldern (`endpoint`, `params: {}`, `resolution: "daily"`).

---

### Priorität 3 — Architektur-Refactoring (SOLID)

#### 4.7 `FiscalDataAdapter` aufteilen — OCP wiederherstellen

```
src/core/adapters/storage/fiscal/
  FiscalTgaAdapter.js
  FiscalAuctionsAdapter.js
  FiscalBuybacksAdapter.js
```

`StorageAdapterFactory` registriert nach Task-ID oder Provider+Endpoint-Hash. `FiscalDataAdapter` entfällt. Identisches Muster für `YahooFinanceAdapter` → `YahooChartAdapter`, `YahooFundamentalsAdapter`, `YahooOptionsAdapter`.

#### 4.8 `TimeSeriesFetcher` aufteilen — SRP wiederherstellen

| Neue Klasse | Verantwortung |
|---|---|
| `TaskOrchestrator` | Task-Filtering, Concurrency-Limit, `Promise.allSettled` |
| `CursorManager` | `getStartDate`, `getLatestRecord`, Cursor-Serialisierung |
| `HttpFetchStrategy` | Auth-Injection, URL-Aufbau, Pagination-Dispatch |
| `PackageFetchStrategy` | Package-Adapter-Delegation |
| `ResponseNormalizer` | `extractData`, API-Error-Detection |

#### 4.9 `PolygonM5FetchAdapter` in `RequestManager` integrieren

- `auth.envVar: "POLYGONIO_API_KEY"` in Provider-Config deklarieren
- Retry-After-Header-Parsing via `RequestManager`-Hooks
- Rate-Throttling via `requestsPerSecond`-Config statt Hard-coded-Sleep

#### 4.10 Logger-Registry-Dualismus auflösen

`LoggerClass` entfernt interne `ErrorRegistry`. Logger schreibt nur auf stdout/stderr. Die injizierte `errorRegistry` in `TimeSeriesFetchRunner` ist die einzige Fehler-Sammelstelle. Optional: `Logger.setRegistry(registry)` für Cross-Registration.

---

### Priorität 4 — Datenbankschema-Korrekturen

#### 4.11 Datumsfelder auf `DATE` umstellen

```sql
ALTER TABLE econ_fred MODIFY observation_date DATE NOT NULL;
ALTER TABLE market_data_tiingo MODIFY record_date DATE NOT NULL;
ALTER TABLE market_data_yahoo MODIFY record_date DATE NOT NULL;
```

Alle Adapter liefern bereits `YYYY-MM-DD`-Strings — TiDB akzeptiert diese direkt für `DATE`-Spalten.

#### 4.12 Kursspalten auf `DECIMAL` umstellen

```sql
ALTER TABLE market_data_tiingo
  MODIFY open  DECIMAL(18,6),
  MODIFY high  DECIMAL(18,6),
  MODIFY low   DECIMAL(18,6),
  MODIFY close DECIMAL(18,6);
```

---

### Priorität 5 — FRED Revision-Handling

#### 4.13 Revisions-aware Cursor-Strategie

Neues optionales Task-Feld `revisionLookback` (Tage):

```json
{ "id": "fred_payems", "provider": "FRED", ..., "revisionLookback": 90 }
```

`CursorManager.getStartDate()` subtrahiert `revisionLookback` Tage von der berechneten Start-Date. `ON DUPLICATE KEY UPDATE value = VALUES(value)` (bereits implementiert in `FredAdapter`) überschreibt Revisionen korrekt.

---

## Appendix: Datei-Referenz-Index

| Datei | Primäre Defizite (Abschnitt) |
|---|---|
| `.github/workflows/daily-fetch.yml` | 2.1, 2.2 |
| `.github/workflows/m5-fetch.yml` | 2.2 |
| `config/Database-Fetcher-Config.json` | 3.1 |
| `src/core/Storage.js` | 2.3 |
| `src/services/TimeSeriesFetcher.js` | 3.3, 3.4 |
| `src/services/PaginationStrategies.js` | 2.4 |
| `src/core/RequestManager.js` | 2.7 |
| `src/core/adapters/storage/FiscalDataAdapter.js` | 3.2 |
| `src/core/adapters/storage/TiingoAdapter.js` | 3.5, 3.6 |
| `src/core/adapters/fetch/PolygonM5FetchAdapter.js` | 2.5 |
| `src/core/adapters/fetch/SecEdgar13FFetchAdapter.js` | 2.6, 3.9 |
| `src/core/adapters/fetch/FinraFetchAdapter.js` | 3.8 |
| `src/core/Logger.js` | 3.7 |
| `src/runners/TimeSeriesFetchRunner.js` | 2.3 (kein Lock-Release bei SIGTERM) |
| `index.js` | 2.3 (cleanup ohne Lock-Release) |
