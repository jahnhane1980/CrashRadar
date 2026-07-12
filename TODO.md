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
  * **Phase 2: Feature-Builder anpassen [OFFEN]:** In den jeweiligen `<Ticker>FeatureBuilder`-Skripten (z.B. für SOFI, ZETA, NVTS) das neue Eingabe-Feature `Short_Volume_Ratio` hinzufügen (ggf. schwächere Volumen-Metriken ersetzen), damit das Modell dieses beim Training sieht.
  * **Phase 3: Das Retraining (Modell-Update) [OFFEN]:** ML-Trainings-Skript für die Ticker starten. Die LSTMs lesen die neuen FINRA-Daten aus der DB, lernen die Mechanik (ohne Bilanzen, rein über Preis + Short-Volume) und speichern die neuen Gewichte ab.
  * **Phase 4: Pipeline-Integration & Wachhund [OFFEN]:** Einen generischen `MlRegimeRadarStockIndicator.js` erstellen und in die `src/analysis/TradeSetupEngine.js` einhängen. Dort die SEC-Bilanzen (Institutional Ownership, Dilution Risk) als **Veto-Prüfung** (Schutzschild) verankern, um Concept Drift abzuwehren.
