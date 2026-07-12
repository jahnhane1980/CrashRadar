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
  * **Forschung [OFFEN]:** Analysieren, woher die Divergenz in der FINRA-Wirkung stammt (z.B. Free-Float-Anteil, Institutionelle Quote, ausstehende Wandelanleihen, fundamentale Bewertung).
  * **Code-Anpassung [OFFEN]:** Die final identifizierten Short-Volume-Metriken als mathematische "Features" in die neuen Ticker-spezifischen Builder einbauen.
  * **Retraining [OFFEN]:** Modelle mit den neuen Features neu anlernen, um die Vorhersage-Konfidenz signifikant zu steigern.
