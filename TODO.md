# CrashRadar Refactoring - Status & TODOs

> **Zweck:** Unmittelbare, operative Arbeitsliste für das laufende Entwicklungs-Sprint auf Code-Ebene (Mikro-Ebene).  
> **Fokus:** Konkrete Dateipfade, Klassennamen, Konfigurationsstrukturen und Entscheidungslogiken (if/else), die unmittelbar im Code implementiert werden müssen.

## Was noch zu tun ist (Offen)

### 1. Dynamisches Debouncing & Krisen-Aufwach-Logik der Notifications
* **Problem:** Das aktuelle Debouncing in [`NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) arbeitet mit einem starren 14-Tage-Fenster. Wenn die `MacroRegimeEngine` ein akutes Krisen- oder Kollisionsfenster meldet (z. B. Kollision in 14 Tagen, Liquiditätsentzug oder Veto aktiv), darf das System nicht in einem 14-tägigen "Debouncing-Schlaf" verharren, sondern muss hochsensibel und sofort reaktionsfähig sein.
* **Ziel:** Das Debouncing muss dynamisch an das Makro-Klima gekoppelt werden:
  * **Normalzustand:** 14 Tage Spam-Schutz für reguläre Warnungen.
  * **Spätzyklus / Kollisions-Fenster aktiv:** Verkürzung des Debouncings auf 1–2 Tage oder sofortige Alarmierung bei Zustands-/Statuswechsel.
  * **Flash Crash / Akute Panik:** 0–2 Tage / Sofort-Push für relevante Re-Entry- und Exit-Signale.
* **Betroffene Komponenten [OFFEN]:**
  * [`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) (`getAlerts()` mit dynamischer `debounceDays`-Berechnung basierend auf `macroState.regime` und `macroState.vetos`).
  * [`config/Notification-Config.json`](file:///D:/GitHub/CrashRadar/config/Notification-Config.json) (Konfigurierbare Debounce-Schwellenwerte pro Marktphase).

### 2. Trading & Execution Engine (Architektur, Einzeltitel-ML & 21-Jahre-Backtest)
* **Architektur & Konzept-Blaupause:** Vollständig dokumentiert in [`docs/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/TradingEngine.md).
* **Umfang der Säule:**
  * **Portfolio-DNA & State Machine:** 5-Stufen-Modell für 50/50 Krypto- & Growth-Portfolio (`MSTR`, `NVTS`, `SOFI`, `ZETA`).
  * **FINRA Short-Volume & Fundamentaler Wachhund:** Ticker-spezifische LSTMs (`MlRegimeRadarStockIndicator.js`) kombiniert mit Bilanz-Vetos (`Fundamental-Veto-Config.json`).
  * **Dynamische Positionsgrößen-Skalierung:** Fractional-Kelly-Logik (`action.scaleDown`) basierend auf Makro-Crash-Risiko ($> 70\,\%$) und Vetos.
  * **A/B-Testzyklus (Makro-Heuristik vs. ML-Ensemble):** Empirischer Vergleich über 21 Jahre (10 Großkrisen).
* **Status:** Vorbereitung & Konzeptionsphase in [`docs/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/TradingEngine.md) abgeschlossen; Umsetzung folgt im dedizierten Entwicklungszweig.
