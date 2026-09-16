# Architektur-Review & Code-vs-Theorie Audit (2026)

## 📌 Übersicht & Zielsetzung
Dieser Audit-Report dokumentiert den Abgleich zwischen der theoretischen Makro-Forschung ([`docs/research/macro-proofs/Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/Analyse.md)) und der tatsächlichen modularen Implementierung in den CrashRadar-Engines (`src/analysis/`, `src/signals/`, `src/strategies/`). Er dient als operative Referenz für Architektur-Entscheidungen und Refactoring-Roadmaps.

---

## 🏛️ 1. Abgleich: Theorie vs. Signal-Architektur (`src/signals/`)

| Theoretische Anforderung (Research) | Implementierte Komponente | Status & Architektonischer Befund |
| :--- | :--- | :--- |
| **Geldmarkt- & TGA-Liquidität (TTC-Zeitfenster)** | [`LiquiditySensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/LiquiditySensorHub.js) | `IMPLEMENTED` 🟢 Dynamische Zusammenführung von Net Liquidity, RRP-Puffer und TGA-Drain. |
| **Inflations-, Öl- & Realzins-Stagflation** | [`GoldilocksSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/GoldilocksSensorHub.js) | `IMPLEMENTED` 🟢 4-Szenarien-Klassifizierung (`GOLDILOCKS`, `STAGFLATION_PRESSURE`, etc.). |
| **Derivate- & OpEx-Squeeze Coils** | [`DerivativesSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/DerivativesSensorHub.js) | `IMPLEMENTED` 🟢 CBOE Put-Call-Ratio, Dark-Pool-DIX, Short-Volume & Vol-Crush Timing. |
| **Krypto-Zyklus & MSTR-Lead-Dynamik** | [`CryptoSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js) | `IMPLEMENTED` 🟢 MSTR-Lead-Vorlauf ([`MstrLeadSensor.js`](file:///D:/GitHub/CrashRadar/src/signals/sensors/MstrLeadSensor.js)) & BTC-Trendfolge. |
| **Akuter Makro-Stress & Liquidationen** | [`MacroStressSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/MacroStressSensorHub.js) | `IMPLEMENTED` 🟢 VIX-Regime, High-Yield Credit Spreads & Panik-Kaskaden. |
| **Boden-Erkennung & Panik-Kapitulation** | [`MarketBottomSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/MarketBottomSensorHub.js) | `IMPLEMENTED` 🟢 VIX-Spike-Rebounds, Selling-Climax & Smart-Dumb-Money Divergenzen. |

---

## 🚨 2. Refactoring-Fahrplan & Offene Punkte

### A. Dynamic Exposure / Position Sizing (Kelly Criterion)
* **Soll-Konzept (Theorie):** Die Forschung fordert eine stufenlose Skalierung der Depot-Quote ($100\,\% \rightarrow 40\,\% \rightarrow 10\,\% \rightarrow 0\,\%$) basierend auf kumulativen Makro-Vetos anstelle von rein binären Cash-Switches.
* **Ist-Status in Code:** In [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js) ist die Makro-Konfluenz etabliert; dynamische Tranchensysteme werden in Strategien wie [`KamikazeGrowthStrategy.js`](file:///D:/GitHub/CrashRadar/src/strategies/KamikazeGrowthStrategy.js) & [`SatelliteStrategy.js`](file:///D:/GitHub/CrashRadar/src/strategies/SatelliteStrategy.js) umgesetzt.
* **Aktion:** Erweiterung des standardisierten `PortfolioStrategyInterface` um eine optionale `getRecommendedLeverage(macroContext)` Methode.

### B. Notfall-Geldmarkt-Airbag & Dip-Buying Dual Gatekeeper
* **Soll-Konzept:** Entkopplung von prozyklischem Dip-Buying (ADR-004) und antizyklischem Re-Entry nach Liquiditäts-Crashes (ADR-011).
* **Ist-Status in Code:** In [`DailyPortfolioCompass.js`](file:///D:/GitHub/CrashRadar/src/analysis/DailyPortfolioCompass.js) vollständig verankert. 

---

## 🛠️ 3. Zusammenfassung der Audit-Verifizierungen

* **Säule 1 (Architektur):** 29/29 Spezifikationen intakt und link-valide.
* **Säule 2 (Research & Methodology Audits):** Alle 5 Audits inkl. [`Makrowetter-Audit.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/Makrowetter-Audit.md), [`Noise-Test-IndicatorEngine.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/Noise-Test-IndicatorEngine.md), [`ScenarioChecklist-Audit.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/ScenarioChecklist-Audit.md) & [`Signal-vs-Execution-Hypothese.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/Signal-vs-Execution-Hypothese.md) sind 100 % link-valide.
