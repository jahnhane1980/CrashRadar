# CrashRadar Refactoring - Status & TODOs

> **Zweck:** Unmittelbare, operative Arbeitsliste für das laufende Entwicklungs-Sprint auf Code-Ebene (Mikro-Ebene).  
> **Fokus:** Konkrete Dateipfade, Klassennamen, Konfigurationsstrukturen und Entscheidungslogiken (if/else), die unmittelbar im Code implementiert werden müssen.

## Was noch zu tun ist (Offen)

### 1. M5-Candles Ingestion Pipeline (`PolygonFetchAdapter`) & Single-Asset Radar
* **Master-Architektur & Spezifikation:** Vollständig dokumentiert in [`docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md) (mit Detail-Dokus [`docs/architecture/single-asset-radar/M5Candels.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/M5Candels.md) und [`docs/architecture/single-asset-radar/SingleAssetTrading.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/SingleAssetTrading.md)).
* **Ziel:** Etablierung des nativen, autarken Bezugs von 5-Minuten-Intraday-Kerzen direkt über Polygon.io in die Tabelle `market_data_m5` zur tagesaktuellen Überwachung aktiver High-Beta- & ETF-Positionen.
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 1 (`PolygonFetchAdapter.js`):** Implementierung der Fetch-Adapter-Klasse in [`src/core/adapters/fetch/PolygonFetchAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/PolygonFetchAdapter.js) mit Market-Status-Check (`/v1/marketstatus/now`), Paginierung via `next_url` und UTC-Mapping.
  * **Schritt 2 (`FetchAdapterFactory.js`):** Registrierung des neuen Adapters `'Polygon'` in [`src/core/adapters/fetch/FetchAdapterFactory.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/FetchAdapterFactory.js).
  * **Schritt 3 (`Database-Fetcher-Config.json`):** Provider `"Polygon"` konfigurieren und 10 Fokus-Tasks (`PLTR, NVTS, IBRX, IGV, CIBR, SPY, QQQ, SOUN, SOFI, S`) mit `"frequency": "intraday_m5"` anlegen.
  * **Schritt 4 (Profiling-Filter - BEREITS ERLEDIGT):** Integration des Profil-Filters (`--profile daily` vs `--profile intraday_m5`) in [`TimeSeriesFetcher.js`](file:///D:/GitHub/CrashRadar/src/services/TimeSeriesFetcher.js) und [`index.js`](file:///D:/GitHub/CrashRadar/index.js) (inkl. Unit-Tests).
  * **Schritt 5 (Workflows & Radar-Sync):** Anlegen von `intraday-m5-fetch.yml` (2x täglich: 17:15 & 22:15 Uhr) und Verifikation mit [`GrowthStockTradingEngine.js`](file:///D:/GitHub/CrashRadar/scratch/tools/GrowthStockTradingEngine.js) & [`BlueChipAndEtfTrader.js`](file:///D:/GitHub/CrashRadar/scratch/tools/BlueChipAndEtfTrader.js).

### 2. Dynamischer Makro-Wirtschaftskalender & Szenario-Framework (Option A: Full DB)
* **Konzept-Spezifikation:** Vollständig dokumentiert in [`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md).
* **Ziel:** Vollständige Ablösung der statischen `Macro-Scenarios-Config.json` durch eine automatisierte, datenbankgestützte Event-, Kalender- und Scorecard-Engine.
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 1 (DDL & DB-Migration):** Anlegen der Tabelle `macro_calendar_events` via `src/db/migrations/create_macro_calendar_events.sql` (inkl. `consensus_estimate`, `previous_value`, `status`, `rule_json`).
  * **Schritt 2 (`MacroCalendarFetcher.js`):** Implementierung des Ingestion-Dienstes für offizielle FRED-Termine (`/fred/release/dates`) und Konsens-Schätzungen (ForexFactory JSON-Feed & Cleveland Fed Nowcast).
  * **Schritt 3 (`MacroScenarioRuleService.js`):** Implementierung der 2-Stufen-Regel-Engine (`TWO_STAGE_CONSENSUS`, `ALLOWED_VALUES`, `SPREAD_TO_METRIC`) und Quartalszuordnung.
  * **Schritt 4 (Runner-Refactoring):** Umstellung von [`ScenarioChecklistService.js`](file:///D:/GitHub/CrashRadar/src/services/ScenarioChecklistService.js) und [`MacroScorecardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js) auf die MySQL-Tabelle `macro_calendar_events` mit lokalem Werteabgleich aus `econ_fred`.
  * **Schritt 5 (Test-Suite & Verifikation):** Unit- und Integrationstests mit Mock-Daten und Live-Dry-Run via CLI (`--check-scenario`).

### 3. Dynamisches Debouncing & Krisen-Aufwach-Logik der Notifications
* **Problem:** Das aktuelle Debouncing in [`NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) arbeitet mit einem starren 14-Tage-Fenster. Wenn die `MacroRegimeEngine` ein akutes Krisen- oder Kollisionsfenster meldet (z. B. Kollision in 14 Tagen, Liquiditätsentzug oder Veto aktiv), darf das System nicht in einem 14-tägigen "Debouncing-Schlaf" verharren, sondern muss hochsensibel und sofort reaktionsfähig sein.
* **Ziel:** Das Debouncing muss dynamisch an das Makro-Klima gekoppelt werden:
  * **Normalzustand:** 14 Tage Spam-Schutz für reguläre Warnungen.
  * **Spätzyklus / Kollisions-Fenster aktiv:** Verkürzung des Debouncings auf 1–2 Tage oder sofortige Alarmierung bei Zustands-/Statuswechsel.
  * **Flash Crash / Akute Panik:** 0–2 Tage / Sofort-Push für relevante Re-Entry- und Exit-Signale.
* **Betroffene Komponenten [OFFEN]:**
  * [`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) (`getAlerts()` mit dynamischer `debounceDays`-Berechnung basierend auf `macroState.regime` und `macroState.vetos`).
  * [`config/Notification-Config.json`](file:///D:/GitHub/CrashRadar/config/Notification-Config.json) (Konfigurierbare Debounce-Schwellenwerte pro Marktphase).

### 4. Trading & Execution Engine (Architektur, Einzeltitel-ML & 21-Jahre-Backtest)
* **Architektur & Konzept-Blaupause:** Vollständig dokumentiert in [`docs/architecture/trading-engine/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md).
* **Umfang der Säule:**
  * **Portfolio-DNA & State Machine:** 5-Stufen-Modell für 50/50 Krypto- & Growth-Portfolio (`MSTR`, `NVTS`, `SOFI`, `ZETA`).
  * **FINRA Short-Volume & Fundamentaler Wachhund:** Ticker-spezifische LSTMs (`MlRegimeRadarStockIndicator.js`) kombiniert mit Bilanz-Vetos (`Fundamental-Veto-Config.json`) und Szenario-Feedback (`MacroScenarioIndicator`).
  * **Dynamische Positionsgrößen-Skalierung:** Fractional-Kelly-Logik (`action.scaleDown`) basierend auf Makro-Crash-Risiko ($> 70\,\%$) und Vetos.
  * **A/B-Testzyklus (Makro-Heuristik vs. ML-Ensemble):** Empirischer Vergleich über 21 Jahre (10 Großkrisen).
* **Status:** Vorbereitung & Konzeptionsphase in [`docs/architecture/trading-engine/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md) abgeschlossen; Umsetzung folgt im dedizierten Entwicklungszweig.

