# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. FINRA Short-Volume: Ursachenforschung & Feature-Erweiterung (Nächster Fokus)
* **Problem:** Extreme FINRA-Leerverkaufsdaten wirken sich je nach Aktie massiv unterschiedlich aus (z.B. bei ZETA als Kontra-Indikator, bei NVTS als Volatilitäts-Verstärker). Die detaillierten empirischen Erkenntnisse dazu liegen in der `docs/ML_EVALUATIONS.md`.
* **Ziel:** Das neuronale Netz soll künftig selbstständig interpretieren können, *warum* extrem hohes Short-Volume bei einer Aktie ein Kaufsignal, bei einer anderen aber ein Risiko darstellt.
* **Aufgaben / Status:**
  * **Forschung [OFFEN]:** Analysieren, woher die Divergenz in der FINRA-Wirkung stammt (z.B. Free-Float-Anteil, Institutionelle Quote, ausstehende Wandelanleihen, fundamentale Bewertung).
  * **Code-Anpassung [OFFEN]:** Die final identifizierten Short-Volume-Metriken als mathematische "Features" in die neuen Ticker-spezifischen Builder einbauen.
  * **Retraining [OFFEN]:** Modelle mit den neuen Features neu anlernen, um die Vorhersage-Konfidenz signifikant zu steigern.
