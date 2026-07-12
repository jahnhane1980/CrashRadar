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
  * **Code-Anpassung [OFFEN]:** SEC-Daten (Institutional Ownership Ratio) und ein Flag (Dilution Risk) als neue Features in die Ticker-Builder einbauen.
  * **Retraining [OFFEN]:** Modelle mit diesen neuen Kausalitäts-Features neu anlernen, um die Vorhersage-Konfidenz signifikant zu steigern.
