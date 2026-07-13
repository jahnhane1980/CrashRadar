# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. FINRA Short-Volume: Ursachenforschung & Feature-Erweiterung
* **Problem:** Extreme FINRA-Leerverkaufsdaten wirken sich je nach Aktie massiv unterschiedlich aus. Die detaillierten empirischen Erkenntnisse dazu liegen in der `docs/ML_EVALUATIONS.md`.
* **Beweisführung (Abgeschlossen - Juli 2026):** Ein historischer Backtest des Bärenmarktes 2021/2022 hat bewiesen, dass dieses Verhalten strukturell ist und nicht am Bull-Run lag:
  * **ZETA:** 46 Extrem-Signale (>65% Short Vol). Win-Rate nach 5 Tagen: 67,4% (Squeeze-Kontra-Indikator).
  * **NVTS:** 71 Extrem-Signale. Win-Rate brach völlig ein auf 36,6% nach 20 Tagen (Todesspirale / Volatilitätsverstärker).
  * **SOFI:** Nur 2 Extrem-Signale im gesamten Bärenmarkt (Struktur verhinderte konzertiertes Shorting).
* **Ziel:** Das neuronale Netz soll künftig selbstständig interpretieren können, *warum* extrem hohes Short-Volume bei einer Aktie ein Kaufsignal, bei einer anderen aber ein Risiko darstellt.
  * **Phase 2.5: Zeitreihen-Architektur & Dynamisches Dilution Risk [ABGESCHLOSSEN]**
    * *Problem:* Aktuell ist `company_fundamentals` eine reine Snapshot-Tabelle. Dynamische Aktienrückkäufe (Buybacks) oder schleichende Verwässerung werden täglich überschrieben. Das Modell sieht keinen Trend.
    * *Aktion:* Umbau der Datenerfassung auf eine Time-Series (Historische Speicherung pro Quartal/Jahr). Die statische Spalte `dilution_risk` wird aus der Tabelle entfernt. Neben den `shares_outstanding` und `institutional_ownership` sollen dabei folgende erweiterte Kernmetriken fortlaufend in der Datenbank erfasst werden:
      - Revenue / Sales & Revenue Growth
      - Free Cash Flow (FCF)
      - Cash from Financing
      - Net Income
    * *Datenquelle:* Wir nutzen dafür nativ das `yahoo-finance2` Paket über den Befehl: `yahooFinance.fundamentalsTimeSeries('<TICKER>', { module: 'all' })`. Keine externen APIs nötig!
    * *Betroffene Code-Dateien:*
      1. `FinraFeatureBuilder.js`: Muss so umgeschrieben werden, dass er für das ML-Modell die Deltas (z.B. QoQ-Veränderung des FCF oder der Shares) zieht, statt statische Werte.
    * *Logik-Shift (Veto-Wachhund):* Die statische Spalte `dilution_risk` in der DB existiert nicht mehr. Der `MlRegimeRadarStockIndicator` (in der `TradeSetupEngine`) fragt künftig die Historien-Tabelle ab und berechnet das Dilution-Risk *on the fly* (`Aktuelle Shares / Shares vor 12 Monaten`). Dadurch erkennt der Code selbstständig toxische Emissionen vs. gesunde Buybacks.
  * **Phase 3: Das Retraining (Modell-Update) [OFFEN]:** 
    * *Aktion:* Das zentrale ML-CLI-Skript (`node ml.js -t <Ticker> -s all`) für SOFI, ZETA, NVTS und PLTR ausführen.
    * *Ziel:* Der `MLPipelineRunner` extrahiert die neuen FINRA-Daten über die angepassten Feature-Builder aus der DB, trainiert die LSTMs auf die neue Preis-Volumen-Mechanik und überschreibt die alten Modell-Gewichte in `models/`.
  * **Phase 3.5: Evaluation & A/B-Vergleich [OFFEN]:**
    * *Aktion:* Vergleichen der neuen Modell-Ergebnisse (Win-Rate, Profit-Faktor) mit den alten Backtest-Ergebnissen.
    * *Entscheidung:* Hat das Hinzufügen der FINRA/Fundamentaldaten wirklich eine signifikante Verbesserung der ML-Vorhersagen gebracht?
      * *Wenn ausreichend:* Weiter mit Phase 4 (Integration & Veto-Wachhund).
      * *Wenn unzureichend:* Stop! Das gesamte Feature-Konzept muss neu überdacht werden.
  * **Phase 4: Pipeline-Integration & Wachhund [OFFEN]:** 
    * *Neu anzulegen:* `src/analysis/indicators/MlRegimeRadarStockIndicator.js` (Generischer Indikator, dem man im Konstruktor den Ticker übergibt). Zudem eine neue Config-Datei `config/Fundamental-Veto-Config.json` anlegen, in der die Bilanzen (Institutional Quote, Dilution Risk) für die Ticker hinterlegt werden.
    * *Anzupassen:* `src/analysis/TradeSetupEngine.js` (Den neuen Indikator für jeden Ticker dem `this.indicators`-Array hinzufügen).
    * *Wachhund-Logik (Change of Character):* In der `TradeSetupEngine` (oder direkt im Indikator) muss eine Veto-Weiche gebaut werden. Das Skript liest die `Fundamental-Veto-Config.json`.
      * *Regel:* Sagt das LSTM z.B. einen "ZETA Squeeze" vorher, der Wachhund sieht aber in der Config, dass die Inst. Quote massiv gecrasht ist (z.B. <50%) -> **BLOCKIERE** das Signal (Signal veraltet durch Bilanz-Strukturbruch). Gleiches gilt für plötzliche massive Verwässerung (`Dilution_Risk == HIGH`).
