# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.

## 2. Erkenntnisse & Unterscheidungsmerkmale: Gold & Liquidationswellen
* **Margin-Call-Sog (SPY Crash vs. Gold):**
  * Bei plötzlichen Aktienmarkt-Crashes (SPY) gerät physisches Gold durch erzwungene Liquidationswellen (Margin Calls) oft mehrfach unter Druck. Ein erstes lokales Tief ist in solchen Phasen historisch selten der finale Boden.
* **2-Step-Indikator-Logik (`GoldCapitulationIndicator`):**
  * Erkennt erst ein `TRAUMA` (Margin-Call-Auswaschung) und wartet auf eine nachhaltige Bodenbestätigung via Ausbruch über den 20-Tage-SMA (`HEALING`), um nicht in fallende Messer zu greifen.
* **Erkennungsmerkmale des FINALEN Ausverkaufs (Beispiel 2022 Backtest) & Code-Status:**
  1. **Miner-Volumen-Kapitulation (`GDX Selling Climax`):** Im Gegensatz zu unbedeutenden Zwischentiefs schnellt das Handelsvolumen bei GDX am echten Tiefpunkt extrem in die Höhe ($\ge 2\times$ bis $3\times$ des 50-Tage-Schnitts).
     * **Code-Status:** **Vollständig implementiert** in [GdxSellingClimaxIndicator.js](file:///workspaces/CrashRadar/src/analysis/indicators/GdxSellingClimaxIndicator.js).
  2. **Bullische Minen-Divergenz:** Bei einem erneuten Retest der Tiefs macht GDX keine neuen Tiefpunkte mehr, sondern notiert bereits höher ($\implies$ Smart Money sammelt Minen auf).
     * **Code-Status:** **Teilweise / Offen.** [GdxGoldDivergenceIndicator.js](file:///workspaces/CrashRadar/src/analysis/indicators/GdxGoldDivergenceIndicator.js) deckt bisher nur bearische Tops ab; bullische Boden-Divergenz fehlt noch als Indikator.
  3. **DXY-Parabel-Climax:** Der finale Boden bei Gold fällt historisch mit der parabelartigen Erschöpfung des US-Dollar-Indexes (DXY) zusammen.
     * **Code-Status:** **Teilweise / Offen.** DXY ist in `MacroRegimeEngine` integriert, aber ein isolierter `DxyParabolicClimaxIndicator` als direkter Trigger für Gold-Böden fehlt noch.

## 3. Nächster Schritt / Fahrplan: Gold Bottom & Tranchen-Skalierung
* **Aufgabe 1:** Erweitern von [GdxGoldDivergenceIndicator.js](file:///workspaces/CrashRadar/src/analysis/indicators/GdxGoldDivergenceIndicator.js) um bullische Boden-Divergenz (GDX macht höhere Tiefs, während Gold neue Tiefs testet $\implies$ `CRITICAL` / `BOTTOM_FINDER`).
* **Aufgabe 2:** Erstellen von `src/analysis/indicators/DxyParabolicClimaxIndicator.js` (Triggert bei DXY 20-Tage ROC $\ge +3.0\%$ & Erschöpfung als `MACRO_TURNING_POINT` für Gold).
* **Aufgabe 3:** Tranchen-Skalierung in [TradeSetupEngine.js](file:///workspaces/CrashRadar/src/analysis/TradeSetupEngine.js) einbauen:
  * *Tranche 1 (33%):* Einzel-Signal (`HEALING` oder `GDX Selling Climax`).
  * *Tranche 2 (66%):* Doppel-Signal (`HEALING` + `GDX Bullische Divergenz`).
  * *Tranche 3 (100% Full Buy):* Triple-Signal (`HEALING` + `GDX Bullische Divergenz` + `DXY Parabolic Climax`).
