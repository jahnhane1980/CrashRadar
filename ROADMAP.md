# CrashRadar Roadmap & Offene TODOs

> **Zweck:** Überblick über den übergeordneten, strategischen Entwicklungsplan, architektonische Meilensteine und langfristige Zeithorizonte (Makro-Ebene).  
> **Fokus:** Übergreifende Features, externe Schnittstellen (Supabase/Datacenter), historische Meilensteine, Release-Zyklen und Priorisierung größerer Baustellen.

*Hinweis: Die Reihenfolge der Aufgaben spiegelt ihre Dringlichkeit und architektonische Priorität wider und korrespondiert exakt mit der operativen [`TODO.md`](file:///D:/GitHub/CrashRadar/TODO.md).*

---

## 1. Portfoliostrategien (Detail-Ausarbeitung, Harmonisierung & Validierung)
* **Status:** Höchste architektonische Priorität. Bevor der Signal-Dienst oder die Engine implementiert werden, müssen alle Strategien als mathematisch geschlossenes System vorliegen.
* **Fokus-Bereiche [IN VORBEREITUNG]:**
  * **Kamikaze Growth Schärfung:** Integration der parabolischen Climax-Top-Liquidierung (`TOP_CLIMAX_ALERT` nach dem NVTS > $ 30 Case) und Watchlist-Freigabe für Turnarounds in [`docs/architecture/strategies/Kamikaze-Growth.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Kamikaze-Growth.md).
  * **Satellite-Strategie Spezifikation:** Fertigstellung von [`docs/architecture/strategies/Satelite.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Satelite.md) für den opportunistischen Solana- & ETH-Staking ETF aus Gehaltsüberschüssen.
  * **MCW vs. 7-Slot-Guru Abgleich:** Strategischer Vergleich, ob das 7-Slot-Guru-System von seiner statischen 25 % Gold-Quote auf die hocheffektive MCW-Makrosicherung (100 % Notfall-Evakuierung in 50 % Gold / 50 % Cash mit Dual-Re-Entry Panic Sniper) umgestellt wird ([`docs/architecture/strategies/7-Slot-Guru-Konsens-System.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/7-Slot-Guru-Konsens-System.md)).
  * **Gold-SPY DCA & Tranchen:** Finaler Review der Schwellenwerte für parabolisches Skimming in Gold und 40/30/30 Bottom-Sniper Re-Entry in [`docs/architecture/strategies/Gold-SPY.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-SPY.md).
  * **Gold-GDX Minen-Referenz:** Verbleibt als reine Forschungs- und Minenreferenz in [`docs/architecture/strategies/Gold-GDX.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-GDX.md) und wird Nutzern im Bot vorerst nicht angeboten.

## 2. PortfolioStrategyEngine (Plugin-Architektur & Multi-Strategie Orchestrierung)
* **Architektur-Ziel:** Etablierung einer übergeordneten **`PortfolioStrategyEngine`** als modulares Plugin-System in `CrashRadar`.
* **Strategie-Registry:** Genau wie Indikatoren über `_indicators` registriert werden, können Portfoliostrategien dynamisch über eine einheitliche Schnittstelle geladen, parallel berechnet und überwacht werden (`MuzzledCathieWoodStrategy`, `KamikazeGrowthStrategy`, `SevenSlotGuruStrategy`, `GoldSpyDcaStrategy`, `SatelliteStakingStrategy`).
* **Meilensteine:**
  * Definition der Standard-Schnittstelle `BasePortfolioStrategy.js`.
  * Parallele Auswertung und Reporting über `PortfolioStrategyEngine.js`.

## 3. Notification- & Signal-System: Telegram, Edge-Gateway & Architektur-Review
* **Master-Architektur & Spezifikation:** Vollständig dokumentiert in [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md).
* **Ziel:** Vollständige Umstellung von Ntfy auf Telegram nach dem 2-Säulen-Prinzip (0,00 € Serverless-Betrieb) inkl. Bereinigung der Notification-Pipeline:
  * **Architektur-Review der Indikatoren & Notifications:** Gründliche Überprüfung der aktuellen Pipeline auf Ineffizienzen, Vermeidung doppelter Indikatoren-Auswertungen und saubere Trennung der Zuständigkeiten (Separation of Concerns).
  * **Dynamisches Debouncing & Krisen-Aufwach-Logik:** Dynamische Koppelung des Spam-Schutzes an das Makro-Klima (14 Tage Normalbetrieb, 1–2 Tage bei Kollisionsfenster, 0 Tage / Sofort-Push bei Veto oder Flash Crash).
  * **Säule 1 (CrashRadar - Broadcast & Pre-Computation):** Öffentlicher Einweg-Kanal `Makro-Wetter` für Markt-Ampel und Kollisionswarnungen sowie täglicher Webhook-Push des `daily_intelligence.json` Snapshots.
  * **Säule 2 (CrashRadar-Signals - Personalisiertes 1:1 Edge-Gateway):** Cloudflare Worker + D1 SQLite für diskrete 1:1-Nutzerchats, Sparplan-Allokationen nach Strategie (`strategy_id`), lückenloses Feedback (`[✅ Ausgeführt]`), die 3 Beweisszenarien (Worst Case, Best Case, Neutral) und proaktiver Transparenz-Push bei Strategie-Updates (Changelog-Broadcasting).
  * **Lokale Test-Isolation (`-Test` Pendants):** Jeder Kanal und jede Gruppe erhält für lokale Tests ein gespiegeltes `-Test` Pendant via `TELEGRAM_ENV`.

## 4. Dynamisches Makro-Szenario- & Kalender-Framework (Vom Event-Tracker zum Regime-Indikator)
* **Konzept-Blaupause:** Ausführliche Spezifikation unter [`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md).
* **Zweigeteilte Entwicklungs-Pipeline:**
  * **Phase 1 (Autarke Datenbank-Scorecard):**
    * Ablösung der statischen `Macro-Scenarios-Config.json` durch MySQL-Tabelle `macro_calendar_events`.
    * Automatische Termin-Ingestion über FRED Release API (`/fred/release/dates`).
    * Offizieller Wall-Street-Konsens über ForexFactory JSON-Feed & Cleveland Fed Inflation Nowcasting.
    * 2-Stufen-Regel-Engine (`TWO_STAGE_CONSENSUS` mit Makro-Guards) und Scorecard-Alerting.
  * **Phase 2 (Nativer Regime-Indikator & TradingEngine-Anbindung):**
    * Kapselung der Szenario-Auswertung als vollwertiger Indikator (`MacroScenarioIndicator.js`) in der `MacroEngine`.
    * Anbindung an die Trading Engine als Fundamental-Watchdog und Fractional-Kelly-Risikobremse (`action.scaleDown`).

## 5. M5-Intraday-Pipeline & Single-Asset Radar (Fokus: High-Beta & Sektor-ETFs)
* **Master-Architektur:** Vollständig dokumentiert in [`docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md) (mit Detail-Dokus [`docs/architecture/single-asset-radar/M5Candels.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/M5Candels.md) und [`docs/architecture/single-asset-radar/SingleAssetTrading.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/SingleAssetTrading.md)).
* **Ziel:** Direkte Anbindung an Polygon.io via [`PolygonFetchAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/PolygonFetchAdapter.js) in `CrashRadar` zur tagesaktuellen Überwachung aktiver Positionen (`PLTR`, `NVTS`, `IBRX`, `IGV`, `CIBR`).
* **Etappen:**
  * **Meilenstein 1 (Abgeschlossen):** Initialer M5-Diff-Sync via Supabase [`import_m5_supabase.js`](file:///D:/GitHub/CrashRadar/scratch/tools/import_m5_supabase.js) nach MySQL `market_data_m5`.
  * **Meilenstein 2 (Teilweise abgeschlossen):** Profiling-Infrastruktur (`--profile intraday_m5`) in CLI und Fetcher implementiert; nativer `PolygonFetchAdapter` und Workflow `intraday-m5-fetch.yml` stehen zur Umsetzung bereit.
  * **Meilenstein 3 (Zukunft):** Live-Radar Anbindung für Intraday-Zündungen (`BREAKOUT_ACTIVE`) und Climax-Exits (`TOP_CLIMAX_ALERT`).

## 6. Trading & Execution Engine (Portfolio State Machine, Einzeltitel-ML & 21-Jahre-Backtest)
* **Architektur & Gesamtkonzept:** Siehe [`docs/architecture/trading-engine/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md) für die 5 Portfolio-Zustände (State Machine), die 50/50 Krypto- & Growth-Philosophie, Fractional Kelly und das Re-Entry-System.
* **Kern-Bausteine [ZUKUNFTSPROJEKT / ABSCHLUSS]:**
  * **Einzeltitel-ML & FINRA Short-Volume Wachhund:** Ticker-spezifische LSTMs (`MlRegimeRadarStockIndicator.js`) kombiniert mit harten Bilanz-Vetos (`Fundamental-Veto-Config.json`) und Szenario-Feedback (`MacroScenarioIndicator`).
  * **Dynamische Positionsgrößen-Skalierung:** Fractional-Kelly-Logik (`action.scaleDown`) basierend auf Makro-Risiko und Vetos.
  * **Großer 21-Jahre-A/B-Backtest:** Empirische Validierung (Deterministische Makro-Regeln vs. Hybrid ML-Ensemble) über 10 Großkrisen (2005–2026).

## 7. Gamma-Hedging Backtest: Spurenlesen (Stichtag: 04.01.2027)
* **Ziel:** Evaluierung des "Spurenlesen" Konzepts (Säule 2: Gamma Hedging). Da Yahoo Finance keine historischen Optionsdaten bereitstellt, sammeln wir ab dem 04.07.2026 jeden Tag Live-Daten über den Fetcher.
* **Stichtag für ersten Backtest:** **04.01.2027** (nach ca. 6 Monaten Live-Aufzeichnung). Erst dann haben wir genug Markt-Regime (Bull, Bear, Volatility) und OPEX-Zyklen durchlebt, um die Gamma-Support/Resistance-Mauern belastbar auswerten zu können.
* **Verwertungs-Ausblick:** Die Erkenntnisse fließen später als gezieltes Update entweder in eine defensive Absicherungsstrategie (z. B. dynamische Put/Call-Schwellen) oder als Volatilitätsfilter in die Trading Engine ein.

---

## 🏆 Erreichte Meilensteine (Abgeschlossen)

### ✅ Multivariates Makro-ML-Regime-Modell (Liquidität, Smart Money, Zinsen)
* **Status [ABGESCHLOSSEN]:**
  * Feature-Pipeline & Stationarisierung auf Basis von `data/historical_events_raw_indicators.csv`.
  * Python-Trainingspipeline mit XGBoost, Purged Walk-Forward CV unter [`scratch/architecture/ml/train_macro_regime.py`](file:///D:/GitHub/CrashRadar/scratch/architecture/ml/train_macro_regime.py).
  * Latenzfreier Inferenz-Service [`src/services/MacroMlService.js`](file:///D:/GitHub/CrashRadar/src/services/MacroMlService.js) in reinem JS.
  * Integration von [`src/analysis/indicators/MlRegimeRadarMacroIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarMacroIndicator.js) in [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js), [`NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) und tägliche Ntfy-Reports.
* **Dokumentation:** Vollständig dokumentiert in [`docs/architecture/ml/Makro-ML.md`](file:///D:/GitHub/CrashRadar/docs/architecture/ml/Makro-ML.md).
