# CrashRadar Refactoring - Status & TODOs

> **Zweck:** Unmittelbare, operative Arbeitsliste für das laufende Entwicklungs-Sprint auf Code-Ebene (Mikro-Ebene).  
> **Fokus:** Konkrete Dateipfade, Klassennamen, Konfigurationsstrukturen und Entscheidungslogiken (if/else), die unmittelbar im Code implementiert werden müssen.

---

## Was noch zu tun ist (Offen) - Verbindliche Umsetzungsreihenfolge

### 1. Portfoliostrategien: Detail-Ausarbeitung, Harmonisierung & Backtest-Validierung
* **Architektonische Priorität:** Sämtliche Portfoliostrategien müssen zuerst einzeln und vollständig in `CrashRadar` ausformuliert, mathematisch harmonisiert und im Code implementiert werden, **bevor** mit der Umsetzung des echten Signal-Services (Punkt 3) begonnen wird!
* **Betroffene Strategie-Dokumente & Spezifikationen:**
  * **Kamikaze Growth Schärfung:** Integration des parabolischen Climax-Top Exits (`TOP_CLIMAX_ALERT` bei Distanz zum EMA 20 $\ge 35-45\,\%$) und Watchlist-Klausel für Turnaround-Kandidaten in [`docs/architecture/strategies/Kamikaze-Growth.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Kamikaze-Growth.md). Spezifikation der **Live-Broker-Anbindung (Trading-Konto Ingestion & Discretionary Override)** sowie des **Read-Only Telegram Broadcasts** für Follower.
  * **Satellite-Strategie Ausarbeitung [ERLEDIGT]:** Vollständige Spezifikation und Ausarbeitung von [`docs/architecture/strategies/Satelite.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Satelite.md) als Core-Satellite-System (80 % SPY, 15 % DFNS Defense, 5 % BTC HODL) mit universellem Notfall-Stecker (50/50 Gold & Cash) inkl. Manifest [`config/strategies/satellite.json`](file:///D:/GitHub/CrashRadar/config/strategies/satellite.json) und PoC in [`SatelliteCoreSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/SatelliteCoreSimulation.js).
  * **MCW vs. 7-Slot-Guru Abgleich [ERLEDIGT]:** 7-Slot-Guru erfolgreich auf den universellen 100 % Notfall-Schutzschild (50 % Gold / 50 % Cash) mit Dual-Trigger (NetLiq + Credit Spreads) und Dual-Re-Entry gehoben ([`docs/architecture/strategies/7-Slot-Guru-Konsens-System.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/7-Slot-Guru-Konsens-System.md)).
  * **Gold-SPY DCA & Tranchen:** Finaler Abgleich des 40/30/30 Bottom-Sniper Re-Entry-Regelwerks in [`docs/architecture/strategies/Gold-SPY.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-SPY.md).
  * **Gold-GDX Status:** Bleibt als reine Forschungs- und Minenreferenz dokumentiert ([`docs/architecture/strategies/Gold-GDX.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-GDX.md)), wird jedoch vorerst nicht im aktiven Signaldienst angeboten.

### 2. PortfolioStrategyEngine (Plugin-Architektur, Interface & Strategie-Registry)
* **Ziel:** Etablierung einer autarken `PortfolioStrategyEngine` zur modularen Kapselung und parallelen Ausführung aller Portfoliostrategien (analog zur Indikatoren-Registry via `_indicators` in `MacroRegimeEngine`).
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 0 (Daten-Audit der Strategien & Fetcher-Registrierung):**
    * Systematische Überprüfung aller von den 5 Strategien benötigten Marktdaten, Ticker (Tech, Krypto-Equities, ETFs, Gold), Notenbank- und Makro-Reihen sowie Sentiment-Daten.
    * Gründlicher Abgleich mit der Datenbank und [`config/Database-Fetcher-Config.json`](file:///D:/GitHub/CrashRadar/config/Database-Fetcher-Config.json): Identifikation aller Datenreihen, die noch nicht regelmäßig bezogen werden.
    * Neuregistrierung der fehlenden Ticker/Zeitreihen im Fetcher (inkl. Zuordnung zu Yahoo, Polygon, FRED, Tiingo oder SEC 10-Q).
  * **Schritt 1 (`BasePortfolioStrategy.js` Interface):** Einheitliche Basisklasse mit Standard-Methoden (`initialize()`, `evaluateDaily(date, marketData, macroState)`, `executeTrades()`, `getPortfolioStatus()`, `getHistory()`, `generateAlerts()`).
  * **Schritt 2 (`PortfolioStrategyEngine.js`):** Orchestrator-Klasse zur parallelen Ausführung aller registrierten Strategien, aggregiertem Reporting und Schnittstelle zur Notification-Engine.
  * **Schritt 3 (Strategie-Klassen anlegen):** Kapselung von `MuzzledCathieWoodStrategy.js`, `KamikazeGrowthStrategy.js`, `SevenSlotGuruStrategy.js`, `GoldSpyDcaStrategy.js` und `SatelliteStakingStrategy.js` in `src/strategies/`.
  * **Schritt 4 (Broker-Live-Ingestion & Discretionary Override für Kamikaze):**
    * Anbindung des realen Handelskonto (Cash USD, offene Limit-Orders, Bestände).
    * Reconciliation-Logik: Discretionary Override ("Broker-Realität überschreibt Modell-Zustand").

### 3. Notification- & Signal-System: Telegram, Edge-Gateway & Architektur-Review
* **Master-Spezifikation:** Vollständig dokumentiert in [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md).
* **Ziel:** Vollständige Ablösung von [`src/services/NtfyService.js`](file:///D:/GitHub/CrashRadar/src/services/NtfyService.js) durch einen zweigeteilten Telegram- & Signaldienst (Public Broadcast in CrashRadar + personalisiertes 1:1 Edge-Gateway im neuen Repo `CrashRadar-Signals`) inklusive tiefem Architektur-Review und dynamischem Krisen-Debouncing.
* **Operative Umsetzungsschritte in `CrashRadar` [OFFEN]:**
  * **Schritt 1 (Architektur-Review der Indikatoren & Notifications):** Kritische Prüfung der Datenfluss-Pipeline auf Redundanzen, Mehrfachberechnungen und saubere Trennung (Separation of Concerns) zwischen Indikatoren-Auswertung und Alarm-Erzeugung.
  * **Schritt 2 (Dynamisches Debouncing & Krisen-Aufwach-Logik):**
    * Normalzustand: 14 Tage Spam-Schutz für reguläre Warnungen in [`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) und [`config/Notification-Config.json`](file:///D:/GitHub/CrashRadar/config/Notification-Config.json).
    * Spätzyklus / Kollisions-Fenster aktiv: Dynamische Verkürzung auf 1–2 Tage oder sofortige Alarmierung bei Zustands-/Statuswechsel.
    * Akute Panik / Flash Crash: 0 Tage / Sofort-Push für Re-Entry- und Exit-Signale.
  * **Schritt 3 (`TelegramService.js` & Test-Isolation):**
    * Implementierung des Telegram Bot Clients in `src/services/TelegramService.js` mit MarkdownV2-Unterstützung, Fehlerbehandlung und Broadcast-Channel-Routing (`chat.type == "channel"`).
    * Öffentlicher Kanal `Makro-Wetter` und gespiegeltes Test-Pendant `Makro-Wetter-Test` via `TELEGRAM_ENV=test` vs `TELEGRAM_ENV=prod`.
  * **Schritt 4 (Pre-Computation Push & Snapshot-Exporter):**
    * Implementierung eines Dispatchers/Exporters, der nach dem täglichen Auswertungslauf den `daily_intelligence.json` Payload (Makro-Regime, Veto-Status, Allokationen pro Strategie) per Webhook an den Cloudflare Worker (`POST /api/snapshot`) pusht.
  * **Schritt 5 (Runner-Refactoring):** Aktualisierung der Runner ([`IndicatorAnalysisRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/IndicatorAnalysisRunner.js), [`MacroScorecardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js), [`StandardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/StandardRunner.js)) zur Übergabe von Nachrichten an den neuen `TelegramService`.
* **Ausblick: Neues Repo `CrashRadar-Signals` (Cloudflare Worker + D1):**
  * Setup des Workers als Webhook-Receiver für private 1:1 Telegram-Chats.
  * D1-Tabellen `user_portfolios` (inkl. `strategy_id` & `strategy_version`), `market_regime_snapshot`, `strategy_changelogs` und `signal_logs`.
  * Geführtes Onboarding, Ad-hoc `/topup` mit Sofort-Feedback (< 50 ms), Inline-Buttons `[✅ Ausgeführt]` / `[⏳ Überspringen]`, die 3 Beweis-Szenarien und automatischer Transparenz-Push bei Strategie-Updates (z. B. "Strategie modifiziert: Makrosicherung V2.1").

### 4. Dynamischer Makro-Wirtschaftskalender & Szenario-Framework (`Option A: Full DB`)
* **Architektur-Konzept & Spezifikation:** Vollständig dokumentiert in [`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md).
* **Gap-Analyse & Code-Befund (Neu vs. Anders):** Detailliert festgehalten in [`ScenarioChecklistService.md`](file:///D:/GitHub/CrashRadar/ScenarioChecklistService.md).
* **Ziel:** Vollständige Ablösung der statischen MVP-Konfiguration (`Macro-Scenarios-Config.json`) und flüchtigen Alert-History durch eine automatisierte, datenbankgestützte Event-, Kalender- und Scorecard-Engine mit Notenbank-Hybrid (FOMC) und 2-Stufen-Konsensbewertung.
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 1 (DDL & DB-Migration):** Anlegen der Tabelle `macro_calendar_events` via `src/db/migrations/create_macro_calendar_events.sql` sowie Erweiterung von [`AnalysisRepository.js`](file:///D:/GitHub/CrashRadar/src/core/repositories/AnalysisRepository.js) (`TABLES`, `FRED_SERIES`, Event-CRUD).
  * **Schritt 2 (`MacroCalendarFetcher.js`):** Implementierung des Kalender- & Konsens-Ingestion-Dienstes (FRED Release API `/fred/release/dates`, ForexFactory Feed `ff_calendar_thisweek.json` mit Caching/Cloudflare-Resilienz und Cleveland Fed Nowcast Ingestion).
  * **Schritt 3 (`ScenarioChecklistService.js`):** Erweiterung der Rule-Engine um den neuen Regeltyp `TWO_STAGE_CONSENSUS` (beidseitiger Goldilocks-Korridor, `macroGuards`-Vetos und Realzins-Check `SPREAD_TO_METRIC`).
  * **Schritt 4 (FOMC Notenbank-Hybrid & FRED-Task):** Implementierung des Fed-Statement RSS-Parsers für Phase 1 (20:05 MESZ) und Anlage des neuen Tasks `fred_dfedtaru` in [`config/Database-Fetcher-Config.json`](file:///D:/GitHub/CrashRadar/config/Database-Fetcher-Config.json) für Phase 2 (T+1 Verifikation).
  * **Schritt 5 (`MacroScorecardRunner.js` & CI/CD):** Umstellung des Runners auf SQL-Abfragen aus `macro_calendar_events`, 2-Phasen-FOMC-Steuerung, persistente Status-/Ist-Wert-Aktualisierung und Anpassung der GitHub-Action [`daily-fetch.yml`](file:///D:/GitHub/CrashRadar/.github/workflows/daily-fetch.yml).
  * **Schritt 6 (Test-Suite & Verifikation):** Erweiterung von [`tests/services/ScenarioChecklistService.test.js`](file:///D:/GitHub/CrashRadar/tests/services/ScenarioChecklistService.test.js) für alle 2-Stufen- und Guard-Fälle, gefolgt von einem End-to-End Testlauf.

### 5. M5-Candles Ingestion Pipeline (`PolygonFetchAdapter`) & Single-Asset Radar
* **Master-Architektur & Spezifikation:** Vollständig dokumentiert in [`docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md) (mit Detail-Dokus [`docs/architecture/single-asset-radar/M5Candels.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/M5Candels.md) und [`docs/architecture/single-asset-radar/SingleAssetTrading.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/SingleAssetTrading.md)).
* **Ziel:** Etablierung des nativen, autarken Bezugs von 5-Minuten-Intraday-Kerzen direkt über Polygon.io in die Tabelle `market_data_m5` zur tagesaktuellen Überwachung aktiver High-Beta- & ETF-Positionen.
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 1 (`PolygonFetchAdapter.js`):** Implementierung der Fetch-Adapter-Klasse in [`src/core/adapters/fetch/PolygonFetchAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/PolygonFetchAdapter.js) mit Market-Status-Check (`/v1/marketstatus/now`), Paginierung via `next_url` und UTC-Mapping.
  * **Schritt 2 (`FetchAdapterFactory.js`):** Registrierung des neuen Adapters `'Polygon'` in [`src/core/adapters/fetch/FetchAdapterFactory.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/FetchAdapterFactory.js).
  * **Schritt 3 (`Database-Fetcher-Config.json`):** Provider `"Polygon"` konfigurieren und 10 Fokus-Tasks (`PLTR, NVTS, IBRX, IGV, CIBR, SPY, QQQ, SOUN, SOFI, S`) mit `"frequency": "intraday_m5"` anlegen.
  * **Schritt 4 (Profiling-Filter - BEREITS ERLEDIGT):** Integration des Profil-Filters (`--profile daily` vs `--profile intraday_m5`) in [`TimeSeriesFetcher.js`](file:///D:/GitHub/CrashRadar/src/services/TimeSeriesFetcher.js) und [`index.js`](file:///D:/GitHub/CrashRadar/index.js) (inkl. Unit-Tests).
  * **Schritt 5 (Workflows & Radar-Sync):** Anlegen von `intraday-m5-fetch.yml` (2x täglich: 17:15 & 22:15 Uhr) und Verifikation mit [`GrowthStockTradingEngine.js`](file:///D:/GitHub/CrashRadar/scratch/tools/GrowthStockTradingEngine.js) & [`BlueChipAndEtfTrader.js`](file:///D:/GitHub/CrashRadar/scratch/tools/BlueChipAndEtfTrader.js).

### 6. Trading & Execution Engine (Architektur, Einzeltitel-ML & 21-Jahre-Backtest)
* **Architektur & Konzept-Blaupause:** Vollständig dokumentiert in [`docs/architecture/trading-engine/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md).
* **Zukunftsprojekt / Finaler Ausbau:** Dieser Baustein wird als letztes großes Systemziel nach Fertigstellung aller Strategien, Signale und Ingestion-Pipelines umgesetzt.
* **Umfang der Säule:**
  * **Portfolio-DNA & State Machine:** 5-Stufen-Modell für 50/50 Krypto- & Growth-Portfolio (`MSTR`, `NVTS`, `SOFI`, `ZETA`).
  * **FINRA Short-Volume & Fundamentaler Wachhund:** Ticker-spezifische LSTMs (`MlRegimeRadarStockIndicator.js`) kombiniert mit Bilanz-Vetos (`Fundamental-Veto-Config.json`) und Szenario-Feedback (`MacroScenarioIndicator`).
  * **Dynamische Positionsgrößen-Skalierung:** Fractional-Kelly-Logik (`action.scaleDown`) basierend auf Makro-Crash-Risiko ($> 70\,\%$) und Vetos.
  * **A/B-Testzyklus (Makro-Heuristik vs. ML-Ensemble):** Empirischer Vergleich über 21 Jahre (10 Großkrisen).
