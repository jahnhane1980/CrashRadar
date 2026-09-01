# CrashRadar Roadmap & Offene TODOs

> **Zweck:** Überblick über den übergeordneten, strategischen Entwicklungsplan, architektonische Meilensteine und langfristige Zeithorizonte (Makro-Ebene).  
> **Fokus:** Übergreifende Features, externe Schnittstellen (Supabase/Datacenter), historische Meilensteine, Release-Zyklen und Priorisierung größerer Baustellen.

*Hinweis: Die Reihenfolge der Aufgaben spiegelt ihre Dringlichkeit und architektonische Priorität wider.*

## 1. Dynamisches Makro-Szenario- & Kalender-Framework (Vom Event-Tracker zum Regime-Indikator)
* **Konzept-Blaupause:** Ausführliche Spezifikation unter [`docs/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/Makro-Kalender-Szenarien-Konzept.md).
* **Zweigeteilte Entwicklungs-Pipeline:**
  * **Phase 1 (Aktiv in Vorbereitung - Autarke Datenbank-Scorecard):**
    * Ablösung der statischen `Macro-Scenarios-Config.json` durch MySQL-Tabelle `macro_calendar_events`.
    * Automatische Termin-Ingestion über FRED Release API (`/fred/release/dates`).
    * Offizieller Wall-Street-Konsens über ForexFactory JSON-Feed & Cleveland Fed Inflation Nowcasting.
    * 2-Stufen-Regel-Engine (`TWO_STAGE_CONSENSUS` mit Makro-Guards) und Ntfy-Scorecard-Alerting.
  * **Phase 2 (Zukunft - Nativer Regime-Indikator & TradingEngine-Anbindung):**
    * Kapselung der Szenario-Auswertung als vollwertiger Indikator (`MacroScenarioIndicator.js`) in der `MacroEngine`.
    * Direkte Anbindung an die [`docs/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/TradingEngine.md) als Fundamental-Watchdog und Fractional-Kelly-Risikobremse (`action.scaleDown`).

## 2. Architektur-Review der Indikatoren & Notifications
* **Problem:** Es besteht der Verdacht, dass die aktuelle Pipeline ineffizient ist. Möglicherweise werden Daten doppelt geladen/ausgewertet oder Logiken überschneiden sich unnötig zwischen Engine und Notification-Schicht.
* **Ziel:** Kritische Prüfung der aktuellen Architektur auf Effizienz, Redundanz und saubere Trennung der Zuständigkeiten (Separation of Concerns).
* **Aufgaben [OFFEN]:** Datenfluss der Indikatoren und Alarme analysieren. Überlegen, ob dies wirklich die "beste Lösung" ist oder ob ein Refactoring der Architektur ansteht, um Mehrfachauswertungen zu eliminieren.

## 3. Trading & Execution Engine (Portfolio State Machine, Einzeltitel-ML & 21-Jahre-Backtest)
* **Architektur & Gesamtkonzept:** Siehe [`docs/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/TradingEngine.md) für die 5 Portfolio-Zustände (State Machine), die 50/50 Krypto- & Growth-Philosophie, Fractional Kelly und das Re-Entry-System.
* **Kern-Bausteine [OFFEN]:**
  * **Einzeltitel-ML & FINRA Short-Volume Wachhund:** Ticker-spezifische LSTMs (`MlRegimeRadarStockIndicator.js`) kombiniert mit harten Bilanz-Vetos (`Fundamental-Veto-Config.json`) und Szenario-Feedback (`MacroScenarioIndicator`).
  * **Dynamische Positionsgrößen-Skalierung:** Fractional-Kelly-Logik (`action.scaleDown`) basierend auf Makro-Risiko und Vetos.
  * **Großer 21-Jahre-A/B-Backtest:** Empirische Validierung (Deterministische Makro-Regeln vs. Hybrid ML-Ensemble) über 10 Großkrisen (2005–2026).

## 4. Datensynchronisation mit "datacenter" (Supabase)
* **Problem:** Das "datacenter"-Projekt hat eigene exklusive Datensätze (z.B. KI-basierte News/SEC-Analysen, QRA-Estimates, Sector Rotation), die aktuell in der CrashRadar MySQL-Datenbank nicht abgebildet werden. 
* **Aufgabe [OFFEN]:** Überprüfung des Datenbestands in Supabase. Es muss evaluiert werden, welche exklusiven Daten aus dem "datacenter" in CrashRadar (z.B. für neue ML-Features) genutzt werden sollen und ob diese direkt in Supabase verbleiben oder in die MySQL-DB migriert werden.
* **Erster Meilenstein (14.07.2026) - M5-Candles Transfer [ABGESCHLOSSEN]:** 
  * Struktur für die 5-Minuten-Kerzen in CrashRadar (MySQL) aufgebaut (`market_data_m5`).
  * Initialer Export/Import-Skriptlauf (`import_m5_supabase.js`) überführt M5-Datensätze nach MySQL.
* **Hinweis zu Optionsdaten (AlphaVantage):** Das `datacenter` nutzt die AlphaVantage-API (`AlphaVantageOptionService.js`) gezielt für Optionsdaten. Konsolidierung redundanter Fetches in CrashRadar prüfen.

## 5. Gamma-Hedging Backtest (Spurenlesen)
* **Ziel:** Evaluierung des "Spurenlesen" Konzepts (Säule 2: Gamma Hedging). Da Yahoo Finance keine historischen Optionsdaten bereitstellt, sammeln wir ab dem 04.07.2026 jeden Tag Live-Daten über den Fetcher.
* **Stichtag für ersten Backtest:** **04.01.2027** (nach ca. 6 Monaten Live-Aufzeichnung). Erst dann haben wir genug Markt-Regime (Bull, Bear, Volatility) und OPEX-Zyklen durchlebt, um die Gamma-Support/Resistance-Mauern belastbar in ML-Modelle oder Indikatoren zu integrieren.

---

## 🏆 Erreichte Meilensteine (Abgeschlossen)

### ✅ Multivariates Makro-ML-Regime-Modell (Liquidität, Smart Money, Zinsen)
* **Status [ABGESCHLOSSEN]:**
  * Feature-Pipeline & Stationarisierung auf Basis von `data/historical_events_raw_indicators.csv`.
  * Python-Trainingspipeline mit XGBoost, Purged Walk-Forward CV unter [`scratch/ml/train_macro_regime.py`](file:///D:/GitHub/CrashRadar/scratch/ml/train_macro_regime.py).
  * Latenzfreier Inferenz-Service [`src/services/MacroMlService.js`](file:///D:/GitHub/CrashRadar/src/services/MacroMlService.js) in reinem JS.
  * Integration von [`src/analysis/indicators/MlRegimeRadarMacroIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarMacroIndicator.js) in [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js), [`NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) und tägliche Ntfy-Reports.
* **Dokumentation:** Vollständig dokumentiert in [`docs/Makro-ML.md`](file:///D:/GitHub/CrashRadar/docs/Makro-ML.md).
