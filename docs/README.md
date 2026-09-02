# CrashRadar Dokumentations-Index & Wissens-Architektur

Willkommen im Dokumentations-Verzeichnis von **`CrashRadar`**.  
Die Dokumentation ist strikt nach **Separation of Concerns** in zwei Hauptbereiche unterteilt:
1. **`architecture/` (System Architecture & Specifications):** Technische Bauanleitungen, Datenpipelines, Schemas, State Machines und Trading-Regeln (Das technische **WIE**).
2. **`research/` (Empirical Research & Proofs):** Wissenschaftliche Auswertungen, historische 21-Jahre-Krisentests, Backtests und Labor-Tagebücher (Der empirische **BEWEIS**).

---

```mermaid
flowchart TD
    Index["📚 CrashRadar Docs"]
    
    Index --> Arch["📐 1. ARCHITECTURE (Das 'WIE')"]
    Index --> Res["🔬 2. RESEARCH (Das 'WARUM')"]
    
    Arch --> A1["🎯 single-asset-radar/<br>(M5 Ingestion & Radar-Master)"]
    Arch --> A2["🏛️ macro/<br>(Treasury Capacity & Kalender)"]
    Arch --> A3["⚙️ trading-engine/<br>(Portfolio State Machine)"]
    Arch --> A4["🧠 ml/<br>(Strategy Pipeline Blueprint)"]
    Arch --> A5["🌐 api/ & data/<br>(Provider-Schnittstellen)"]
    
    Res --> R1["📊 macro-proofs/<br>(21-Jahre-Test & Korrelationen)"]
    Res --> R2["📜 dalio-cycles/<br>(Schuldenkrisen & 3-von-4-Regel)"]
    Res --> R3["🧪 ml-lab/<br>(Trainings-Logs & Fat Tails)"]
    Res --> R4["🔬 methodology-audits/<br>(Noise-Tests & Slippage)"]
```

---

## 📐 1. System Architecture & Specifications (`docs/architecture/`)

Hier finden Entwickler und System-Architekten alle operativen Spezifikationen, Endpunkte, Datenbank-Strukturen und Regelwerke:

### A. 🎯 Single-Asset Radar (`docs/architecture/single-asset-radar/`)
* 📄 **[`Single-Asset-Radar-Architecture.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/Single-Asset-Radar-Architecture.md):**  
  *Master-Architektur des Single-Asset Radars, 3-Schichten-Modell (Ingestion, Analytics, Delivery), 17:15 & 22:15 Uhr Workflows und Ntfy-Smartphone-Alerting.*
* 📄 **[`M5Candels.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/M5Candels.md):**  
  *Spezifikation der Polygon.io REST-API, 50.000 Kerzen Paginierung, Pacing, Rate-Limit Schutz und MySQL-Schema `market_data_m5`.*
* 📄 **[`SingleAssetTrading.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/SingleAssetTrading.md):**  
  *Quantitatives Regelwerk: 4-Phasen-Katapult-Engine für Growth-Aktien (NVTS, PLTR, IBRX) und duales MACD-Regime für Sektor-ETFs (IGV, CIBR).*

### B. 🏛️ Makro-Systeme & Liquidität (`docs/architecture/macro/`)
* 📄 **[`Treasury-Liquidity-Capacity-Architecture.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Treasury-Liquidity-Capacity-Architecture.md):**  
  *Architektur zur vorausschauenden Erfassung von Liquiditäts- und Absorptionsengpässen (Liquid Slack, LCLOR, TGA-Cushion, Kollisions-Timer).*
* 📄 **[`Fiscal-FED-Indicator.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Fiscal-FED-Indicator.md):**  
  *Fiskaldominanz vs. Fed-Bilanz, WRESBAL-Schwellenwerte und K-Faktor-Logik.*
* 📄 **[`Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md):**  
  *Vollständige DB-gestützte Architektur für Termine, Konsens-Schätzungen und 2-Stufen-Regeln (`Option A: Full DB`).*
* 📄 **[`Checkliste-Goldilocks-Szenarios.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Checkliste-Goldilocks-Szenarios.md):**  
  *Monatliche Event-Checkliste für anstehende Makro-Veröffentlichungen.*

### C. ⚙️ Trading & Execution Engine (`docs/architecture/trading-engine/`)
* 📄 **[`TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md):**  
  *Die 5 Portfolio-Zustände (State Machine), 50/50 Krypto- & Growth-Philosophie, Fractional-Kelly-Sizing und Re-Entry-System.*

