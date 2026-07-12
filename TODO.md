# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. FINRA Short-Volume: Ursachenforschung & Feature-Erweiterung
* **Problem:** Extreme FINRA-Leerverkaufsdaten wirken sich je nach Aktie massiv unterschiedlich aus. Die detaillierten empirischen Erkenntnisse dazu liegen in der `docs/ML_EVALUATIONS.md`.
* **Beweisführung (Abgeschlossen - Juli 2026):** Ein historischer Backtest des Bärenmarktes 2021/2022 hat bewiesen, dass dieses Verhalten strukturell ist und nicht am Bull-Run lag:
  * **ZETA:** 46 Extrem-Signale (>65% Short Vol). Win-Rate nach 5 Tagen: 67,4% (Squeeze-Kontra-Indikator).
  * **NVTS:** 71 Extrem-Signale. Win-Rate brach völlig ein auf 36,6% nach 20 Tagen (Todesspirale / Volatilitätsverstärker).
  * **SOFI:** Nur 2 Extrem-Signale im gesamten Bärenmarkt (Struktur verhinderte konzertiertes Shorting).
* **Ziel:** Das neuronale Netz soll künftig selbstständig interpretieren können, *warum* extrem hohes Short-Volume bei einer Aktie ein Kaufsignal, bei einer anderen aber ein Risiko darstellt.
* **Aufgaben / Status:**
  * **Forschung [ERLEDIGT]:** Eine Korrelationsanalyse hat zwei Kausalitäts-Metriken isoliert, die den ML-Bias (NVTS vs. ZETA) erklären: 
    1) Die "Illiquiditäts-Falle" (Institutionelle Quote >80% = Squeeze)
    2) Die "Verwässerungs-Spirale" (Dilution/ATM Offerings = Crash).
  * **Phase 1: Daten-Fundament [ERLEDIGT]:** Historische 2021-2022 FINRA-Daten (aus CSV) wurden in die TiDB-Datenbank importiert. Tägliche Updates erfolgen bereits automatisch via `Database-Fetcher-Config.json`.
  * **Phase 2: Feature-Builder anpassen [OFFEN]:** 
    * *Dateien:* Entweder `src/ml/features/DefaultFeatureBuilder.js` anpassen oder dedizierte Klassen wie `src/ml/features/ZetaFeatureBuilder.js` erstellen (Der `MLPipelineRunner` lädt diese dynamisch, falls vorhanden).
    * *Aktion:* Das Feature `Short_Volume_Ratio` zur Eingangsmatrix hinzufügen. Die Daten dafür stammen aus der bereits verknüpften TiDB-Tabelle `market_data_short_volume`. Schwächere oder redundante Volumen-Z-Scores können dafür entfernt werden.
  * **Phase 3: Das Retraining (Modell-Update) [OFFEN]:** 
    * *Aktion:* Das zentrale ML-CLI-Skript (`node ml.js -t <Ticker> -s all`) für SOFI, ZETA, NVTS und PLTR ausführen.
    * *Ziel:* Der `MLPipelineRunner` extrahiert die neuen FINRA-Daten über die angepassten Feature-Builder aus der DB, trainiert die LSTMs auf die neue Preis-Volumen-Mechanik und überschreibt die alten Modell-Gewichte in `models/`.
  * **Phase 4: Pipeline-Integration & Wachhund [OFFEN]:** 
    * *Neu anzulegen:* `src/analysis/indicators/MlRegimeRadarStockIndicator.js` (Generischer Indikator, dem man im Konstruktor den Ticker übergibt). Zudem eine neue Config-Datei `config/Fundamental-Veto-Config.json` anlegen, in der die Bilanzen (Institutional Quote, Dilution Risk) für die Ticker hinterlegt werden.
    * *Anzupassen:* `src/analysis/TradeSetupEngine.js` (Den neuen Indikator für jeden Ticker dem `this.indicators`-Array hinzufügen).
    * *Wachhund-Logik (Change of Character):* In der `TradeSetupEngine` (oder direkt im Indikator) muss eine Veto-Weiche gebaut werden. Das Skript liest die `Fundamental-Veto-Config.json`.
      * *Regel:* Sagt das LSTM z.B. einen "ZETA Squeeze" vorher, der Wachhund sieht aber in der Config, dass die Inst. Quote massiv gecrasht ist (z.B. <50%) -> **BLOCKIERE** das Signal (Signal veraltet durch Bilanz-Strukturbruch). Gleiches gilt für plötzliche massive Verwässerung (`Dilution_Risk == HIGH`).
