# CrashRadar Roadmap & Offene TODOs

> **Zweck:** Überblick über den übergeordneten, strategischen Entwicklungsplan, architektonische Meilensteine und langfristige Zeithorizonte (Makro-Ebene).  
> **Fokus:** Übergreifende Features, externe Schnittstellen (Supabase/Datacenter), historische Meilensteine, Release-Zyklen und Priorisierung größerer Baustellen.

*Hinweis: Die Reihenfolge der Aufgaben spiegelt ihre Dringlichkeit und architektonische Priorität wider.*

## 1. Dynamisches Makro-Szenario- & Kalender-Framework (Vom Event-Tracker zum Regime-Indikator)
* **Konzept-Blaupause:** Ausführliche Spezifikation unter [`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md).
* **Zweigeteilte Entwicklungs-Pipeline:**
  * **Phase 1 (Aktiv in Vorbereitung - Autarke Datenbank-Scorecard):**
    * Ablösung der statischen `Macro-Scenarios-Config.json` durch MySQL-Tabelle `macro_calendar_events`.
    * Automatische Termin-Ingestion über FRED Release API (`/fred/release/dates`).
    * Offizieller Wall-Street-Konsens über ForexFactory JSON-Feed & Cleveland Fed Inflation Nowcasting.
    * 2-Stufen-Regel-Engine (`TWO_STAGE_CONSENSUS` mit Makro-Guards) und Ntfy-Scorecard-Alerting.
  * **Phase 2 (Zukunft - Nativer Regime-Indikator & TradingEngine-Anbindung):**
    * Kapselung der Szenario-Auswertung als vollwertiger Indikator (`MacroScenarioIndicator.js`) in der `MacroEngine`.
    * Direkte Anbindung an die [`docs/architecture/trading-engine/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md) als Fundamental-Watchdog und Fractional-Kelly-Risikobremse (`action.scaleDown`).

## 2. Architektur-Review der Indikatoren & Notifications
* **Problem:** Es besteht der Verdacht, dass die aktuelle Pipeline ineffizient ist. Möglicherweise werden Daten doppelt geladen/ausgewertet oder Logiken überschneiden sich unnötig zwischen Engine und Notification-Schicht.
* **Ziel:** Kritische Prüfung der aktuellen Architektur auf Effizienz, Redundanz und saubere Trennung der Zuständigkeiten (Separation of Concerns).
* **Aufgaben [OFFEN]:** Datenfluss der Indikatoren und Alarme analysieren. Überlegen, ob dies wirklich die "beste Lösung" ist oder ob ein Refactoring der Architektur ansteht, um Mehrfachauswertungen zu eliminieren.

## 3. Trading & Execution Engine (Portfolio State Machine, Einzeltitel-ML & 21-Jahre-Backtest)
* **Architektur & Gesamtkonzept:** Siehe [`docs/architecture/trading-engine/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md) für die 5 Portfolio-Zustände (State Machine), die 50/50 Krypto- & Growth-Philosophie, Fractional Kelly und das Re-Entry-System.
* **Kern-Bausteine [OFFEN]:**
  * **Einzeltitel-ML & FINRA Short-Volume Wachhund:** Ticker-spezifische LSTMs (`MlRegimeRadarStockIndicator.js`) kombiniert mit harten Bilanz-Vetos (`Fundamental-Veto-Config.json`) und Szenario-Feedback (`MacroScenarioIndicator`).
  * **Dynamische Positionsgrößen-Skalierung:** Fractional-Kelly-Logik (`action.scaleDown`) basierend auf Makro-Risiko und Vetos.
  * **Großer 21-Jahre-A/B-Backtest:** Empirische Validierung (Deterministische Makro-Regeln vs. Hybrid ML-Ensemble) über 10 Großkrisen (2005–2026).

## 4. M5-Intraday-Pipeline & Single-Asset Radar (Fokus: High-Beta & Sektor-ETFs)
* **Master-Architektur:** Vollständig dokumentiert in [`docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md) (mit Detail-Dokus [`docs/architecture/single-asset-radar/M5Candels.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/M5Candels.md) und [`docs/architecture/single-asset-radar/SingleAssetTrading.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/SingleAssetTrading.md)).
* **Ziel:** Direkte, autarke Anbindung an Polygon.io via [`PolygonFetchAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/PolygonFetchAdapter.js) in `CrashRadar` zur tagesaktuellen Überwachung aktiver Positionen (z. B. `PLTR`, `NVTS`, `IBRX`, `IGV`, `CIBR`).
* **Etappen:**
  * **Meilenstein 1 (Abgeschlossen):** Initialer M5-Diff-Sync via Supabase [`import_m5_supabase.js`](file:///D:/GitHub/CrashRadar/scratch/tools/import_m5_supabase.js) nach MySQL `market_data_m5`.
  * **Meilenstein 2 (Teilweise abgeschlossen):** Profiling-Infrastruktur (`--profile intraday_m5`) in CLI und Fetcher implementiert; nativer `PolygonFetchAdapter` und Workflow `intraday-m5-fetch.yml` stehen zur Umsetzung bereit.
  * **Meilenstein 3 (Zukunft):** Live-Radar Anbindung an Ntfy für Intraday-Zündungen (`BREAKOUT_ACTIVE`) und Climax-Exits (`TOP_CLIMAX_ALERT`).

## 5. Gamma-Hedging Backtest (Spurenlesen)
* **Ziel:** Evaluierung des "Spurenlesen" Konzepts (Säule 2: Gamma Hedging). Da Yahoo Finance keine historischen Optionsdaten bereitstellt, sammeln wir ab dem 04.07.2026 jeden Tag Live-Daten über den Fetcher.
* **Stichtag für ersten Backtest:** **04.01.2027** (nach ca. 6 Monaten Live-Aufzeichnung). Erst dann haben wir genug Markt-Regime (Bull, Bear, Volatility) und OPEX-Zyklen durchlebt, um die Gamma-Support/Resistance-Mauern belastbar in ML-Modelle oder Indikatoren zu integrieren.

---

## 🏆 Erreichte Meilensteine (Abgeschlossen)

### ✅ Multivariates Makro-ML-Regime-Modell (Liquidität, Smart Money, Zinsen)
* **Status [ABGESCHLOSSEN]:**
  * Feature-Pipeline & Stationarisierung auf Basis von `data/historical_events_raw_indicators.csv`.
  * Python-Trainingspipeline mit XGBoost, Purged Walk-Forward CV unter [`scratch/architecture/ml/train_macro_regime.py`](file:///D:/GitHub/CrashRadar/scratch/architecture/ml/train_macro_regime.py).
  * Latenzfreier Inferenz-Service [`src/services/MacroMlService.js`](file:///D:/GitHub/CrashRadar/src/services/MacroMlService.js) in reinem JS.
  * Integration von [`src/analysis/indicators/MlRegimeRadarMacroIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarMacroIndicator.js) in [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js), [`NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) und tägliche Ntfy-Reports.
* **Dokumentation:** Vollständig dokumentiert in [`docs/architecture/ml/Makro-ML.md`](file:///D:/GitHub/CrashRadar/docs/architecture/ml/Makro-ML.md).
