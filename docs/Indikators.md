# CrashRadar: Technische Indikatoren-Referenz (Code-Realität)

> **Zweck:** Dieses Dokument dient als exakte, ungefilterte technische Referenz für alle **34 Indikatoren**, die aktuell in der CrashRadar-Engine unter [`src/analysis/indicators/`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/) implementiert sind.  
> **Fokus:** Detaillierte Dokumentation der tatsächlichen Code-Logik: Gelesene Rohdaten-Keys aus der `timeline`, mathematische Formeln, Schwellenwerte und die exakten Bedingungen für `CRITICAL`-, `WARNING`-, `OK`- und `UNKNOWN`-Zustände.

---

## 📑 Inhaltsübersicht

1. [Zinsen, Liquidität & Makro-Frühwarnung (Leading)](#1-zinsen-liquidität--makro-frühwarnung-leading)
   * [YieldCurveIndicator](#11-yieldcurveindicator)
   * [BankReservesIndicator](#12-bankreservesindicator)
   * [TgaIndicator](#13-tgaindicator)
   * [FiscalFedLiquidityIndicator](#14-fiscalfedliquidityindicator)
   * [MaturityWallIndicator](#15-maturitywallindicator)
   * [NfciIndicator](#16-nfciindicator)
   * [InterestRateCycleIndicator](#17-interestratecycleindicator)
   * [LaborMarketDivergenceIndicator](#18-labormarketdivergenceindicator)
   * [ChallengerIndicator](#19-challengerindicator)
2. [Hebel, Sentiment & Top-Erkennung (Distribution / Smart vs. Dumb Money)](#2-hebel-sentiment--top-erkennung-distribution--smart-vs-dumb-money)
   * [MarginDebtIndicator](#21-margindebtindicator)
   * [SmartDumbMoneyTopIndicator](#22-smartdumbmoneytopindicator)
   * [StealthExitIndicator](#23-stealthexitindicator)
   * [RedAlertIndicator](#24-redalertindicator)
3. [Akute Panik & Boden-Finder (Trough / Capitulation)](#3-akute-panik--boden-finder-trough--capitulation)
   * [VixSpikeCrushIndicator](#31-vixspikecrushindicator)
   * [PanicCapitulationIndicator](#32-paniccapitulationindicator)
   * [SmartDumbMoneyBottomIndicator](#33-smartdumbmoneybottomindicator)
   * [GoldCapitulationIndicator](#34-goldcapitulationindicator)
   * [GoldVolumeClimaxIndicator](#35-goldvolumeclimaxindicator)
   * [GdxSellingClimaxIndicator](#36-gdxsellingclimaxindicator)
   * [GdxBuyingClimaxIndicator](#37-gdxbuyingclimaxindicator)
   * [GdxGoldDivergenceIndicator](#38-gdxgolddivergenceindicator)
   * [DxyParabolicClimaxIndicator](#39-dxyparabolicclimaxindicator)
4. [Krypto- & Tech-Radar (Zyklen & Divergenzen)](#4-krypto---tech-radar-zyklen--divergenzen)
   * [BitcoinDivergenceIndicator](#41-bitcoindivergenceindicator)
   * [BitcoinSellingClimaxIndicator](#42-bitcoinsellingclimaxindicator)
   * [CryptoCycleDivergenceIndicator](#43-cryptocycledivergenceindicator)
   * [CryptoPortfolioExitIndicator](#44-cryptoportfolioexitindicator)
   * [BtcTrailingStopIndicator](#45-btctrailingstopindicator)
   * [TechCycleRadarIndicator](#46-techcycleradarindicator)
5. [Mehrstufige & Machine-Learning Indikatoren](#5-mehrstufige--machine-learning-indikatoren)
   * [DalioTwoStageRegimeIndicator](#51-daliotwostageregimeindicator)
   * [MlRegimeRadarMacroIndicator](#52-mlregimeradarmacroindicator)
   * [MlRegimeRadarSpyIndicator](#53-mlregimeradarspyindicator)
   * [MlRegimeRadarQqqIndicator](#54-mlregimeradarqqqindicator)
   * [MlRegimeRadarBtcIndicator](#55-mlregimeradarbtcindicator)
   * [MlRegimeRadarCryptoIndicator](#56-mlregimeradarcryptoindicator)
6. [Historische Marktwendepunkte & Regime-Übergänge (2000–2026)](#6-historische-marktwendepunkte--regime-übergänge-20002026)

---

## 1. Zinsen, Liquidität & Makro-Frühwarnung (Leading)

### 1.1 YieldCurveIndicator
* **Datei:** [`src/analysis/indicators/YieldCurveIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/YieldCurveIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 30`
* **Gelesene Datenpunkte:**
  * `current`: `timeline[t].macroGroups.YieldCurve.Spread10y2y`
  * `past30`: `timeline[t-30].macroGroups.YieldCurve.Spread10y2y`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `past30 < 0 && current >= 0`  
    *Meldung:* `UN-INVERTING! Kurve ist in den letzten 30 Tagen positiv geworden. Startschuss für den Crash.`
  * 🟡 **WARNING:** `current < 0`  
    *Meldung:* `Invertiert (Late Cycle). Noch keine Panik, bis sie un-invertiert.`
  * 🟢 **OK:** `current >= 0 && past30 >= 0`  
    *Meldung:* `Normale Kurve (positiv).`
  * ⚪ **UNKNOWN:** Daten fehlen, sind leer (`""`) oder keine Zahlen (`NaN`).

---

### 1.2 BankReservesIndicator
* **Datei:** [`src/analysis/indicators/BankReservesIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BankReservesIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 1`
* **Gelesene Datenpunkte:**
  * `current`: `timeline[t].macroGroups.BankingHealth.TotalReserves` (in Mrd. USD)
* **Schwellenwerte:** `CRITICAL: 2800`, `WARNING: 3000`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `current < 2800`  
    *Meldung:* `Unter 2.8T Limit! Akute Crash-Warnung (Repo-Krise).`
  * 🟡 **WARNING:** `current < 3000`  
    *Meldung:* `Nähert sich der 2.8T Grenze.`
  * 🟢 **OK:** `current >= 3000`  
    *Meldung:* `Reserven im sicheren Bereich.`
  * ⚪ **UNKNOWN:** `current === null` oder `timeline.length < 1`.

---

### 1.3 TgaIndicator
* **Datei:** [`src/analysis/indicators/TgaIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TgaIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 30`
* **Gelesene Datenpunkte:**
  * `currentTGA`: `timeline[t].macroGroups.NetLiquidity.TGA`
  * `pastTGA`: `timeline[t-30].macroGroups.NetLiquidity.TGA`
* **Berechnung:** `diff = currentTGA - pastTGA` (30-Tage Delta in Mrd. USD)
* **Schwellenwert:** `TGA_DIFF: 100`
* **Schalt- und Trigger-Logik:**
  * 🟡 **WARNING:** `diff > +100`  
    *Meldung:* `Starker Anstieg (+<diff>B in 30d). Entzieht Liquidität.`
  * 🟢 **OK (Kaufsignal/Stimulus):** `diff < -100`  
    *Meldung:* `Rasanter Fall (<diff>B in 30d). Stealth-Stimulus / Kaufsignal.`
  * 🟢 **OK (Neutral):** `-100 <= diff <= +100`  
    *Meldung:* `Neutrale Seitwärtsbewegung.`
  * ⚪ **UNKNOWN:** Daten fehlen oder sind ungültig.

---

### 1.4 FiscalFedLiquidityIndicator
* **Datei:** [`src/analysis/indicators/FiscalFedLiquidityIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/FiscalFedLiquidityIndicator.js)
* **Kategorie:** `MACRO_CONTEXT` (4-Phasen Plumbing Modell)
* **Mindestdaten:** `timeline.length >= 90`
* **Gelesene Datenpunkte (Deltas über Zeitfenster):**
  * `tga.delta`: 90-Tage Delta von `macroGroups.NetLiquidity.TGA`
  * `wresbal.delta`: 56-Tage Delta von `macroGroups.BankingHealth.BankReserves`
  * `rrp.delta`: 30-Tage Delta von `macroGroups.NetLiquidity.RRPONTSYD`
  * `walcl.delta`: 14-Tage Delta von `macroGroups.NetLiquidity.WALCL`
  * `borrow.delta`: 28-Tage Delta von `macroGroups.BankingHealth.EmergencyBorrowing`
  * *Panik-Gedächtnis:* `hadRecentPanic = true`, falls in den letzten 60 Tagen `EmergencyBorrowing.delta > 15.000` (+15 Mrd.) lag.
* **Schalt- und Trigger-Logik (Top-Down Priorität):**
  * 🟢 **NORMAL (Phase 4 - Rettung / Boden):**
    * Wenn `walcl.delta > 50.000` $\rightarrow$ `Phase 4: WALCL +<val>B (Stealth QE)`
    * Wenn `wresbal.delta > 150.000` $\rightarrow$ `Phase 4: WRESBAL +<val>B (Wunder-Pille)`
    * Wenn `wresbal.delta > 50.000 && hadRecentPanic` $\rightarrow$ `Phase 4: WRESBAL +<val>B (Boden nach Panik)`
  * 🔴 **CRITICAL (Phase 3 - Kapitulation):**
    * Wenn `borrow.delta > 15.000` $\rightarrow$ `Phase 3: BORROW +<val>B (Kernschmelze)`
  * 🟡 **WARNING (Phase 2 - Crash / Drain):**
    * Wenn `rrp.delta > 100.000` $\rightarrow$ `Phase 2: RRP +<val>B (Liquiditäts-Drain)`
  * 🟡 **WARNING (Phase 1 - Warnung):**
    * Wenn `tga.delta > 150.000` $\rightarrow$ `Phase 1: TGA +<val>B (Staubsauger)`
    * Wenn `wresbal.delta < -100.000` $\rightarrow$ `Phase 1: WRESBAL <val>B (Liquiditätsentzug)`
  * 🟢 **NORMAL:** Keine Schwellen überschritten $\rightarrow$ `Liquidity OK.`

---

### 1.5 MaturityWallIndicator
* **Datei:** [`src/analysis/indicators/MaturityWallIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MaturityWallIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 1`
* **Gelesene Datenpunkte:**
  * `current`: `timeline[t].macroGroups.Leading.MaturityWallPct` (Refinanzierungslast in % der Geldmenge M2)
* **Schwellenwerte:** `CRITICAL: 21%`, `WARNING: 15%`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `current > 21.0%`  
    *Meldung:* `Roter Alarm! Extreme Refinancing Cliff (>21%).`
  * 🟡 **WARNING:** `current > 15.0%`  
    *Meldung:* `Warn-Zone. System beginnt zu ächzen (>15%).`
  * 🟢 **OK:** `current <= 15.0%`  
    *Meldung:* `Normale Baseline (<10-15%).`

---

### 1.6 NfciIndicator
* **Datei:** [`src/analysis/indicators/NfciIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/NfciIndicator.js)
* **Kategorie:** `ACUTE_PANIC`
* **Mindestdaten:** `timeline.length >= 1`
* **Gelesene Datenpunkte:**
  * `current`: `timeline[t].macroGroups.FinancialConditions.ChicagoFedIndex`
* **Schwellenwert:** `CRITICAL: 0.0`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `current > 0.0`  
    *Meldung:* `Akuter Stress im Finanzsystem (>0).`
  * 🟢 **OK:** `current <= 0.0`  
    *Meldung:* `Kein Systemstress (<=0).`

---

### 1.7 InterestRateCycleIndicator
* **Datei:** [`src/analysis/indicators/InterestRateCycleIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/InterestRateCycleIndicator.js)
* **Kategorie:** `MACRO_CONTEXT`
* **Mindestdaten:** `timeline.length >= 180` (180 Tage Rollierendes Speicherfenster)
* **Gelesene Datenpunkte & Bedingungen:**
  1. `RateShock` (60d Lookback): $10\text{Y Real Yield}_{t} - 10\text{Y Real Yield}_{t-60} \ge +0.50\%$
  2. `ARCC` (90d Lookback): $\text{ARCC Interest Expense}_{t} \ge +15.0\%$ Steigerung vs. $t-90$
  3. `PolicyError` (60d Lookback): $\text{FedFunds}_{t} - \text{FedFunds}_{t-60} < -0.25\%$ **und** $\text{Breakeven Inflation}_{t} - \text{Breakeven Inflation}_{t-60} > +0.10\%$
* **Schalt- und Trigger-Logik (Score 0 bis 3):**
  * 🔴 **CRITICAL (Score 3/3):** Alle 3 Bedingungen aktiv  
    *Meldung:* `CODE RED Zins-Zyklus! (RateShock + ARCC + PolicyError)`
  * 🟡 **WARNING (Score 2/3):** 2 Bedingungen aktiv  
    *Meldung:* `Eskalierender Zins-Zyklus (<Triggers>)`
  * 🟡 **EARLY_WARNING (Score 1/3):** 1 Bedingung aktiv  
    *Meldung:* `Erste Anzeichen von Zins-Stress (<Trigger>)`
  * 🟢 **OK (Score 0/3):** Keine Bedingung aktiv  
    *Meldung:* `Kein makroökonomischer Zins-Stress detektiert.`

---

### 1.8 LaborMarketDivergenceIndicator
* **Datei:** [`src/analysis/indicators/LaborMarketDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/LaborMarketDivergenceIndicator.js)
* **Kategorie:** Multi-Signal Indicator (`EARLY_WARNING` & `ACUTE_PANIC`)
* **Mindestdaten:** Mindestens 13 gemeinsame monatliche Datenpunkte
* **Gelesene Datenpunkte (`macroGroups.LaborMarket`):**
  * `PAYEMS` (Nonfarm Payrolls)
  * `CE16OV` (Household Employment)
  * `LNS12500000` (Full-Time Employment)
  * `LNS12600000` (Part-Time Employment)
  * `LNS12026619` (Multiple Jobholders)
* **Berechnungen & Triggers:**
  * **Signal 1: Qualitative Arbeitsmarkt-Schere (Frühindikator 6–18 Monate):**  
    Verhältnis $\frac{\text{Vollzeit}}{\text{Teilzeit}}$ fällt um $\le -2.5\%$ unter das Maximum der vorherigen 12 Monate.
  * **Signal 2: Quantitative Arbeitsmarkt-Schere (Akutindikator 0–3 Monate):**  
    3-Monats-Delta $\Delta \text{PAYEMS} > 0$ **und** $\Delta \text{CE16OV} < 0$.
* **Status-Rückgabe:**
  * 🔴 **COINCIDENT_ALERT:** Signal 2 ausgelöst
  * 🟡 **LEADING_WARNING:** Signal 1 ausgelöst
  * 🟢 **NEUTRAL:** Keine Arbeitsmarkt-Divergenz aktiv

---

### 1.9 ChallengerIndicator
* **Datei:** [`src/analysis/indicators/ChallengerIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/ChallengerIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 180` (min. 6 Vormonate für SMA6)
* **Gelesene Datenpunkte:**
  * `InitialClaims ?? Challenger` aus `macroGroups.Contemporaneous` bzw. `macroGroups.Leading`
* **Berechnung:** `changePct = ((current - sma6) / sma6) * 100` (Veränderung vs. 6-Monats-Schnitt)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `changePct >= +55.0%`  
    *Meldung:* `Challenger Report explodiert um +<changePct>% vs. SMA6! Alarmstufe Rot: Deflationärer/Wirtschaftlicher Crash unmittelbar bevorstehend.`
  * 🟡 **WARNING:** `changePct >= +40.0%`  
    *Meldung:* `Challenger Report steigt stark an (+<changePct>% vs. SMA6). Warnstufe Gelb: Deutlicher Stress in den Chefetagen.`
  * 🟢 **OK:** `changePct < +40.0%`  
    *Meldung:* `Keine auffälligen Entlassungswellen (Markt intakt oder rein zinssensitiv).`

---

## 2. Hebel, Sentiment & Top-Erkennung (Distribution / Smart vs. Dumb Money)

### 2.1 MarginDebtIndicator
* **Datei:** [`src/analysis/indicators/MarginDebtIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MarginDebtIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 180`
* **Gelesene Datenpunkte:**
  * `macroGroups.Leading.MarginDebt` (FINRA Wertpapierkredite)
* **Berechnung:** `drawdownPct = MathUtils.getDrawdownFromMax(..., 180)` (Rückgang vom 180-Tage Allzeithoch)
* **Schalt- und Trigger-Logik:**
  * 🟡 **WARNING (Starker Hebel-Abbau):** `drawdownPct <= -5.0%`  
    *Meldung:* `Margin Debt ist um <pct>% von seinem Hoch gefallen. Das Smart Money baut rasant Hebel ab!`
  * 🟡 **WARNING (Erste Risse):** `drawdownPct <= -2.0%`  
    *Meldung:* `Margin Debt fällt (<pct>% vom Hoch). Erste Anzeichen ausgetrockneter Kreditlinien.`
  * 🟢 **OK:** `drawdownPct > -2.0%`  
    *Meldung:* `Hebel (Margin Debt) steigt / ist intakt.`

---

### 2.2 SmartDumbMoneyTopIndicator
* **Datei:** [`src/analysis/indicators/SmartDumbMoneyTopIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyTopIndicator.js)
* **Kategorie:** `ACUTE_PANIC`
* **Mindestdaten:** `timeline.length >= 1`
* **Gelesene Datenpunkte:**
  * `assets.SKEW` (CBOE SKEW Index)
  * `assets.AAII_Spread` (AAII Bull/Bear Spread in %)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `skew > 145 && aaiiSpread > 20`  
    *Meldung:* `CRASH-FENSTER OFFEN (Distribution Window)! Smart Money hedged massiv (SKEW > 145) während Retail extrem euphorisch ist (AAII > 20%). Tops bilden sich innerhalb von 1-8 Wochen.`
  * 🟢 **OK:** `skew <= 145 || aaiiSpread <= 20`  
    *Meldung:* `Kein Top-Setup aktiv.`

---

### 2.3 StealthExitIndicator
* **Datei:** [`src/analysis/indicators/StealthExitIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/StealthExitIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 30`
* **Gelesene Datenpunkte:**
  * `assets.DIX` (SqueezeMetrics Dark Index)
  * `assets.SPY` (30-Tage Drawdown vom Hoch)
* **Schwellenwerte:** `DIX_LOW: 40.0%`, `SPY_DRAWDOWN_MAX: -3.0%` (Markt nahe Allzeithoch)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `dix < 40.0 && spyDrawdown >= -3.0%`  
    *Meldung:* `STEALTH EXIT AKTIV! Wale verkaufen verdeckt über Dark Pools (DIX: <dix>% < 40%), während der SPY nahe Allzeithoch notiert (Drawdown: <spyDrawdown>%).`
  * 🟡 **WARNING:** `dix < 40.0 && spyDrawdown < -3.0%`  
    *Meldung:* `Niedrige Dark Pool Aktivität (DIX: <dix>%), aber Markt befindet sich bereits in einer Korrektur (Drawdown: <spyDrawdown>%).`
  * 🟢 **OK:** `dix >= 40.0`  
    *Meldung:* `Keine Stealth Exit Anzeichen.`

---

### 2.4 RedAlertIndicator
* **Datei:** [`src/analysis/indicators/RedAlertIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/RedAlertIndicator.js)
* **Kategorie:** `ACUTE_PANIC`
* **Mindestdaten:** `timeline.length >= 1`
* **Gelesene Datenpunkte:**
  * `assets.SKEW`, `assets.SPY_ShortVolumeRatio`, `assets.TotalPCR`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `skew > 145 && shortRatio < 0.45 && pcrVal < 0.75`  
    *Meldung:* `MAXIMALER ALARM! Institutionelle Panik-Absicherung (SKEW) trifft auf extreme Retail-Gier (Short-Capitulation & PCR < 0.75). Der Markt steht vor dem Crash.`
  * 🟡 **WARNING (Melt-Up Phase):** `skew > 145 && shortRatio < 0.45 && pcrVal >= 0.75`  
    *Meldung:* `Bären-Kapitulation + Smart-Money Hedging! ABER: Melt-Up Phase ist noch aktiv (PCR > 0.75). Weiterer Anstieg möglich, bis Euphorie komplettiert.`
  * 🟡 **WARNING (Spannung):** `skew > 140 && shortRatio < 0.50`  
    *Meldung:* `Spannung baut sich auf. Bären sterben langsam aus.`
  * 🟢 **OK:** Keine Bedingungen erfüllt $\rightarrow$ `Kein Crash-Setup aktiv.`

---

## 3. Akute Panik & Boden-Finder (Trough / Capitulation)

### 3.1 VixSpikeCrushIndicator
* **Datei:** [`src/analysis/indicators/VixSpikeCrushIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/VixSpikeCrushIndicator.js)
* **Kategorie:** `BOTTOM_FINDER`
* **Mindestdaten:** `timeline.length >= 30`
* **Gelesene Datenpunkte:**
  * `assets.VIX` (aktueller Wert vs. 30-Tage Maximum `maxVix30`)
* **Schwellenwerte:** `VIX_SPIKE: 40`, `VIX_WARNING: 35`, `VIX_CRUSH_PCT: 0.80`, `VIX_CRUSH_WARNING_PCT: 0.85`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (Kaufsignal):** `maxVix30 >= 40 && currentVix < maxVix30 * 0.80`  
    *Meldung:* `KAUFSIGNAL! VIX ist gespiket (>=40) und crasht jetzt (-20% vom Peak).`
  * 🟡 **WARNING (Bodenbildung):** `maxVix30 >= 35 && currentVix < maxVix30 * 0.85`  
    *Meldung:* `VIX baut Panik ab. Bodenbildung läuft.`
  * 🟡 **WARNING (Hohe Panik):** `maxVix30 >= 35`  
    *Meldung:* `Extreme Panik am Markt (VIX extrem hoch).`
  * 🟢 **OK:** `Keine Panik-Extreme. Normaler Markt.`

---

### 3.2 PanicCapitulationIndicator
* **Datei:** [`src/analysis/indicators/PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js)
* **Kategorie:** `BOTTOM_FINDER`
* **Mindestdaten:** `timeline.length >= 90`
* **Gelesene Datenpunkte:**
  * `assets.SPY`, `assets.VIX`, `assets.CBOE_SPY` (Optionsvolumen)
  * Berechneter 14-Tage RSI von SPY
  * 90-Tage Durchschnittsvolumen von CBOE SPY Options (`sma90Vol`)
  * Vorheriges 40-Tage Zwischentief von SPY (`prevLowPrice`) und zugehöriger RSI (`prevLowRsi`)
* **Bedingungen:**
  1. `VIX >= 35`
  2. `currentCboe >= sma90Vol * 1.5` (1,5-facher Options-Spike)
  3. `currentPrice <= prevLowPrice * 1.02` (Preis auf neuem Panik-Tief)
  4. `currentRsi > prevLowRsi + 2` (Bullische RSI-Divergenz)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (Generationen-Kaufsignal):** Alle 4 Bedingungen erfüllt  
    *Meldung:* `GENERATIONEN-KAUFSIGNAL! Extremer Panik-Climax bestätigt durch Bullish Divergence (RSI <current> > <prev>).`
  * 🟡 **WARNING:** Bedingungen 1 & 2 erfüllt (VIX >= 35 & CBOE Spike)  
    *Meldung:* `Massiver Panik-Spike im Optionsvolumen. Setup formiert sich.`
  * 🟢 **OK:** `Kein Panik-Climax aktiv.`

---

### 3.3 SmartDumbMoneyBottomIndicator
* **Datei:** [`src/analysis/indicators/SmartDumbMoneyBottomIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyBottomIndicator.js)
* **Kategorie:** `BOTTOM_FINDER`
* **Mindestdaten:** `timeline.length >= 1`
* **Gelesene Datenpunkte:**
  * `assets.VIX`, `assets.AAII_Spread`, `assets.DIX`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `vix > 40 && aaiiSpread < -25 && dix > 45`  
    *Meldung:* `KAPITULATION! Retail in totaler Panik (AAII < -25% & VIX > 40), WÄHREND Wale extrem stark akkumulieren (DIX > 45%). V-Shape Reversal imminent!`
  * 🟢 **OK:** `Kein Bottom-Setup aktiv.`

---

### 3.4 GoldCapitulationIndicator
* **Datei:** [`src/analysis/indicators/GoldCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldCapitulationIndicator.js)
* **Kategorie:** `BOTTOM_FINDER`
* **Mindestdaten:** `timeline.length >= 50`
* **Gelesene Datenpunkte:**
  * `assets.Gold`, `assets.Gold_Volume`, 20-Tage SMA des Goldpreises
  * *Trauma-Erkennung (in den letzten 30 Tagen):* Tag $i$ mit $\text{Volumen} > 3.0 \times \text{SMA50\_Vol}$ **und** 10-Tage Drop $\le -2.0\%$
  * *Ausbruch heute:* $\text{Gold}_{t-1} < \text{SMA20} \land \text{Gold}_{t} > \text{SMA20}$
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (Healing):** Trauma vorhanden **und** heute Ausbruch über SMA 20  
    *Meldung:* `BODEN GEFUNDEN! Gold durchbricht nach dem Liquidations-Trauma vom <Datum> den SMA 20. Liquidität fließt zurück ins System!`
  * 🟡 **WARNING (Trauma):** Trauma vorhanden, aber noch kein SMA 20 Ausbruch  
    *Meldung:* `Gold ist am <Datum> massiv ausgeblutet (Margin Calls). Wir warten auf den SMA 20 Ausbruch zur Bestätigung.`
  * 🟢 **OK:** `Keine extremen Panik-Muster bei Gold.`

---

### 3.5 GoldVolumeClimaxIndicator
* **Datei:** [`src/analysis/indicators/GoldVolumeClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldVolumeClimaxIndicator.js)
* **Kategorie:** `ACUTE_PANIC`
* **Mindestdaten:** `timeline.length >= 50`
* **Gelesene Datenpunkte:**
  * `assets.Gold`, `assets.Gold_Volume` (50-Tage Durchschnittsvolumen `avgVol`)
* **Schwellenwerte:** `VOL_MULTIPLIER: 5.0`, `PRICE_DROP: -2.0%`, `PRICE_RISE: +2.0%`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (Selling Climax):** `volRatio >= 5.0 && priceChangePct <= -2.0%`  
    *Meldung:* `SELLING CLIMAX! Gold crasht unter extremem Volumen (Margin Call Liquidations!).`
  * 🔴 **CRITICAL (Buying Climax):** `volRatio >= 5.0 && priceChangePct >= +2.0%`  
    *Meldung:* `BUYING CLIMAX! Gold explodiert unter extremem Volumen (Panik-Flucht in Sicherheit!).`
  * 🟢 **OK:** `Normales Gold-Handelsvolumen.`

---

### 3.6 GdxSellingClimaxIndicator
* **Datei:** [`src/analysis/indicators/GdxSellingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxSellingClimaxIndicator.js)
* **Kategorie:** `ACUTE_PANIC`
* **Mindestdaten:** `timeline.length >= 50`
* **Gelesene Datenpunkte:**
  * `assets.GDX`, `assets.GDX_Volume` (50-Tage Durchschnittsvolumen `avgVol`)
* **Schwellenwerte:** `VOL_MULTIPLIER: 3.0`, `PRICE_DROP: -5.0%`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `volRatio >= 3.0 && priceChangePct <= -5.0%`  
    *Meldung:* `GDX SELLING CLIMAX! Miner-Kapitulation. Smart Money sammelt ein (V-Shape Boden).`
  * 🟢 **OK:** `Kein Selling Climax.`

---

### 3.7 GdxBuyingClimaxIndicator
* **Datei:** [`src/analysis/indicators/GdxBuyingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxBuyingClimaxIndicator.js)
* **Kategorie:** `ACUTE_PANIC`
* **Mindestdaten:** `timeline.length >= 50`
* **Gelesene Datenpunkte:**
  * `assets.GDX`, `assets.GDX_Volume` (50-Tage Durchschnittsvolumen `avgVol`)
* **Schwellenwerte:** `VOL_MULTIPLIER: 3.0`, `PRICE_RISE: +5.0%`
* **Schalt- und Trigger-Logik:**
  * 🟡 **WARNING:** `volRatio >= 3.0 && priceChangePct >= +5.0%`  
    *Meldung:* `GDX BUYING CLIMAX! Extreme FOMO bei den Minern. Smart Money verkauft in Liquidität (Bullenfalle).`
  * 🟢 **OK:** `Kein Buying Climax.`

---

### 3.8 GdxGoldDivergenceIndicator
* **Datei:** [`src/analysis/indicators/GdxGoldDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxGoldDivergenceIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 30`
* **Gelesene Datenpunkte:**
  * 30-Tage Höchst- und Tiefstkurse von `assets.Gold` und `assets.GDX` inklusive zeitlichem Abstand (`daysAgo`)
* **Schalt- und Trigger-Logik:**
  * 🟡 **WARNING (Top-Divergenz):** Gold am Hoch ($\le 5$ Tage her), aber GDX toppte vor $\ge 10$ Tagen und liegt $\le -3.0\%$ unter Hoch  
    *Meldung:* `GDX toppt vor Gold! Smart Money nimmt bei Minen bereits Gewinne mit, während Gold noch steigt. Gold-Top steht unmittelbar bevor.`
  * 🔴 **CRITICAL (Boden-Divergenz):** Gold am Tief ($\le 5$ Tage her), aber GDX bildete Boden vor $\ge 10$ Tagen und stieg um $\ge +3.0\%$  
    *Meldung:* `BULLISCHE MINEN-DIVERGENZ! GDX macht höhere Tiefs (+<pct>% vom Boden), während Gold noch sein Tief testet. Smart Money akkumuliert Minen am Boden!`
  * 🟢 **OK:** `Keine GDX/Gold Divergenz.`

---

### 3.9 DxyParabolicClimaxIndicator
* **Datei:** [`src/analysis/indicators/DxyParabolicClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DxyParabolicClimaxIndicator.js)
* **Kategorie:** `BOTTOM_FINDER` (Target Asset: Gold)
* **Mindestdaten:** `timeline.length >= 21` (20 Tage Lookback)
* **Gelesene Datenpunkte:**
  * `assets.DXY` (heute, gestern, vor 20 Tagen)
* **Berechnung:** `roc20d = ((todayDxy - pastDxy) / pastDxy) * 100`
* **Schwellenwert:** `ROC_THRESHOLD: 3.0%`
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (Dollar-Erschöpfung):** `roc20d >= 3.0% && todayDxy < prevDxy` (Parabel bricht ein / Knick nach unten)  
    *Meldung:* `DXY PARABOLIC CLIMAX! Dollar-Parabel bricht ein (ROC: +<roc>%). Makro-Wendepunkt für physisches Gold erreicht!`
  * 🟡 **WARNING (Parabler Anstieg):** `roc20d >= 3.0% && todayDxy >= prevDxy`  
    *Meldung:* `DXY Parabel steilt an (ROC: +<roc>%). Dollar-Sog aktiv, warten auf Erschöpfungs-Knick für Gold-Kauf.`
  * 🟢 **OK:** `roc20d < 3.0%` $\rightarrow$ `DXY im normalen Bewegungsrahmen.`

---

## 4. Krypto- & Tech-Radar (Zyklen & Divergenzen)

### 4.1 BitcoinDivergenceIndicator
* **Datei:** [`src/analysis/indicators/BitcoinDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinDivergenceIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 30`
* **Gelesene Datenpunkte:**
  * 30-Tage Drawdown vom Maximum für `assets.SPY` und `assets.BTC`
* **Schalt- und Trigger-Logik:**
  * 🟡 **WARNING:** `spyDrawdown >= -2.0% && btcDrawdown <= -10.0%`  
    *Meldung:* `Liquiditäts-Staubsauger aktiv! SPY nahe Allzeithoch, aber BTC stürzt ab (TGA-Sog).`
  * 🟢 **OK:** `Keine gefährliche Liquiditäts-Divergenz.`

---

### 4.2 BitcoinSellingClimaxIndicator
* **Datei:** [`src/analysis/indicators/BitcoinSellingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinSellingClimaxIndicator.js)
* **Kategorie:** `BOTTOM_FINDER`
* **Mindestdaten:** `timeline.length >= 30`
* **Gelesene Datenpunkte:**
  * `assets.BTC`, `assets.BTC_Volume` (30-Tage Durchschnittsvolumen `avgVol`)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `volRatio >= 4.0 && priceChangePct <= -5.0%`  
    *Meldung:* `BTC SELLING CLIMAX! Gigantischer Flush-Out. Makro-Liquiditäts-Tiefpunkt erreicht!`
  * 🟢 **OK:** `Kein Krypto-Ausverkauf.`

---

### 4.3 CryptoCycleDivergenceIndicator
* **Datei:** [`src/analysis/indicators/CryptoCycleDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoCycleDivergenceIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Mindestdaten:** `timeline.length >= 30`
* **Gelesene Datenpunkte:**
  * 30-Tage Drawdowns von `assets.BTC`, `assets.MSTR`, `assets.COIN`
* **Schalt- und Trigger-Logik:**
  * 🟡 **WARNING:** `btcDrawdown >= -2.0% && Math.min(mstrDrawdown, coinDrawdown) <= -15.0%`  
    *Meldung:* `Zyklus-Warnung! BTC stark, aber MSTR/COIN bluten aus (Liquidität fehlt).`
  * 🟢 **OK:** `Krypto-Proxies intakt.`

---

### 4.4 CryptoPortfolioExitIndicator
* **Datei:** [`src/analysis/indicators/CryptoPortfolioExitIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoPortfolioExitIndicator.js)
* **Kategorie:** `ACUTE_PANIC`
* **Mindestdaten:** `timeline.length >= 50`
* **Gelesene Datenpunkte:**
  * Config: `MACRO_CYCLE.lastBtcBottomDate`, `dangerWindowStartDays` (Default: 970 Tage)
  * `assets.MSTR`, `assets.COIN` (Preis vs. SMA 50)
  * `assets.MSTR_Volume`, `assets.COIN_Volume` (Volumen vs. SMA 50 Volumen)
* **Schalt- und Trigger-Logik:**
  * 🟢 **OK:** `daysSinceBottom < 970` $\rightarrow$ `Krypto-Proxies im sicheren Zeitfenster.`
  * 🔴 **CRITICAL:** `daysSinceBottom >= 970` **und** (MSTR kreuzt SMA 50 nach unten bei $\text{Vol} > 1.2 \times \text{SMA50\_Vol}$ ODER COIN kreuzt SMA 50 nach unten bei $\text{Vol} > 1.2 \times \text{SMA50\_Vol}$)  
    *Meldung:* `GEFAHRENZONE AKTIV! <Alarme>. MSTR/COIN sofort abverkaufen!`
  * 🟡 **WARNING:** `daysSinceBottom >= 970`, aber noch kein Volumen-Bruch  
    *Meldung:* `Gefahrenzone (>970 Tage) aktiv! Warten auf SMA 50 Bruch unter hohem Volumen.`

---

### 4.5 BtcTrailingStopIndicator
* **Datei:** [`src/analysis/indicators/BtcTrailingStopIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BtcTrailingStopIndicator.js)
* **Kategorie:** `ACUTE_PANIC`
* **Mindestdaten:** `timeline.length >= 200`
* **Gelesene Datenpunkte:**
  * `assets.MSTR` (heute vs. gestern) und 200-Tage SMA von MSTR
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (Kreuzungs-Tag):** `mstr < mstrSma200 && prevMstr >= prevMstrSma200`  
    *Meldung:* `MSTR VERLIERT SMA 200! Strukturelle Liquidität bricht ab. BTC Zyklus-Top innerhalb 30-60 Tagen erwartet. Stop-Loss bei BTC ab sofort extrem eng nachziehen!`
  * 🟡 **WARNING (Fortlaufend):** `mstr < mstrSma200`  
    *Meldung:* `MSTR bleibt unter SMA 200 (<dropPct>%). Makro-Klima für BTC extrem toxisch.`
  * 🟢 **OK:** `mstr >= mstrSma200` $\rightarrow$ `MSTR intakt. Makro-Liquidität für BTC weiterhin vorhanden.`

---

### 4.6 TechCycleRadarIndicator
* **Datei:** [`src/analysis/indicators/TechCycleRadarIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TechCycleRadarIndicator.js)
* **Kategorie:** `MACRO_CONTEXT`
* **Mindestdaten:** `timeline.length >= 100`
* **Gelesene Datenpunkte:**
  * `assets.SMH`, `assets.IGV` (Berechnung des Ratios $\frac{\text{SMH}}{\text{IGV}}$)
  * `shortMa`: 15-Tage SMA des Ratios (heute vs. vor 5 Tagen `prevShortMa`)
  * `longMa`: 50-Tage SMA des Ratios
  * `assets.CIBR`, `assets.SPY` (15-Tage Relatives Stärke-Momentum)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (Hardware Start):** Golden Cross (`shortMa > longMa && prevShortMa <= prevLongMa`)  
    *Meldung:* `TECH-ZYKLUS BESTÄTIGUNG: Hardware (SMH) hat offiziell die Führung übernommen (Golden Cross des Ratios). Der neue KI/Infrastruktur-Zyklus ist aktiv.`
  * 🔴 **CRITICAL (Software Start):** Death Cross (`shortMa < longMa && prevShortMa >= prevLongMa`)  
    *Meldung:* `TECH-ZYKLUS BESTÄTIGUNG: Software (IGV) hat offiziell die Führung übernommen (Death Cross des Ratios). Das Geld wandert in SaaS/Monetarisierung.`
  * 🟡 **WARNING (Distribution):** `shortMa > longMa` (Hardware dominant), aber Momentum fällt (`shortMa - prevShortMa < 0`)  
    *Meldung:* `Hardware wackelt (Distribution). Das Ratio flacht ab, Gewinnmitnahmen wahrscheinlich. [Defensives Geld flüchtet in Cybersecurity (CIBR +<pct>%).]`
  * 🟡 **WARNING (Accumulation):** `shortMa < longMa` (Software dominant), aber Momentum steigt (`shortMa - prevShortMa > 0`)  
    *Meldung:* `Vorwarnung: Software (IGV) ist noch dominant, aber Hardware (SMH) sammelt bereits massiv Momentum. Ein Wechsel steht an.`
  * 🟢 **OK:** Trend intakt und baut Momentum auf.

---

## 5. Mehrstufige & Machine-Learning Indikatoren

### 5.1 DalioTwoStageRegimeIndicator
* **Datei:** [`src/analysis/indicators/DalioTwoStageRegimeIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DalioTwoStageRegimeIndicator.js)
* **Kategorie:** `MACRO_CONTEXT`
* **Mindestdaten:** `timeline.length >= 5`
* **Gelesene Datenpunkte:**
  * Zinsen: `FedFundsRate`, `RealYield10y`, `Yield30y`, `Spread10y3m`, `Spread10y2y`
  * Liquidität & Spreads: `ReverseRepo` (RRP in $B), `HighYieldSpread` (%)
  * Fiskal-Bilanzen: `GovInterestExpenses`, `GovTaxReceipts`
* **2-Stufen Schalt-Logik:**
  * **Stufe 1 (Spätzyklus-Watchlist – min. 3 von 4 Bedingungen ROT):**
    1. *Zinsdruck:* $\text{FedFunds} > 4.5\% \lor 10\text{Y} > 4.5\% \lor 30\text{Y} > 5.0\%$
    2. *Inversion:* $\text{Spread10y3m} < 0 \lor \text{Spread10y2y} < 0$
    3. *Schuldenlast:* $\frac{\text{Zinsausgaben}}{\text{Steuern}} > 30\% \lor \text{Zinsausgaben} > 900 \text{ Mrd. \$}$
    4. *Kreditrisiko:* $\text{HighYieldSpread} > 3.5\% \lor (\text{Zinsdruck} \land \text{Inversion})$
  * **Stufe 2 (Kipppunkt-Trigger):**  
    Stufe 1 aktiv **und** ($\text{RRP} < 20 \text{ Mrd. \$}$ ODER $\text{HighYieldSpread} > 4.0\%$)
* **Status-Rückgabe:**
  * 🔴 **CRITICAL:** Stufe 2 getriggert $\rightarrow$ `ALARM ROT: Dalio-Kipppunkt erreicht! (<Grund>). Unmittelbares Crash-Fenster (0-3 Monate).`
  * 🟡 **WARNING:** Stufe 1 aktiv ($\ge 3/4$ ROT) $\rightarrow$ `Spätzyklus-Watchlist aktiv (Fenster: ~3 bis 12 Monate).`
  * 🟢 **OK:** Normalzustand ($< 3/4$ ROT).

---

### 5.2 MlRegimeRadarMacroIndicator
* **Datei:** [`src/analysis/indicators/MlRegimeRadarMacroIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarMacroIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Gelesene Datenpunkte:** `timeline[t].mlRegime` (`phase`, `confidence`)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `phase === 'MACRO_TOP'` $\rightarrow$ `ML-Modell erkennt zyklisches MAKRO-TOP!`
  * 🔴 **CRITICAL:** `phase === 'MACRO_BOTTOM'` $\rightarrow$ `ML-Modell erkennt zyklischen MAKRO-BODEN!`
  * 🟡 **WARNING:** `phase === 'DOWNTREND'` $\rightarrow$ `ML-Modell warnt vor Abwärtstrend.`
  * 🟢 **OK:** `phase === 'UPTREND'` $\rightarrow$ `ML-Modell signalisiert intakten Aufwärtstrend.`

---

### 5.3 MlRegimeRadarSpyIndicator
* **Datei:** [`src/analysis/indicators/MlRegimeRadarSpyIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarSpyIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Gelesene Datenpunkte:** `timeline[t].mlRegimeSpy` (`phase`, `confidence`)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (TOP):** `phase === 'MACRO_TOP' || phase === 'CYCLE_TOP'`  
    *Meldung:* `KI-ALARM! Absolute SPY-Makro-Euphorie erkannt. Extremes Absturzrisiko.`
  * 🔴 **CRITICAL (BOTTOM):** `phase === 'MACRO_BOTTOM' || phase === 'CYCLE_BOTTOM'`  
    *Meldung:* `KI-SIGNAL! SPY Makroökonomisches Tal der Tränen (Kapitulation) erreicht.`
  * 🟡 **WARNING:** `(phase === 'DOWNTREND' || phase === 'BEAR_MARKET') && confidence > 0.6`  
    *Meldung:* `KI-Warnung! SPY Bärenmarkt-Struktur aktiv. Liquidität sinkt.`
  * 🟢 **OK:** `phase === 'UPTREND' || phase === 'BULL_MARKET'`  
    *Meldung:* `SPY Gesunde Bullenmarkt-Struktur (Higher Highs).`

---

### 5.4 MlRegimeRadarQqqIndicator
* **Datei:** [`src/analysis/indicators/MlRegimeRadarQqqIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarQqqIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Gelesene Datenpunkte:** `timeline[t].mlRegimeQqq` (`phase`, `confidence`)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (TOP):** `phase === 'MACRO_TOP' || phase === 'CYCLE_TOP'`  
    *Meldung:* `KI-ALARM! QQQ Makro-Euphorie erkannt. Tech-Topping im Gange.`
  * 🔴 **CRITICAL (BOTTOM):** `phase === 'MACRO_BOTTOM' || phase === 'CYCLE_BOTTOM'`  
    *Meldung:* `KI-SIGNAL! QQQ Kapitulation ist erreicht. Tech-Kaufgelegenheit.`
  * 🟡 **WARNING:** `(phase === 'DOWNTREND' || phase === 'BEAR_MARKET') && confidence > 0.6`  
    *Meldung:* `KI-Warnung! QQQ Bärenmarkt-Struktur aktiv.`
  * 🟢 **OK:** `phase === 'UPTREND' || phase === 'BULL_MARKET'`  
    *Meldung:* `QQQ Gesunde Bullenmarkt-Struktur.`

---

### 5.5 MlRegimeRadarBtcIndicator
* **Datei:** [`src/analysis/indicators/MlRegimeRadarBtcIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarBtcIndicator.js)
* **Kategorie:** `EARLY_WARNING`
* **Gelesene Datenpunkte:** `timeline[t].mlRegimeBtc` (`phase`, `confidence`)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL (TOP):** `phase === 'MACRO_TOP' || phase === 'CYCLE_TOP'`  
    *Meldung:* `KRYPTO-ZYKLUSENDE! Verteilungsphase (Distribution) im vollen Gange.`
  * 🔴 **CRITICAL (BOTTOM):** `phase === 'MACRO_BOTTOM' || phase === 'CYCLE_BOTTOM'`  
    *Meldung:* `KRYPTO-BODEN! Historische Kaufgelegenheit im Bitcoin.`
  * 🟡 **WARNING:** `(phase === 'DOWNTREND' || phase === 'BEAR_MARKET') && confidence > 0.6` $\rightarrow$ `KRYPTO-WINTER: Bärenmarkt aktiv.`
  * 🟡 **WARNING (Bear Rally):** `phase === 'BEAR_RALLY'` $\rightarrow$ `Trügerischer Pump im Bärenmarkt (Dead Cat Bounce).`
  * 🟢 **OK:** `phase === 'UPTREND' || phase === 'BULL_MARKET' || phase === 'BULL_CORRECTION'`

---

### 5.6 MlRegimeRadarCryptoIndicator
* **Datei:** [`src/analysis/indicators/MlRegimeRadarCryptoIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarCryptoIndicator.js)
* **Kategorie:** `ACUTE_PANIC`
* **Gelesene Datenpunkte:** `timeline[t].mlRegime` (`phase`, `confidence`)
* **Schalt- und Trigger-Logik:**
  * 🔴 **CRITICAL:** `phase === 'MACRO_TOP'` $\rightarrow$ `ML-Modell erkennt KRYPTO-ZYKLUSENDE!`
  * 🔴 **CRITICAL:** `phase === 'MACRO_BOTTOM'` $\rightarrow$ `ML-Modell erkennt KRYPTO-BODEN!`
  * 🟡 **WARNING:** `phase === 'DOWNTREND'` $\rightarrow$ `ML-Modell warnt vor Krypto-Abwärtstrend.`
  * 🟢 **OK:** `Krypto-Zyklus intakt (oder neutral).`

---

## 6. Historische Marktwendepunkte & Regime-Übergänge (2000–2026)

Die folgende Referenztabelle fasst die wesentlichen Bärenmärkte, Bär-zu-Bulle Übergänge und schweren Korrekturen ($\ge 12\,\%$) des S&P 500 der letzten 25 Jahre zusammen (rein bezogen auf die Aktienmärkte):

| Markt-Phase & Ereignis | Allzeithoch (Peak / Bulle-Ende) | Tiefpunkt (Trough / Bär-Boden) | S&P 500 Drawdown | Dauer bis Boden | Auslösende Top-Dynamik & Smart Money Exit | Bodenbildungs- & Erholungs-Signal |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dotcom-Blase & Rezession** | 24.03.2000 | 09.10.2002 | **-49,14 %** | 31 Monate | Tech-Überbewertung, Margin Debt toppte Feb 2000, Zinskurve un-invertierte steil | Fed Funds Rate Senkung bis 1,0 %, Bewertungsausverkauf |
| **Große Finanzkrise (GFC)** | 09.10.2007 | 09.03.2009 | **-56,47 %** | 17 Monate | Subprime-Kollaps, Margin Debt toppte Jun 2007, NFCI Stress > 0, Zinskurve un-invertiert | Start QE1, Notfallkredite (WRESBAL Injektion > 150 Mrd. USD), TARP Bankenrettung |
| **US-Rating-Downgrade & Eurokrise** | 29.04.2011 | 03.10.2011 | **-19,39 %** *(Intraday -21,6 %)* | 5 Monate | S&P US-Downgrade auf AA+, Staatsschuldenkrise Südeuropa | FED kündigt „Operation Twist“ zur Zinsdrückung an |
| **China-Yuan-Schock & Öl-Crash** | 21.05.2015 | 11.02.2016 | **-15,16 %** | 9 Monate | Yuan-Abwertung, Rohöl-Kollaps (< $30/Barrel), Zinsanhebungsangst | EZB erweitert Stimulus, FED pausiert Zinsanhebungen (Doppelboden) |
| **Zins-Panik / "QT-Klemme"** | 20.09.2018 | 24.12.2018 | **-20,18 %** | 3 Monate | Powell „Rates far from neutral“, Bankreserven fielen um 114 Mrd., DIX < 40 % | „Powell Pivot“ (Jan 2019): Fed stoppt Zinserhöhungen und QT |
| **Corona-Crash** | 19.02.2020 | 23.03.2020 | **-34,10 %** | 33 Tage | Globale Lockdowns, Liquiditäts-Freeze, DIX fiel vorab unter 40 % | Unbegrenztes QE der FED (*"whatever it takes"*), 2T $ CARES Act |
| **Großer Inflations- & Zinsschock** | 03.01.2022 | 12.10.2022 | **-25,36 %** | 9,5 Monate | Inflation 9,1 %, Margin Debt toppte Sep 2021, Bankreserven -257 Mrd. $, SKEW > 145 | BoE Notintervention, US-Inflation toppte, RRP-Pufferentleerung spülte Liquidität |
| **Maturity-Wall & Fiskal-Klemme** | 19.02.2025 | 08.04.2025 | **-19,00 %** | 50 Tage | T-Bill Refinancing Cliff (> 21 % M2), TGA-Sauger, SKEW bei 175.76 | Treasury TGA-Entleerung und Treasury-Buybacks zur Liquiditätsinjektion |