### D. 🧠 Machine Learning Pipelines (`docs/architecture/ml/`)
* 📄 **[`ML_ARCHITECTURE.md`](file:///D:/GitHub/CrashRadar/docs/architecture/ml/ML_ARCHITECTURE.md):**  
  *Strategy-Pattern Pipeline Blueprint (`src/ml/`), dynamic FeatureBuilder und universelles TensorFlow-Training.*
* 📄 **[`Makro-ML.md`](file:///D:/GitHub/CrashRadar/docs/architecture/ml/Makro-ML.md):**  
  *Technisches Konzept für das multivariate Makro-ML-Regime-Modell (XGBoost, Purged Walk-Forward CV & JS-Inferenz).*

### E. 🌐 Externe Schnittstellen & Daten (`docs/architecture/api/` & `docs/architecture/data/`)
* 📄 **[`FRED-Api.md`](file:///D:/GitHub/CrashRadar/docs/architecture/api/Stlouisfed.md)** | **[`Fiscaldata.md`](file:///D:/GitHub/CrashRadar/docs/architecture/api/Fiscaldata.md)** | **[`Tiingo.md`](file:///D:/GitHub/CrashRadar/docs/architecture/api/Tiingo.md)** | **[`Binance.md`](file:///D:/GitHub/CrashRadar/docs/architecture/api/Binance.md)** | **[`Yahoo-Finance.md`](file:///D:/GitHub/CrashRadar/docs/architecture/api/Yahoo-Finance.md)**
* 📄 **[`DataStructure.md`](file:///D:/GitHub/CrashRadar/docs/architecture/data/DataStructure.md)**
* 📄 **[`Gold-GDX.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-GDX.md)**

---

## 🔬 2. Empirical Research & Proofs (`docs/research/`)

Hier liegen alle empirischen Auswertungen, historischen Krisen-Härtetests und mathematischen Beweise:

### A. 📊 Makro-Forschung & Krisen-Validierung (`docs/research/macro-proofs/`)
* 📄 **[`Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/Analyse.md):**  
  *Zentrale statistische Analyse: Net Liquidity Illusion, Yield Curve Steepening Trap, DXY Schwerkraft und CBOE/VIX/RSI Bottom-Finding.*
* 📄 **[`Indikatoren-Grand-Prix-21-Jahre-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/Indikatoren-Grand-Prix-21-Jahre-Analyse.md):**  
  *21-Jahre-Härtetest aller 18 Makro-Sensoren über 10 historische Großkrisen (2005–2026).*
* 📄 **[`Crash-Arbeitsmarkt-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/Crash-Arbeitsmarkt-Analyse.md):**  
  *Empirischer Beweis der Arbeitsmarkt-Divergenzen (Household vs. Payrolls) und Sahm-Regel Vorlauf.*

### B. 📜 Ray Dalio Schuldenkrisen-Zyklen (`docs/research/dalio-cycles/`)
* 📄 **[`These.md`](file:///D:/GitHub/CrashRadar/docs/research/dalio-cycles/These.md)** | **[`Daten_zur_These.md`](file:///D:/GitHub/CrashRadar/docs/research/dalio-cycles/Daten_zur_These.md)**
* 📄 **[`Backtest_3_von_4_Regel.md`](file:///D:/GitHub/CrashRadar/docs/research/dalio-cycles/Backtest_3_von_4_Regel.md)** | **[`Empirische_Auswertung_Dalio_These.md`](file:///D:/GitHub/CrashRadar/docs/research/dalio-cycles/Empirische_Auswertung_Dalio_These.md)**

### C. 🧪 ML-Labor & Feature-Forschung (`docs/research/ml-lab/`)
* 📄 **[`ML_EVALUATIONS.md`](file:///D:/GitHub/CrashRadar/docs/research/ml-lab/ML_EVALUATIONS.md):**  
  *Labor-Tagebuch: Trainingsläufe, BTC V2 Dow-Theorie, PLTR-Divergenzen und FINRA Short-Volume Bärenmarkt-Beweise.*
* 📄 **[`ML_FEATURE_RESEARCH.md`](file:///D:/GitHub/CrashRadar/docs/research/ml-lab/ML_FEATURE_RESEARCH.md):**  
  *Theoretische Forschung zu Fat Tails, Robust Scaling vs. Z-Score Verzerrung und Schwerkraft-Ankern (SMA200).*

### D. 🔬 Validierungs-Methodik & Audits (`docs/research/methodology-audits/`)
* 📄 **[`Noise-Test-IndicatorEngine.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/Noise-Test-IndicatorEngine.md):**  
  *Monte-Carlo White-Noise Test zur mathematischen Verifikation der Überanpassungs-Freiheit (Anti-Overfitting).*
* 📄 **[`Signal-vs-Execution-Hypothese.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/Signal-vs-Execution-Hypothese.md):**  
  *Fraktales Trading: Empirischer Beweis zur Vermeidung von Slippage durch Trennung von Tages-Signal und Intraday-Ausführung.*
* 📄 **[`Architecture-Audit.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/Architecture-Audit.md):**  
  *Code-vs-Theorie Audit Report.*
