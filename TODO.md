# CrashRadar Refactoring - Status & TODOs

> **Zweck:** Unmittelbare, operative Arbeitsliste für das laufende Entwicklungs-Sprint auf Code-Ebene (Mikro-Ebene).  
> **Fokus:** Konkrete Dateipfade, Klassennamen, Konfigurationsstrukturen und Entscheidungslogiken (if/else), die unmittelbar im Code implementiert werden müssen.

## Was noch zu tun ist (Offen)

### 1. Dynamischer Makro-Wirtschaftskalender & Szenario-Framework (Option A: Full DB)
* **Konzept-Spezifikation:** Vollständig dokumentiert in [`docs/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/Makro-Kalender-Szenarien-Konzept.md).
* **Ziel:** Vollständige Ablösung der statischen `Macro-Scenarios-Config.json` durch eine automatisierte, datenbankgestützte Event-, Kalender- und Scorecard-Engine.
* **Operative Umsetzungsschritte [OFFEN]:**
  * **Schritt 1 (DDL & DB-Migration):** Anlegen der Tabelle `macro_calendar_events` via `src/db/migrations/create_macro_calendar_events.sql` (inkl. `consensus_estimate`, `previous_value`, `status`, `rule_json`).
  * **Schritt 2 (`MacroCalendarFetcher.js`):** Implementierung des Ingestion-Dienstes für offizielle FRED-Termine (`/fred/release/dates`) und Konsens-Schätzungen (ForexFactory JSON-Feed & Cleveland Fed Nowcast).
  * **Schritt 3 (`MacroScenarioRuleService.js`):** Implementierung der 2-Stufen-Regel-Engine (`TWO_STAGE_CONSENSUS`, `ALLOWED_VALUES`, `SPREAD_TO_METRIC`) und Quartalszuordnung.
  * **Schritt 4 (Runner-Refactoring):** Umstellung von [`ScenarioChecklistService.js`](file:///D:/GitHub/CrashRadar/src/services/ScenarioChecklistService.js) und [`MacroScorecardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js) auf die MySQL-Tabelle `macro_calendar_events` mit lokalem Werteabgleich aus `econ_fred`.
  * **Schritt 5 (Test-Suite & Verifikation):** Unit- und Integrationstests mit Mock-Daten und Live-Dry-Run via CLI (`--check-scenario`).

### 2. Dynamisches Debouncing & Krisen-Aufwach-Logik der Notifications
* **Problem:** Das aktuelle Debouncing in [`NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) arbeitet mit einem starren 14-Tage-Fenster. Wenn die `MacroRegimeEngine` ein akutes Krisen- oder Kollisionsfenster meldet (z. B. Kollision in 14 Tagen, Liquiditätsentzug oder Veto aktiv), darf das System nicht in einem 14-tägigen "Debouncing-Schlaf" verharren, sondern muss hochsensibel und sofort reaktionsfähig sein.
* **Ziel:** Das Debouncing muss dynamisch an das Makro-Klima gekoppelt werden:
  * **Normalzustand:** 14 Tage Spam-Schutz für reguläre Warnungen.
  * **Spätzyklus / Kollisions-Fenster aktiv:** Verkürzung des Debouncings auf 1–2 Tage oder sofortige Alarmierung bei Zustands-/Statuswechsel.
  * **Flash Crash / Akute Panik:** 0–2 Tage / Sofort-Push für relevante Re-Entry- und Exit-Signale.
* **Betroffene Komponenten [OFFEN]:**
  * [`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) (`getAlerts()` mit dynamischer `debounceDays`-Berechnung basierend auf `macroState.regime` und `macroState.vetos`).
  * [`config/Notification-Config.json`](file:///D:/GitHub/CrashRadar/config/Notification-Config.json) (Konfigurierbare Debounce-Schwellenwerte pro Marktphase).

### 3. Trading & Execution Engine (Architektur, Einzeltitel-ML & 21-Jahre-Backtest)
* **Architektur & Konzept-Blaupause:** Vollständig dokumentiert in [`docs/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/TradingEngine.md).
* **Umfang der Säule:**
  * **Portfolio-DNA & State Machine:** 5-Stufen-Modell für 50/50 Krypto- & Growth-Portfolio (`MSTR`, `NVTS`, `SOFI`, `ZETA`).
  * **FINRA Short-Volume & Fundamentaler Wachhund:** Ticker-spezifische LSTMs (`MlRegimeRadarStockIndicator.js`) kombiniert mit Bilanz-Vetos (`Fundamental-Veto-Config.json`) und Szenario-Feedback (`MacroScenarioIndicator`).
  * **Dynamische Positionsgrößen-Skalierung:** Fractional-Kelly-Logik (`action.scaleDown`) basierend auf Makro-Crash-Risiko ($> 70\,\%$) und Vetos.
  * **A/B-Testzyklus (Makro-Heuristik vs. ML-Ensemble):** Empirischer Vergleich über 21 Jahre (10 Großkrisen).
* **Status:** Vorbereitung & Konzeptionsphase in [`docs/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/TradingEngine.md) abgeschlossen; Umsetzung folgt im dedizierten Entwicklungszweig.
