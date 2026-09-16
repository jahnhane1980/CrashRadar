# CrashRadar Empirical Research & Theses Proofs

Dieses Verzeichnis bündelt alle empirischen Forschungsarbeiten, historischen Thesen-Beweise, Stresstests und Validierungs-Skripte des CrashRadar-Systems.

---

## 🏛️ Architektur- & Rollen-Abgrenzung

Im CrashRadar-Projekt gilt eine strikte 3-Ebenen-Trennung für Test- und Rechencode:

1. **[`tests/`](../tests/) – Vitest TDD Test-Suite**
   * **Zweck:** Reine Unit-, Integrations- und Regressions-Tests für den produktiven Code in `src/`.
   * **Charakter:** Schnell, deterministisch, vollautomatisch via `npm test` oder CI/CD. Keine explorativen Marktdaten-Backtests.

2. **[`simulations/`](../simulations/) – Portfolio Master-Engines**
   * **Zweck:** Vollwertige, reproduzierbare 21-Jahre-Simulationen des Gesamtsystems (z. B. SevenSlotGuru, MuzzledCathieWood, GoldSpy).
   * **Charakter:** Multi-Dekaden-Backtests, PnL-Tracking, Rebalancing-Zyklen und Orchestrierung für das produktive Portfolio.

3. **[`research/`](./) – Empirische Forschung & Thesen-Beweise**
   * **Zweck:** Validierung theoretischer Marktmodelle, Chaos- und Rausch-Engineering, ADR-Invarianten und Einzeltitel-Analysen.
   * **Charakter:** Datenintensive Skripte, die als empirischer Beleg für die Dokumentation in [`docs/architecture/`](../docs/architecture/) und [`docs/research/`](../docs/research/) dienen („Spiegel-Code“).

---

## 📂 Die 7 Säulen von `research/`

| Säule / Verzeichnis | Beschreibung & Zweck |
| :--- | :--- |
| **[`adr-assertions/`](./adr-assertions/)** | **ADR-Invarianten-Prüfungen:** Validiert die 12 architektonischen Kernentscheidungen des `DailyPortfolioCompass` (ADR-001 bis ADR-012) über historische Krisen. |
| **[`noise-and-audits/`](./noise-and-audits/)** | **Chaos- & Rausch-Engineering (Kapitel 5 AGENTS.md):** Monte-Carlo-Noise-Tests, M5-Slippage- und Execution-Audits sowie Crash-Typ-Klassifikatoren zur Vermeidung von Overfitting. |
| **[`macro-proofs/`](./macro-proofs/)** | **Empirische Makro-Thesen:** Backtests zu Margin Debt Tops, Zinskurven-Inversionen, Liquiditätskollisionen und Geopolitik-Öl-Schocks. |
| **[`turnaround-studies/`](./turnaround-studies/)** | **Zyklen- & Einzeltitel-Studien:** Hardware- vs. Software-Capex-Zyklen, Monopol-Filter (z. B. PLTR, NOW, NVDA, SOFI) und Dip-Buying-Thesen. |
| **[`strategy-prototypes/`](./strategy-prototypes/)** | **Strategie- & Tranchen-Experimente:** Prototypen für Gold-SPY-Splits, Katastrophen-Filter, Tranchenmodelle und Kamikaze-Pipeline-Entwürfe. |
| **[`ml-lab/`](./ml-lab/)** | **Machine Learning & Regime-Modelle:** Python/JS-Skripte für LSTM-Netze, Feature-Extraktion und Regime-Klassifikation. |
| **[`dalio-cycles/`](./dalio-cycles/)** | **Ray Dalio Big Debt Crises:** Empirische Prüfung des Dalio 3-of-4 Makro-Zyklus-Systems über historische Schuldenkrisen. |

---

## ⚙️ Ausführung & Datenbasis

Alle Skripte in `research/` greifen standardmäßig auf den zentralen Cache unter [`data/cache/`](../data/cache/) oder die konfigurierte Datenbank zu:
```bash
# Beispiel: Ausführung eines Makro-Thesen-Beweises
node research/macro-proofs/Margin-Debt-Top.js

# Beispiel: Ausführung eines Rausch-Resilienz-Audits
node research/noise-and-audits/Noise-Test-IndicatorEngine.js

# Beispiel: Ausführung eines ADR-Invarianten-Checks
node research/adr-assertions/test_adr001_airbag.js
```
