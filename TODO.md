# CrashRadar Refactoring - Status & TODOs

> **Zweck:** Unmittelbare, operative Arbeitsliste für das laufende Entwicklungs-Sprint auf Code-Ebene (Mikro-Ebene).  
> **Fokus:** Konkrete Dateipfade, Klassennamen, Konfigurationsstrukturen und Entscheidungslogiken (if/else), die unmittelbar im Code implementiert werden müssen.

## Was noch zu tun ist (Offen)

### 1. Dynamisches Debouncing & Krisen-Aufwach-Logik der Trade-Engine
* **Problem:** Das aktuelle Debouncing in [`NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) arbeitet mit einem starren 14-Tage-Fenster. Wenn die `MacroRegimeEngine` ein akutes Krisen- oder Kollisionsfenster meldet (z. B. Kollision in 14 Tagen, Liquiditätsentzug oder Veto aktiv), darf die `TradeSetupEngine` nicht in einem 14-tägigen "Debouncing-Schlaf" verharren, sondern muss hochsensibel und sofort reaktionsfähig sein.
* **Architektur-Kontext:** Siehe [`TradingEngine.md`](file:///D:/GitHub/CrashRadar/TradingEngine.md) für die 5 Portfolio-Zustände der State Machine, die bei einem Regimewechsel ein sofortiges Aufwachen erfordern.
* **Ziel:** Das Debouncing muss dynamisch an das Makro-Klima gekoppelt werden:
  * **Normalzustand:** 14 Tage Spam-Schutz für reguläre Warnungen.
  * **Spätzyklus / Kollisions-Fenster aktiv:** Verkürzung des Debouncings auf 1–2 Tage oder sofortige Alarmierung bei Zustands-/Statuswechsel.
  * **Flash Crash / Akute Panik:** 0–2 Tage / Sofort-Push für relevante Re-Entry- und Exit-Signale.
* **Betroffene Komponenten [OFFEN]:**
  * [`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) (`getAlerts()` mit dynamischer `debounceDays`-Berechnung basierend auf `macroState.regime` und `macroState.vetos`).
  * [`config/Notification-Config.json`](file:///D:/GitHub/CrashRadar/config/Notification-Config.json) (Konfigurierbare Debounce-Schwellenwerte pro Marktphase).

### 2. A/B-Testzyklus & empirische Validierung der TradingEngine (Mit vs. Ohne ML-Input)
* **Problem & Fragestellung:** Bringen Machine-Learning-Modelle (LSTM für Krypto/Tech-Regimes und XGBoost für Makro-Crash-Risiko) in der tatsächlichen Portfolio-Execution echten Mehrwert (Alpha / Drawdown-Reduktion) oder führen sie zu Überanpassung (Overfitting) und voreiligen Fehlsignalen im Vergleich zu den reinen deterministischen Makro- und Plumbing-Regeln?
* **Architektur-Blaupause:** Siehe [`TradingEngine.md`](file:///D:/GitHub/CrashRadar/TradingEngine.md) für die zugrundeliegende 50/50 Krypto- & Growth-Portfolio-Philosophie, die Take-Profit-Regeln (`MSTR`, `NVTS`) und das State-Machine-Design.
* **Warum dieser Testzyklus zwingend notwendig ist:**
  * Im quantitativen Portfoliomanagement darf kein KI-Modell ungeprüft Live-Allokationen steuern.
  * Wir müssen empirisch belegen, ob die KI-Regime-Filter (`CYCLE_TOP`, `BEAR_MARKET`, Makro-Crash-Risiko >70%) das Timing von Exits bei High-Beta Titeln (`MSTR`, `COIN`, `NVTS`, `SOFI`) verbessern oder ob die reinen Heuristiken (Halving-Uhr >970 Tage, SMA-200-Brüche, Treasury Capacity Radar) robuster abschneiden.
* **Testaufbau & A/B-Architektur:**
  * **Variante A (Reines Makro-Plumbing / Heuristik ohne ML):**
    * Execution basiert ausschließlich auf: `Treasury Capacity Radar`, `Margin Debt Deleveraging`, `Halving-Uhr (>970 Tage)`, `SMA 200 Bruch` und `Gold Capitulation / Panik-Böden`.
  * **Variante B (Hybrid-System / Makro + KI-Ensemble):**
    * Nutzt alle Regeln aus Variante A PLUS:
      1. LSTM Asset-Regimes (z. B. `CYCLE_TOP` Trigger für Krypto/Tech-Exits).
      2. XGBoost Makro-Risiko-Score (kontinuierliches Fractional-Kelly Positionsgrößen-Sizing).
      3. FINRA Short-Volume Wachhund.
* **Vergleichs-Metriken über den 21-Jahre-Datensatz (10 Großkrisen):**
  1. **Maximaler Drawdown:** Konnte die KI Bärenmärkte (2008, 2020, 2022) noch verlustfreier umschiffen?
  2. **CAGR & Endkapital:** Wurden parabolische Gewinne besser am Top gesichert oder schnitt die KI Aufwärtstrends zu früh ab?
  3. **Sharpe & Sortino Ratio:** Verbessert der ML-Einsatz das risikobereinigte Renditeprofil?
  4. **Win Rate & Profit Factor:** Trefferquote der Ein- und Ausstiege.
* **Umsetzungs-Schritte [OFFEN]:**
  * [ ] Schalter-Mechanismus in [`config/Indicator-Pipeline-Config.json`](file:///D:/GitHub/CrashRadar/config/Indicator-Pipeline-Config.json) zur vollständigen Isolierung der ML-Indikatoren bereitstellen (`enableMlSignals: true/false`).
  * [ ] Backtest-Runner für `TradingEngine.js` schreiben, der beide Varianten automatisiert auf identischen historischen Timelines ausführt und eine strukturierte Vergleichs-Matrix (`scratch/reports/AB_TEST_ML_EVALUATION.md`) generiert.

### 3. FINRA Short-Volume: Ursachenforschung & Feature-Erweiterung
* **Problem:** Extreme FINRA-Leerverkaufsdaten wirken sich je nach Aktie massiv unterschiedlich aus. Die detaillierten empirischen Erkenntnisse dazu liegen in der `docs/ML_EVALUATIONS.md`.
* **Beweisführung (Abgeschlossen - Juli 2026):** Ein historischer Backtest des Bärenmarktes 2021/2022 hat bewiesen, dass dieses Verhalten strukturell ist und nicht am Bull-Run lag:
  * **ZETA:** 46 Extrem-Signale (>65% Short Vol). Win-Rate nach 5 Tagen: 67,4% (Squeeze-Kontra-Indikator).
  * **NVTS:** 71 Extrem-Signale. Win-Rate brach völlig ein auf 36,6% nach 20 Tagen (Todesspirale / Volatilitätsverstärker).
  * **SOFI:** Nur 2 Extrem-Signale im gesamten Bärenmarkt (Struktur verhinderte konzertiertes Shorting).
* **Ziel:** Das neuronale Netz soll künftig selbstständig interpretieren können, *warum* extrem hohes Short-Volume bei einer Aktie ein Kaufsignal, bei einer anderen aber ein Risiko darstellt.
  * **Phase 4: Pipeline-Integration & Wachhund [OFFEN]:** 
    * *Neu anzulegen:* `src/analysis/indicators/MlRegimeRadarStockIndicator.js` (Generischer Indikator, dem man im Konstruktor den Ticker übergibt). Zudem eine neue Config-Datei `config/Fundamental-Veto-Config.json` anlegen, in der die Bilanzen (Institutional Quote, Dilution Risk) für die Ticker hinterlegt werden.
    * *Anzupassen:* `src/analysis/TradeSetupEngine.js` (Den neuen Indikator für jeden Ticker dem `this.indicators`-Array hinzufügen).
    * *Wachhund-Logik (Change of Character):* In der `TradeSetupEngine` (oder direkt im Indikator) muss eine Veto-Weiche gebaut werden. Das Skript liest die `Fundamental-Veto-Config.json`.
      * *Regel:* Sagt das LSTM z.B. einen "ZETA Squeeze" vorher, der Wachhund sieht aber in der Config, dass die Inst. Quote massiv gecrasht ist (z.B. <50%) -> **BLOCKIERE** das Signal (Signal veraltet durch Bilanz-Strukturbruch). Gleiches gilt für plötzliche massive Verwässerung (`Dilution_Risk == HIGH`).

### 4. Multivariates Makro-ML-Modell: Implementierungs-Pipeline
* **Detail-Konzept:** Siehe [`docs/Makro-ML.md`](file:///D:/GitHub/CrashRadar/docs/Makro-ML.md).
* **Status:**
  * [x] **Feature-Preprocessing & Datenbasis:** Aggregation und Stationarisierung aller Rohdaten in [`data/historical_events_raw_indicators.csv`](file:///D:/GitHub/CrashRadar/data/historical_events_raw_indicators.csv).
  * [x] **Trainings- & Validierungs-Pipeline:** XGBoost-Modell mit Purged Walk-Forward Evaluierung unter [`scratch/ml/train_macro_regime.py`](file:///D:/GitHub/CrashRadar/scratch/ml/train_macro_regime.py) implementiert und trainiert.
  * [x] **Modell-Export & Node.js Runtime:** Modell erfolgreich exportiert nach `data/ml/models/macro_regime/macro_regime_model.json`.
  * [x] **Inferenz-Service:** [`src/services/MacroMlService.js`](file:///D:/GitHub/CrashRadar/src/services/MacroMlService.js) zur latenzfreien Baumausführung in reinem JS entwickelt und unit-getestet.
  * [x] **Indikator- & Notification-Integration:** [`src/analysis/indicators/MlRegimeRadarMacroIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarMacroIndicator.js) angebunden, in [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js) und [`NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) für Daily Push & Alarme integriert.
  * [ ] **TradeSetupEngine-Veto & Kelly-Sizing [OFFEN]:** Anbindung an `src/analysis/TradeSetupEngine.js` zur automatischen Skalierung (`action.scaleDown`) bei Makro-Risiko $> 70\,\%$.
