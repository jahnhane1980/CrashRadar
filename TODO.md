# CrashRadar Refactoring - Status & TODOs

> **Zweck:** Unmittelbare, operative Arbeitsliste für das laufende Entwicklungs-Sprint auf Code-Ebene (Mikro-Ebene).  
> **Fokus:** Konkrete Dateipfade, Klassennamen, Konfigurationsstrukturen und Entscheidungslogiken (if/else), die unmittelbar im Code implementiert werden müssen.

## Was noch zu tun ist (Offen)

### 1. System-Überarbeitung: Dynamischer Makro-Wirtschaftskalender & Szenario-Framework (`Option A: Full DB`)
* **Architektur-Konzept & Spezifikation:** Vollständig dokumentiert in [`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///workspaces/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md).
* **Gap-Analyse & Code-Befund (Neu vs. Anders):** Detailliert festgehalten in [`ScenarioChecklistService.md`](file:///workspaces/CrashRadar/ScenarioChecklistService.md).
* **Ziel:** Vollständige Ablösung der statischen MVP-Konfiguration (`Macro-Scenarios-Config.json`) und flüchtigen Alert-History durch eine automatisierte, datenbankgestützte Event-, Kalender- und Scorecard-Engine mit Notenbank-Hybrid (FOMC) und 2-Stufen-Konsensbewertung.
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 1 (DDL & DB-Migration):** Anlegen der Tabelle `macro_calendar_events` via `src/db/migrations/create_macro_calendar_events.sql` sowie Erweiterung von [`AnalysisRepository.js`](file:///workspaces/CrashRadar/src/core/repositories/AnalysisRepository.js) (`TABLES`, `FRED_SERIES`, Event-CRUD).
  * **Schritt 2 (`MacroCalendarFetcher.js`):** Implementierung des Kalender- & Konsens-Ingestion-Dienstes (FRED Release API `/fred/release/dates`, ForexFactory Feed `ff_calendar_thisweek.json` mit Caching/Cloudflare-Resilienz und Cleveland Fed Nowcast Ingestion).
  * **Schritt 3 (`ScenarioChecklistService.js`):** Erweiterung der Rule-Engine um den neuen Regeltyp `TWO_STAGE_CONSENSUS` (beidseitiger Goldilocks-Korridor, `macroGuards`-Vetos und Realzins-Check `SPREAD_TO_METRIC`).
  * **Schritt 4 (FOMC Notenbank-Hybrid & FRED-Task):** Implementierung des Fed-Statement RSS-Parsers für Phase 1 (20:05 MESZ) und Anlage des neuen Tasks `fred_dfedtaru` in [`config/Database-Fetcher-Config.json`](file:///workspaces/CrashRadar/config/Database-Fetcher-Config.json) für Phase 2 (T+1 Verifikation).
  * **Schritt 5 (`MacroScorecardRunner.js` & CI/CD):** Umstellung des Runners auf SQL-Abfragen aus `macro_calendar_events`, 2-Phasen-FOMC-Steuerung, persistente Status-/Ist-Wert-Aktualisierung und Anpassung der GitHub-Action [`daily-fetch.yml`](file:///workspaces/CrashRadar/.github/workflows/daily-fetch.yml).
  * **Schritt 6 (Test-Suite & Verifikation):** Erweiterung von [`tests/services/ScenarioChecklistService.test.js`](file:///workspaces/CrashRadar/tests/services/ScenarioChecklistService.test.js) für alle 2-Stufen- und Guard-Fälle, gefolgt von einem End-to-End Testlauf.

### 2. M5-Candles Ingestion Pipeline (`PolygonFetchAdapter`) & Single-Asset Radar
* **Master-Architektur & Spezifikation:** Vollständig dokumentiert in [`docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md) (mit Detail-Dokus [`docs/architecture/single-asset-radar/M5Candels.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/M5Candels.md) und [`docs/architecture/single-asset-radar/SingleAssetTrading.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/SingleAssetTrading.md)).
* **Ziel:** Etablierung des nativen, autarken Bezugs von 5-Minuten-Intraday-Kerzen direkt über Polygon.io in die Tabelle `market_data_m5` zur tagesaktuellen Überwachung aktiver High-Beta- & ETF-Positionen.
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 1 (`PolygonFetchAdapter.js`):** Implementierung der Fetch-Adapter-Klasse in [`src/core/adapters/fetch/PolygonFetchAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/PolygonFetchAdapter.js) mit Market-Status-Check (`/v1/marketstatus/now`), Paginierung via `next_url` und UTC-Mapping.
  * **Schritt 2 (`FetchAdapterFactory.js`):** Registrierung des neuen Adapters `'Polygon'` in [`src/core/adapters/fetch/FetchAdapterFactory.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/FetchAdapterFactory.js).
  * **Schritt 3 (`Database-Fetcher-Config.json`):** Provider `"Polygon"` konfigurieren und 10 Fokus-Tasks (`PLTR, NVTS, IBRX, IGV, CIBR, SPY, QQQ, SOUN, SOFI, S`) mit `"frequency": "intraday_m5"` anlegen.
  * **Schritt 4 (Profiling-Filter - BEREITS ERLEDIGT):** Integration des Profil-Filters (`--profile daily` vs `--profile intraday_m5`) in [`TimeSeriesFetcher.js`](file:///D:/GitHub/CrashRadar/src/services/TimeSeriesFetcher.js) und [`index.js`](file:///D:/GitHub/CrashRadar/index.js) (inkl. Unit-Tests).
  * **Schritt 5 (Workflows & Radar-Sync):** Anlegen von `intraday-m5-fetch.yml` (2x täglich: 17:15 & 22:15 Uhr) und Verifikation mit [`GrowthStockTradingEngine.js`](file:///D:/GitHub/CrashRadar/scratch/tools/GrowthStockTradingEngine.js) & [`BlueChipAndEtfTrader.js`](file:///D:/GitHub/CrashRadar/scratch/tools/BlueChipAndEtfTrader.js).

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

### 5. PortfolioStrategyEngine (Plugin-Architektur, Interface & Strategie-Registry)
* **Ziel:** Etablierung einer autarken `PortfolioStrategyEngine` zur modularen Kapselung und parallelen Ausführung aller Portfoliostrategien (analog zur Indikatoren-Registry via `_indicators` in `MacroRegimeEngine`).
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 1 (`BasePortfolioStrategy.js` Interface):** Einheitliche Basisklasse mit Standard-Methoden (`initialize()`, `evaluateDaily(date, marketData, macroState)`, `executeTrades()`, `getPortfolioStatus()`, `getHistory()`, `generateAlerts()`).
  * **Schritt 2 (`PortfolioStrategyEngine.js`):** Orchestrator-Klasse zur parallelen Ausführung aller registrierten Strategien, aggregiertem Reporting und Schnittstelle zur Notification-Engine.
  * **Schritt 3 (Harmonisierung & Finalisierung der Strategien):**
    * **Kamikaze Growth:** Integration des parabolischen Climax-Top Exits (`TOP_CLIMAX_ALERT` bei Distanz zum EMA 20 $\ge 35-45\,\%$) und Watchlist-Klausel für Turnaround-Kandidaten (Lehre aus dem NVTS > $ 30 Case).
    * **Satellite-Strategie:** Spezifikation und Ausarbeitung von [`docs/architecture/strategies/Satelite.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Satelite.md) (irregulärer Solana- & Ethereum-Staking ETF aus Gehaltsüberschüssen).
    * **MCW vs. 7-Slot-Guru Abgleich:** Abgleich der Makro-Schutzschilde: Prüfung, ob das 7-Slot-Guru-System von der statischen 25 % Gold-Quote auf die hocheffektive MCW-Notfall-Evakuierung (100 % in 50 % Gold / 50 % Cash mit Re-Entry Sniper) gehoben wird.
    * **Strategie-Klassen anlegen:** Kapselung von `MuzzledCathieWoodStrategy.js`, `KamikazeGrowthStrategy.js`, `SevenSlotGuruStrategy.js`, `GoldSpyDcaStrategy.js` in `src/strategies/`.

### 6. Notification-System: Telegram-Migration mit Multi-Channel & Test-Isolation
* **Ziel:** Vollständige Ablösung von [`src/services/NtfyService.js`](file:///D:/GitHub/CrashRadar/src/services/NtfyService.js) durch einen kanal-basierten `TelegramService` via offizieller Telegram Bot API.
* **Kanal- und Routing-Struktur [OFFEN]:**
  * **Schritt 1 (`TelegramService.js`):** Implementierung des Telegram Bot Clients mit MarkdownV2-Unterstützung, Fehlerbehandlung, Rate-Limiting und Chat-/Topic-Routing.
  * **Schritt 2 (Gruppen- & Kanal-Setup):** Konfiguration dedizierter Gruppen/Kanäle, damit Interessierte zielgerichtet abonnieren können:
    * Kanal `Makro-Wetter` (Regime-Status, Zinsen, Liquidität, Frühwarnungen)
    * Eigener Kanal für jede Strategie (`Kamikaze-Growth`, `Muzzled-Cathie-Wood`, `7-Slot-Guru`, `Gold-SPY`, `Satelite`)
  * **Schritt 3 (Lokales Test-Pendant `-Test`):**
    * Jede Gruppe / jeder Kanal erhält ein gespiegeltes Test-Pendant mit dem Suffix `-Test` (z. B. `Makro-Wetter-Test`, `Kamikaze-Growth-Test`).
    * Konfigurierbar in [`config/Notification-Config.json`](file:///D:/GitHub/CrashRadar/config/Notification-Config.json) und `.env` (`TELEGRAM_ENV=test` vs `TELEGRAM_ENV=prod`).
    * Lokale Testläufe und Regressionstests routen ihre Meldungen strikt in die `-Test` Gruppen, sodass die Live-Kanäle unberührt bleiben.
  * **Schritt 4 (Runner-Refactoring):** Aktualisierung aller Runner ([`IndicatorAnalysisRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/IndicatorAnalysisRunner.js), [`MacroScorecardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js), [`StandardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/StandardRunner.js)) zur Übergabe von Nachrichten an den neuen `TelegramService` mit automatischem Channel-Routing nach Event-Typ.


