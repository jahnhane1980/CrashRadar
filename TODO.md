# CrashRadar Refactoring - Status & TODOs

> **Zweck:** Unmittelbare, operative Arbeitsliste für das laufende Entwicklungs-Sprint auf Code-Ebene (Mikro-Ebene).  
> **Fokus:** Konkrete Dateipfade, Klassennamen, Konfigurationsstrukturen und Entscheidungslogiken (if/else), die unmittelbar im Code implementiert werden müssen.  
> 🎯 **Aktueller Fokus:** Für die verbindlichen Sprints und Scope-Cuts bis zum Stichtag 15. Dezember 2026 gilt die operative [`DECEMBER-ROADMAP.md`](file:///D:/GitHub/CrashRadar/DECEMBER-ROADMAP.md).

---

## Was noch zu tun ist (Offen) - Verbindliche Umsetzungsreihenfolge

### 1. Portfoliostrategien: Detail-Ausarbeitung, Harmonisierung & Backtest-Validierung
* **Architektonische Priorität:** Sämtliche Portfoliostrategien müssen zuerst einzeln und vollständig in `CrashRadar` ausformuliert, mathematisch harmonisiert und im Code implementiert werden, **bevor** mit der Umsetzung des echten Signal-Services (Punkt 3) begonnen wird!
* **Betroffene Strategie-Dokumente & Spezifikationen:**
  * **Kamikaze Growth Schärfung:** Integration des parabolischen Climax-Top Exits (`TOP_CLIMAX_ALERT` bei Distanz zum EMA 20 $\ge 35-45\,\%$) und Watchlist-Klausel für Turnaround-Kandidaten in [`docs/architecture/strategies/Kamikaze-Growth.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Kamikaze-Growth.md). Spezifikation der **Live-Broker-Anbindung (Trading-Konto Ingestion & Discretionary Override)** sowie des **Read-Only Telegram Broadcasts** für Follower.
  * **Satellite-Strategie Ausarbeitung [ERLEDIGT]:** Vollständige Spezifikation und Ausarbeitung von [`docs/architecture/strategies/Satelite.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Satelite.md) als Core-Satellite-System (80 % SPY, 15 % DFNS Defense, 5 % BTC HODL) mit universellem Notfall-Stecker (50/50 Gold & Cash) inkl. Manifest [`config/strategies/satellite.json`](file:///D:/GitHub/CrashRadar/config/strategies/satellite.json) und PoC in [`SatelliteCoreSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/SatelliteCoreSimulation.js).
  * **MCW vs. 7-Slot-Guru Abgleich [ERLEDIGT]:** 7-Slot-Guru erfolgreich auf den universellen 100 % Notfall-Schutzschild (50 % Gold / 50 % Cash) mit Dual-Trigger (NetLiq + Credit Spreads) und Dual-Re-Entry gehoben ([`docs/architecture/strategies/7-Slot-Guru-Konsens-System.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/7-Slot-Guru-Konsens-System.md)).
  * **Gold-SPY DCA & Tranchen [ERLEDIGT]:** Vollständige Harmonisierung von [`docs/architecture/strategies/Gold-SPY.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-SPY.md) mit der universellen 3-Heiligkeit des Schutzes (100 % Notfall-Evakuierung in 50 % Gold / 50 % Cash) und Bottom-Finder Re-Entry bei reinem SPY DCA im Normalbetrieb. Inkl. Konfigurations-Manifest [`config/strategies/gold-spy.json`](file:///D:/GitHub/CrashRadar/config/strategies/gold-spy.json) und 21,8-Jahre-Empirie-Backtest (2004–2026) in [`GoldSpyFullHistorySimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/GoldSpyFullHistorySimulation.js).
  * **Gold-GDX Status:** Bleibt als reine Forschungs- und Minenreferenz dokumentiert ([`docs/architecture/strategies/Gold-GDX.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-GDX.md)), wird jedoch vorerst nicht im aktiven Signaldienst angeboten.
  * **Turnaround-Stock-Radar & Generational Growth [IN FORSCHUNG]:** Master-Architektur in [`02-Turnaround-Framework.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/kamikaze/02-Turnaround-Framework.md) und Prototyp [`adaptive_growth_prototype.js`](file:///D:/GitHub/CrashRadar/scratch/research/turnarounds/adaptive_growth_prototype.js) validiert (+158,2 % Schnitt, Makro-Guard asymmetrisch nur als Einstiegsbremse). Hypothese dokumentiert in [`Generational-Growth-Hypothesis.md`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/Generational-Growth-Hypothesis.md). Nächster Schritt nach Pause: $L_2$-Sniper vs. Diamanten-Haltedauer in separatem Skript [`generational_sniper_simulation.js`](file:///D:/GitHub/CrashRadar/scratch/research/turnarounds/generational_sniper_simulation.js).


### 2. PortfolioStrategyEngine & Stock-Radare (2-Ebenen-Signal-Hierarchie, Plugin-Architektur & Registry)
* **Ziel:** Etablierung einer 2-Ebenen-Signal-Hierarchie zur strikten Entkopplung von Einzelwert-Signalerkennung (`src/radars/`) und Portfolio-/Kapitalverwaltung (`src/strategies/`), analog zur Indikatoren-Registry via `_indicators` in `MacroRegimeEngine`.
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 0 (Daten-Audit der Strategien & Radare [Geparkt für Live-Rollout]):**
    * Fetcher-Konfiguration (`config/Database-Fetcher-Config.json`) und Adapter bleiben in dieser Phase unberührt.
    * Strategie-, Radar- und Engine-Entwicklung erfolgt testgetrieben (TDD) via bestehender Datenbank-Zeitreihen, Fixtures und synthetischer Szenarien (`tests/fixtures/`).
  * **Schritt 1 (Base-Interfaces & Contracts):**
    * **Schritt 1a (`BaseStockRadar.js`):** Einheitliches Radar-Interface in `src/radars/BaseStockRadar.js` (`initialize(config)`, `evaluateSymbol(symbol, date, marketData, contextData)`, `scanUniverse()`, normiertes `RadarSignalResult` Objekt).
    * **Schritt 1b (`BasePortfolioStrategy.js`):** Einheitliche Strategie-Basisklasse in `src/strategies/BasePortfolioStrategy.js` (`initialize(config)`, `evaluateDaily(date, marketData, macroSignalContext, radarSignals)`, `getPortfolioStatus()`, `generateOrderInstructions()`).
  * **Schritt 2 (`PortfolioStrategyEngine.js`):** Orchestrator & Registry in `src/strategies/PortfolioStrategyEngine.js` zur parallelen Ausführung aller registrierten Strategien, Bereitstellung der Standard-Makrosignale, Übergabe der Radar-Signale und Aggregation in `daily_intelligence.json`.
  * **Schritt 3 (Autarke Radare implementieren):**
    * `GrowthStockRadar.js` in `src/radars/` (Weinstein Stage-2, SEC 10-Q Gate, Intraday M5 Bollinger Squeeze / VWAP, Climax-Top Detektor aus Single-Asset Engine für Kamikaze & MCW).
    * `Institutional13FRadar.js` in `src/radars/` (13F-Konsens der 6 Hedgefonds >= 2 Manager, Base-Schutz, SMA 200 für 7-Slot Guru).
    * `CryptoRegimeRadar.js` in `src/radars/` (BTC 21W-EMA Binärschalter, Krypto-Equity-Ranking).
  * **Schritt 4 (Strategie-Klassen anlegen):**
    * `GoldSpyDcaStrategy.js` (Autark: reines SPY DCA + 3-Säulen-Matrix Notfall-Schirm).
    * `KamikazeGrowthStrategy.js` (nutzt `GrowthStockRadar` + `CryptoRegimeRadar` + 35 % Zündfunke + Broker-Sync).
    * `MuzzledCathieWoodStrategy.js` (nutzt `GrowthStockRadar` + `CryptoRegimeRadar` + 60/40 Sparplan).
    * `SevenSlotGuruStrategy.js` (nutzt `Institutional13FRadar` + 7-Slot-Gleichgewichtung).
    * `SatelliteCoreStrategy.js` (nutzt `CryptoRegimeRadar` + 80 SPY / 15 DFNS / 5 BTC).
  * **Schritt 5 (Broker-Live-Ingestion & Discretionary Override für Kamikaze):**
    * Broker-Adapter in `src/core/adapters/broker/` (`BrokerAdapterInterface.js`, `InteractiveBrokersAdapter.js`, `MockBrokerAdapter.js`).
    * Reconciliation-Service in `src/services/BrokerReconciliationService.js` ("Broker-Realität überschreibt Modell-Zustand").
  * **Schritt 6 (Snapshot-Export & Runner):**
    * Snapshot-Push-Dienst `src/services/SnapshotExporterService.js` (an Cloudflare D1 Webhook).
    * Discord-Dienst `src/services/DiscordService.js` (Discord-Webhooks mit Rich Embeds & Rollen-Mentions).
    * Orchestrierender Runner `src/runners/PortfolioStrategyRunner.js`.

### 3. Notification- & Signal-System: Discord-Webhooks, WhatsApp-Bridge & Chat-Channels
* **Master-Spezifikation:** Vollständig dokumentiert in [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md) mit Kanal-Blueprints in [`docs/architecture/signal-service/channels/`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/channels/).
* **Ziel:** Ablösung von Telegram & ntfy durch eine schlanke, serverlose Discord-Webhook-Architektur (Phase 1: Rich Embeds, 4-Fälle-Matrix) sowie optionalem WhatsApp-Gitter-Bridge-Blueprint für mobile Gruppen.
* **Operative Umsetzungsschritte in `CrashRadar` [OFFEN]:**
  * **Schritt 1 (Architektur-Review der Indikatoren & Notifications):** Kritische Prüfung der Datenfluss-Pipeline auf Redundanzen, Mehrfachberechnungen und saubere Trennung (Separation of Concerns) zwischen Indikatoren-Auswertung und Alarm-Erzeugung.
    * *Überlegung Öl- & Liquiditäts-Analyse:* Vormerkung zur späteren Aufnahme des [`MacroLiquiditySensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/MacroLiquiditySensorHub.js) (Öl-Spikes > 92–95 $, Frachtdruck `IYT` vs. `CL=F`, Stagflationsrisiko) in das Makrowetter ([`Geopolitical-Oil-Liquidity-Stress-Study.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/Geopolitical-Oil-Liquidity-Stress-Study.md)).
    * *MakroEngine Refactoring:* Geplante Überarbeitung der historischen `MacroRegimeEngine` auf die modulare SensorHub-Architektur (architektonisch eingeplant, aktuell mit nachgelagerter Priorität).
  * **Schritt 2 (Dynamisches Debouncing & Krisen-Aufwach-Logik):**
    * Normalzustand: 14 Tage Spam-Schutz für reguläre Warnungen in [`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) und [`config/Notification-Config.json`](file:///D:/GitHub/CrashRadar/config/Notification-Config.json).
    * Spätzyklus / Kollisions-Fenster aktiv: Dynamische Verkürzung auf 1–2 Tage oder sofortige Alarmierung bei Zustands-/Statuswechsel.
    * Akute Panik / Flash Crash: 0 Tage / Sofort-Push für Re-Entry- und Exit-Signale.
  * **Schritt 3 (`DiscordService.js` & Test-Isolation):**
    * Implementierung des Discord Webhook Clients in `src/services/DiscordService.js` mit Rich Embeds, Farbcodierung (Rot/Grün/Gold) und Rollen-Mentions (`@Subscriber`).
    * Getrennte Webhooks: `#makro-wetter` (öffentlich) und `#crashradar-signale` (geschlossene Gruppe).
  * **Schritt 4 (Pre-Computation Push & Snapshot-Exporter):**
    * Implementierung eines Dispatchers/Exporters, der nach dem täglichen Auswertungslauf den `daily_intelligence.json` Payload (Makro-Regime, Veto-Status, Allokationen pro Strategie) via Discord-Webhook pusht.
  * **Schritt 5 (Runner-Refactoring):** Aktualisierung der Runner ([`IndicatorAnalysisRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/IndicatorAnalysisRunner.js), [`MacroScorecardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js), [`StandardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/StandardRunner.js)) zur Übergabe von Nachrichten an den neuen `DiscordService`.
* **Ausblick: Neues Repo `CrashRadar-Signals` (Cloudflare Worker + D1):**
  * Setup des Workers als Webhook-Receiver für private 1:1 Telegram-Chats.
  * D1-Tabellen `user_portfolios` (inkl. `strategy_id` & `strategy_version`), `market_regime_snapshot`, `strategy_changelogs` und `signal_logs`.
  * Geführtes Onboarding, Ad-hoc `/topup` mit Sofort-Feedback (< 50 ms), Inline-Buttons `[✅ Ausgeführt]` / `[⏳ Überspringen]`, die 3 Beweis-Szenarien und automatischer Transparenz-Push bei Strategie-Updates (z. B. "Strategie modifiziert: Makrosicherung V2.1").

### 4. M5-Candles Ingestion Pipeline (`PolygonFetchAdapter`) & Single-Asset Radar
* **Master-Architektur & Spezifikation:** Vollständig dokumentiert in [`docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md) (mit Detail-Dokus [`docs/architecture/single-asset-radar/M5Candels.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/M5Candels.md) und [`docs/architecture/single-asset-radar/SingleAssetTrading.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/SingleAssetTrading.md)).
* **Ziel:** Etablierung des nativen, autarken Bezugs von 5-Minuten-Intraday-Kerzen direkt über Polygon.io in die Tabelle `market_data_m5` zur tagesaktuellen Überwachung aktiver High-Beta- & ETF-Positionen.
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 1 (`PolygonFetchAdapter.js`):** Implementierung der Fetch-Adapter-Klasse in [`src/core/adapters/fetch/PolygonFetchAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/PolygonFetchAdapter.js) mit Market-Status-Check (`/v1/marketstatus/now`), Paginierung via `next_url` und UTC-Mapping.
  * **Schritt 2 (`FetchAdapterFactory.js`):** Registrierung des neuen Adapters `'Polygon'` in [`src/core/adapters/fetch/FetchAdapterFactory.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/FetchAdapterFactory.js).
  * **Schritt 3 (`Database-Fetcher-Config.json`):** Provider `"Polygon"` konfigurieren und 10 Fokus-Tasks (`PLTR, NVTS, IBRX, IGV, CIBR, SPY, QQQ, SOUN, SOFI, S`) mit `"frequency": "intraday_m5"` anlegen.
  * **Schritt 4 (Profiling-Filter - BEREITS ERLEDIGT):** Integration des Profil-Filters (`--profile daily` vs `--profile intraday_m5`) in [`TimeSeriesFetcher.js`](file:///D:/GitHub/CrashRadar/src/services/TimeSeriesFetcher.js) und [`index.js`](file:///D:/GitHub/CrashRadar/index.js) (inkl. Unit-Tests).
  * **Schritt 5 (Workflows & Radar-Sync):** Anlegen von `intraday-m5-fetch.yml` (2x täglich: 17:15 & 22:15 Uhr) und Verifikation mit [`GrowthStockTradingEngine.js`](file:///D:/GitHub/CrashRadar/scratch/tools/GrowthStockTradingEngine.js) & [`BlueChipAndEtfTrader.js`](file:///D:/GitHub/CrashRadar/scratch/tools/BlueChipAndEtfTrader.js).

### 5. Trading & Execution Engine (Architektur, Einzeltitel-ML & 21-Jahre-Backtest)
* **Architektur & Konzept-Blaupause:** Vollständig dokumentiert in [`docs/architecture/trading-engine/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md).
* **Zukunftsprojekt / Finaler Ausbau:** Dieser Baustein wird als letztes großes Systemziel nach Fertigstellung aller Strategien, Signale und Ingestion-Pipelines umgesetzt.
* **Umfang der Säule:**
  * **Portfolio-DNA & State Machine:** 5-Stufen-Modell für 50/50 Krypto- & Growth-Portfolio (`MSTR`, `NVTS`, `SOFI`, `ZETA`).
  * **FINRA Short-Volume & Fundamentaler Wachhund:** Ticker-spezifische LSTMs (`MlRegimeRadarStockIndicator.js`) kombiniert mit Bilanz-Vetos (`Fundamental-Veto-Config.json`) und Szenario-Feedback (`MacroScenarioIndicator`).
  * **Dynamische Positionsgrößen-Skalierung:** Fractional-Kelly-Logik (`action.scaleDown`) basierend auf Makro-Crash-Risiko ($> 70\,\%$) und Vetos.
  * **A/B-Testzyklus (Makro-Heuristik vs. ML-Ensemble):** Empirischer Vergleich über 21 Jahre (10 Großkrisen).

---

## 🏆 Erreichte Meilensteine (Abgeschlossen)

### ✅ Dynamischer Makro-Wirtschaftskalender & Szenario-Framework (`Option A: Full DB`)
* **Status [ABGESCHLOSSEN & LIVE VERIFIZIERT]:**
  * **Datenbank:** Tabelle `macro_calendar_events` mit DDL ([`docs/architecture/database/Macro-Calendar-Events.md`](file:///D:/GitHub/CrashRadar/docs/architecture/database/Macro-Calendar-Events.md)) angelegt.
  * **Adapter:** [`CalendarFetchAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/CalendarFetchAdapter.js) (Treasury DTS Headroom, dynamische X-Date Projektion, QRA Schedule, FRED Release API `/fred/release/dates`, ForexFactory Consensus Enrichment) und [`CalendarStorageAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/storage/CalendarStorageAdapter.js) implementiert und registriert.
  * **Services & Runner:** [`FiscalCalendarService.js`](file:///D:/GitHub/CrashRadar/src/services/FiscalCalendarService.js), [`ScenarioChecklistService.js`](file:///D:/GitHub/CrashRadar/src/services/ScenarioChecklistService.js) (DB-first mit Offline-Fallback) und [`MacroScorecardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js) (persistente Speicherung von `actual_value`, `details_json` und `status`) umgestellt.
  * **Konzept & Befund:** Vollständig dokumentiert in [`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md) und [`ScenarioChecklistService-Gap-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/ScenarioChecklistService-Gap-Analyse.md).
  * **Bereinigung:** `config/Fiscal-Calendar-Config.json` und `config/Macro-Scenarios-Config.json` restlos gelöscht.
  * **Test-Suite & Verifikation:** 108/108 Vitest-Testsuiten (931 Tests) erfolgreich; Live-DB-Ingestion (40 Events) und Scorecard-Abgleich verifiziert.
