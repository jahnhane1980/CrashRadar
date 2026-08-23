# CrashRadar Refactoring - Status & TODOs

> **Zweck:** Unmittelbare, operative Arbeitsliste für das laufende Entwicklungs-Sprint auf Code-Ebene (Mikro-Ebene).  
> **Fokus:** Konkrete Dateipfade, Klassennamen, Konfigurationsstrukturen und Entscheidungslogiken (if/else), die unmittelbar im Code implementiert werden müssen.

## Was noch zu tun ist (Offen)

### 1. FINRA Short-Volume: Ursachenforschung & Feature-Erweiterung
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

### 2. Multivariates Makro-ML-Modell: Implementierungs-Pipeline
* **Detail-Konzept:** Siehe [`docs/Makro-ML.md`](file:///D:/GitHub/CrashRadar/docs/Makro-ML.md).
* **Status:**
  * [x] **Feature-Preprocessing & Datenbasis:** Aggregation und Stationarisierung aller Rohdaten in [`data/historical_events_raw_indicators.csv`](file:///D:/GitHub/CrashRadar/data/historical_events_raw_indicators.csv).
  * [x] **Trainings- & Validierungs-Pipeline:** XGBoost-Modell mit Purged Walk-Forward Evaluierung unter [`scratch/ml/train_macro_regime.py`](file:///D:/GitHub/CrashRadar/scratch/ml/train_macro_regime.py) implementiert und trainiert.
  * [x] **Modell-Export & Node.js Runtime:** Modell erfolgreich exportiert nach `data/ml/models/macro_regime/macro_regime_model.json`.
  * [x] **Inferenz-Service:** [`src/services/MacroMlService.js`](file:///D:/GitHub/CrashRadar/src/services/MacroMlService.js) zur latenzfreien Baumausführung in reinem JS entwickelt und unit-getestet.
  * [x] **Indikator- & Notification-Integration:** [`src/analysis/indicators/MlRegimeRadarMacroIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarMacroIndicator.js) angebunden, in [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js) und [`NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js) für Daily Push & Alarme integriert.
  * [ ] **TradeSetupEngine-Veto & Kelly-Sizing [OFFEN]:** Anbindung an `src/analysis/TradeSetupEngine.js` zur automatischen Skalierung (`action.scaleDown`) bei Makro-Risiko $> 70\,\%$.
