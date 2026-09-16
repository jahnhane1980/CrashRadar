### Gesamtergebnis

Von den **38 Indikatoren** im Ordner [`src/analysis/indicators/`](file:///D:/GitHub/CrashRadar/src/analysis/indicators) werden insgesamt **23 Indikatoren nicht aktiv im operativen Sourcecode verwendet**.

Diese unterteilen sich in zwei Kategorien:
1. **15 Indikatoren sind komplett ungenutzt** (0 Referenzen im gesamten `src/`-Ordner außerhalb ihrer eigenen Datei).
2. **8 Indikatoren sind zwar in `src/` importiert/deklariert, aber zur Laufzeit inaktiv** (entweder in der Pipeline-Konfiguration deaktiviert oder toter Legacy-Code in Engines).

Nur **15 Indikatoren** werden aktuell produktiv über die [`MacroRegimeEngine`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js) ausgeführt.

---

### 1. Komplett ungenutzt im Sourcecode (15 Indikatoren)

Diese Dateien besitzen **keine einzige Import- oder Verwendungsstelle** im gesamten Produktionscode unter `src/`. Sie existieren als Standalone-Klassen, sind durch Unit-Tests abgedeckt und wurden teilweise in Forschungsstudien (`scratch/` / `docs/`) evaluiert, aber nie in eine Produktions-Engine verdrahtet:

| Indikator | Klasse | Ursprung / Kontext |
| :--- | :--- | :--- |
| [`BitcoinDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinDivergenceIndicator.js) | [`BitcoinDivergenceIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinDivergenceIndicator.js) | Krypto-Forschung (abgelöst durch [`CryptoSensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js)) |
| [`BitcoinSellingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinSellingClimaxIndicator.js) | [`BitcoinSellingClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinSellingClimaxIndicator.js) | Krypto-Forschung (abgelöst durch [`CryptoSensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js)) |
| [`CryptoCycleDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoCycleDivergenceIndicator.js) | [`CryptoCycleDivergenceIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoCycleDivergenceIndicator.js) | Krypto-Forschung (abgelöst durch [`CryptoSensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js)) |
| [`CryptoPortfolioExitIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoPortfolioExitIndicator.js) | [`CryptoPortfolioExitIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoPortfolioExitIndicator.js) | Krypto-Forschung (abgelöst durch [`CryptoSensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js)) |
| [`DxyParabolicClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DxyParabolicClimaxIndicator.js) | [`DxyParabolicClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DxyParabolicClimaxIndicator.js) | DXY-Climax-Studie, nicht in Pipeline |
| [`GdxBuyingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxBuyingClimaxIndicator.js) | [`GdxBuyingClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxBuyingClimaxIndicator.js) | Minen-Backtest-Studie (`test_gold_indicators_performance.js`) |
| [`GdxGoldDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxGoldDivergenceIndicator.js) | [`GdxGoldDivergenceIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxGoldDivergenceIndicator.js) | Minen-Backtest-Studie |
| [`GdxSellingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxSellingClimaxIndicator.js) | [`GdxSellingClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxSellingClimaxIndicator.js) | Minen-Backtest-Studie |
| [`GoldCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldCapitulationIndicator.js) | [`GoldCapitulationIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldCapitulationIndicator.js) | Gold-Kauf-Studie |
| [`GoldVolumeClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldVolumeClimaxIndicator.js) | [`GoldVolumeClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldVolumeClimaxIndicator.js) | Gold-Volumen-Studie |
| [`MlRegimeRadarBtcIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarBtcIndicator.js) | [`MlRegimeRadarBtcIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarBtcIndicator.js) | ML-Krypto-Prototyp (nicht in Pipeline) |
| [`MlRegimeRadarCryptoIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarCryptoIndicator.js) | [`MlRegimeRadarCryptoIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarCryptoIndicator.js) | ML-Krypto-Prototyp (nicht in Pipeline) |
| [`MlRegimeRadarQqqIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarQqqIndicator.js) | [`MlRegimeRadarQqqIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarQqqIndicator.js) | ML-Asset-Prototyp (nicht in Pipeline) |
| [`MlRegimeRadarSpyIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarSpyIndicator.js) | [`MlRegimeRadarSpyIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarSpyIndicator.js) | ML-Asset-Prototyp (nicht in Pipeline) |
| [`TechCycleRadarIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TechCycleRadarIndicator.js) | [`TechCycleRadarIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TechCycleRadarIndicator.js) | Standalone-Halbleiter-/Tech-Zyklusradar |

---

### 2. In `src/` importiert, aber zur Laufzeit inaktiv / tot (8 Indikatoren)

#### A. In [`config/Indicator-Pipeline-Config.json`](file:///D:/GitHub/CrashRadar/config/Indicator-Pipeline-Config.json) explizit deaktiviert (`"enabled": false`):
Die [`MacroRegimeEngine`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js#L73) filtert `item.enabled !== false`. Folgende Indikatoren werden importiert, aber beim Pipeline-Start sofort verworfen:
* [`BankReservesIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BankReservesIndicator.js): In [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js#L17) importiert, in der Pipeline-Config jedoch `"enabled": false`.
* [`TgaIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TgaIndicator.js): In [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js#L15) importiert, in der Pipeline-Config jedoch `"enabled": false` (zugunsten moderner Plumbing-Modelle abgelöst).
* [`KatastrophenMatrixIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/KatastrophenMatrixIndicator.js): In der Pipeline-Config auf `"enabled": false` gesetzt. In [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js#L40) wird zwar noch `this.katastrophenMatrix` instanziiert, aber in [`buildMacroSignalContext()`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js#L88) **nie aufgerufen** (vollständig abgelöst durch [`MacroStressSensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/MacroStressSensorHub.js)).
* [`SmartDumbMoneyBottomIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyBottomIndicator.js): In der Pipeline-Config auf `"enabled": false`. In [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js#L47) als ungenutztes Property `this.smartDumbBottom` hinterlegt, aber nie aufgerufen (vollständig abgelöst durch [`MarketBottomSensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/MarketBottomSensorHub.js)).

#### B. Ungenutzter Toter Code / Pipeline-Bypässe:
* [`BtcTrailingStopIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BtcTrailingStopIndicator.js): Steht **nicht** in der Pipeline-Config. Wird nur in [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js#L49) als `this.btcTrailingStop` abgelegt, in der Auswertung jedoch nie aufgerufen (Krypto-Steuerung erfolgt über [`CryptoSensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js)).
* [`DarkPoolAccumulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DarkPoolAccumulationIndicator.js): In [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js#L29) in `registry`, fehlt aber in der Pipeline-Config. In [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js#L48) als Legacy-Feld instanziiert, aber nie aufgerufen.
* [`GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js): In [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js#L28) in `registry`, fehlt aber in der Pipeline-Config. In [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js#L42) als Legacy-Feld instanziiert, aber nie aufgerufen.
* [`VixSpikeCrushIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/VixSpikeCrushIndicator.js): Wird ausschließlich von [`GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js#L5) als Sub-Komponente importiert. Da `GoldSniperIndicator` selbst nicht operativ läuft, wird auch `VixSpikeCrushIndicator` nie evaluiert.

---

### 3. Gegenprobe: Die 15 tatsächlich AKTIV verwendeten Indikatoren

Diese 15 Indikatoren sind in [`config/Indicator-Pipeline-Config.json`](file:///D:/GitHub/CrashRadar/config/Indicator-Pipeline-Config.json) mit `"enabled": true` geschaltet und werden bei jedem Lauf der [`MacroRegimeEngine`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js) (z. B. im [`IndicatorAnalysisRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/IndicatorAnalysisRunner.js)) operativ berechnet:

1. [`ChallengerIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/ChallengerIndicator.js)
2. [`DalioTwoStageRegimeIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DalioTwoStageRegimeIndicator.js)
3. [`FiscalFedLiquidityIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/FiscalFedLiquidityIndicator.js)
4. [`InterestRateCycleIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/InterestRateCycleIndicator.js)
5. [`LaborMarketDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/LaborMarketDivergenceIndicator.js)
6. [`MarginDebtIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MarginDebtIndicator.js)
7. [`MaturityWallIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MaturityWallIndicator.js)
8. [`MlRegimeRadarMacroIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarMacroIndicator.js)
9. [`NfciIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/NfciIndicator.js)
10. [`PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js)
11. [`RedAlertIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/RedAlertIndicator.js)
12. [`SmartDumbMoneyTopIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyTopIndicator.js)
13. [`StealthExitIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/StealthExitIndicator.js)
14. [`TreasuryCapacityRadarIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TreasuryCapacityRadarIndicator.js)
15. [`YieldCurveIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/YieldCurveIndicator.js)

---

## Detaillierte Funktionsweise & Schwellenwerte aller 23 ungenutzten Indikatoren

### Teil 1: Die 15 komplett ungenutzten Indikatoren (0 Referenzen in `src/`)

#### 1. [`BitcoinDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinDivergenceIndicator.js) – [`BitcoinDivergenceIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinDivergenceIndicator.js)
* **Zweck:** Erkennt den „Liquiditäts-Staubsauger-Effekt“ (z. B. TGA-Sog), wenn Aktien noch oben stehen, Bitcoin aber bereits abverkauft wird.
* **Konkrete Schwellenwerte:**
  * Berechnet den 30-Tage-Drawdown vom Hochpunkt für SPY und BTC über [`MathUtils.getDrawdownFromMax()`](file:///D:/GitHub/CrashRadar/src/utils/MathUtils.js).
  * **`WARNING`:** `SPY-Drawdown >= -2.0 %` (Aktienmarkt nahe ATH) **UND** `BTC-Drawdown <= -10.0 %` (Bitcoin verliert mind. 10 %).

---

#### 2. [`BitcoinSellingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinSellingClimaxIndicator.js) – [`BitcoinSellingClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinSellingClimaxIndicator.js)
* **Zweck:** Erkennt panikartige Kapitulations-Ausverkäufe und Flush-Outs am Krypto-Markttief als Wendepunkt.
* **Konkrete Schwellenwerte:**
  * 30-Tage-Durchschnitt des Bitcoin-Volumens (`avgVol30`).
  * **`CRITICAL`:** `Volumen-Ratio >= 4.0` (mindestens **4-faches** 30-Tage-Durchschnittsvolumen) **UND** Tagesverlust `priceChangePct <= -5.0 %`.

---

#### 3. [`CryptoCycleDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoCycleDivergenceIndicator.js) – [`CryptoCycleDivergenceIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoCycleDivergenceIndicator.js)
* **Zweck:** Frühwarnung vor Krypto-Zyklus-Tops über Krypto-Proxy-Aktien (MSTR, COIN). Zeigt an, wenn institutionelles Smart Money bereits aus den Proxies flieht, während BTC noch hoch gehalten wird.
* **Konkrete Schwellenwerte:**
  * Berechnet den 30-Tage-Drawdown für BTC, MSTR und COIN (`proxyDrawdown = Math.min(MstrDrawdown, CoinDrawdown)`).
  * **`WARNING`:** `BTC-Drawdown >= -2.0 %` (BTC stabil nahe Hoch) **UND** `Proxy-Drawdown <= -15.0 %` (MSTR oder COIN mind. 15 % unter 30-Tage-Hoch).

---

#### 4. [`CryptoPortfolioExitIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoPortfolioExitIndicator.js) – [`CryptoPortfolioExitIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoPortfolioExitIndicator.js)
* **Zweck:** Notfall-Ausstieg für MSTR und COIN basierend auf dem 4-Jahres-Zyklus (Halving) gekoppelt an gleitende Durchschnitte.
* **Konkrete Schwellenwerte:**
  * **Zyklus-Zeitfilter:** Berechnet Tage seit dem Zyklustief (`lastBtcBottomDate`, z. B. 21.11.2022). Unter **970 Tagen** (`dangerWindowStartDays`) ist das System auf `OK` („sicheres Zeitfenster“).
  * **`WARNING`:** Tage seit Tief `>= 970 Tage` (Gefahrenzone aktiv).
  * **`CRITICAL` (Sofortverkauf):** Tage `>= 970` **UND** MSTR oder COIN brechen ihren **SMA 50** nach unten bei einem Tagesvolumen von `> 1.2 * SMA-50-Volumen` (mind. 20 % über Durchschnittsvolumen).

---

#### 5. [`DxyParabolicClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DxyParabolicClimaxIndicator.js) – [`DxyParabolicClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DxyParabolicClimaxIndicator.js)
* **Zweck:** Erkennt eine parabolische Überhitzung des US-Dollars (DXY) und dessen Erschöpfungsknick als antizyklisches Kaufsignal für physisches Gold.
* **Konkrete Schwellenwerte:**
  * Berechnet die 20-Tage Rate of Change (`ROC`) des DXY.
  * **`WARNING`:** 20-Tage-Anstieg `ROC >= +3.0 %` (Dollar steilt parabolisch an).
  * **`CRITICAL`:** `ROC >= +3.0 %` **UND** `DXY_heute < DXY_gestern` (Erschöpfungsknick nach Parabel = Gold-Kaufsignal).

---

#### 6. [`GdxBuyingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxBuyingClimaxIndicator.js) – [`GdxBuyingClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxBuyingClimaxIndicator.js)
* **Zweck:** Erkennt extreme FOMO-Käufe bei Goldminen (GDX) als Top-Gefahr / Bullenfalle.
* **Konkrete Schwellenwerte:**
  * Berechnet 50-Tage-Durchschnittsvolumen von GDX.
  * **`WARNING`:** `Volumen >= 3.0 * Durchschnittsvolumen` **UND** Tageskursgewinn `>= +5.0 %`.

---

#### 7. [`GdxGoldDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxGoldDivergenceIndicator.js) – [`GdxGoldDivergenceIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxGoldDivergenceIndicator.js)
* **Zweck:** Nutzt Minen-Aktien als Vorlaufindikator für Gold, um bevorstehende Tops oder Böden zu erkennen.
* **Konkrete Schwellenwerte:**
  * **`WARNING` (Bearische Top-Divergenz):** Gold-Hoch liegt maximal 5 Tage zurück (`<= 5d`), GDX-Hoch liegt mindestens 10 Tage zurück (`>= 10d`) **UND** GDX verliert bereits mindestens `3.0 %` vom Hoch (`GDX-Drawdown <= -3.0 %`).
  * **`CRITICAL` (Bullische Boden-Divergenz):** Gold-Tief liegt maximal 5 Tage zurück (`<= 5d`), GDX-Tief liegt mindestens 10 Tage zurück (`>= 10d`) **UND** GDX hat sich bereits um `>= +3.0 %` vom Tief erholt.

---

#### 8. [`GdxSellingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxSellingClimaxIndicator.js) – [`GdxSellingClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxSellingClimaxIndicator.js)
* **Zweck:** Erkennt Panik-Kapitulation bei Goldminen (GDX) als V-Shape-Bodensignal.
* **Konkrete Schwellenwerte:**
  * Berechnet 50-Tage-Durchschnittsvolumen von GDX.
  * **`CRITICAL`:** `Volumen >= 3.0 * Durchschnittsvolumen` **UND** Tageskursverlust `<= -5.0 %`.

---

#### 9. [`GoldCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldCapitulationIndicator.js) – [`GoldCapitulationIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldCapitulationIndicator.js)
* **Zweck:** 2-Stufen-Erkennung von Gold-Böden nach Liquidations-Traumata (Zwangsverkäufe zur Deckung von Aktien-Margin-Calls).
* **Konkrete Schwellenwerte:**
  * **Stufe 1 (Trauma-Tag in den letzten 30 Tagen):** Ein Handelstag mit `Gold-Volumen > 3.0 * 50-Tage-Volumen` **UND** 10-Tage-Gold-Drop `<= -2.0 %`.
  * **Stufe 2 (Heilungsausbruch):** Gold kreuzt heute von unten über den **SMA 20** (`gestern < SMA20` und `heute > SMA20`).
  * **`CRITICAL`:** Trauma-Tag vorhanden **UND** SMA-20-Ausbruch erfolgt.

---

#### 10. [`GoldVolumeClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldVolumeClimaxIndicator.js) – [`GoldVolumeClimaxIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldVolumeClimaxIndicator.js)
* **Zweck:** Erkennt massive Volumen-Extrema in physischem Gold als Zwangsliquidierung oder Panik-Flucht.
* **Konkrete Schwellenwerte:**
  * Berechnet 50-Tage-Durchschnittsvolumen von Gold.
  * **`CRITICAL` (Selling Climax):** `Volumen >= 5.0 * Durchschnittsvolumen` **UND** Tagesverlust `<= -2.0 %`.
  * **`CRITICAL` (Buying Climax):** `Volumen >= 5.0 * Durchschnittsvolumen` **UND** Tagesgewinn `>= +2.0 %`.

---

#### 11. [`MlRegimeRadarBtcIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarBtcIndicator.js) – [`MlRegimeRadarBtcIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarBtcIndicator.js)
* **Zweck:** Mappt die Vorhersagen des BTC-LSTM-Klassifikationsmodells in Signalstufen.
* **Konkrete Schwellenwerte:**
  * **`CRITICAL`:** Phase `MACRO_TOP` oder `CYCLE_TOP` ODER Phase `MACRO_BOTTOM` oder `CYCLE_BOTTOM`.
  * **`WARNING`:** Phase `DOWNTREND` / `BEAR_MARKET` mit **Konfidenz `> 0.6` (60 %)** ODER Phase `BEAR_RALLY` (Bärenmarktrallye).
  * **`OK`:** Phase `UPTREND`, `BULL_MARKET` oder `BULL_CORRECTION`.

---

#### 12. [`MlRegimeRadarCryptoIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarCryptoIndicator.js) – [`MlRegimeRadarCryptoIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarCryptoIndicator.js)
* **Zweck:** Einfacher ML-Wrapper für das allgemeine Krypto-Regime (`mlRegime`).
* **Konkrete Schwellenwerte:**
  * **`CRITICAL`:** Phase `MACRO_TOP` oder `MACRO_BOTTOM`.
  * **`WARNING`:** Phase `DOWNTREND`.

---

#### 13. [`MlRegimeRadarQqqIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarQqqIndicator.js) – [`MlRegimeRadarQqqIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarQqqIndicator.js)
* **Zweck:** Mappt die LSTM-Vorhersagen für den Nasdaq-100 (QQQ).
* **Konkrete Schwellenwerte:**
  * **`CRITICAL`:** Phase `MACRO_TOP` / `CYCLE_TOP` (Tech-Euphorie) ODER `MACRO_BOTTOM` / `CYCLE_BOTTOM` (Tech-Kapitulation).
  * **`WARNING`:** Phase `DOWNTREND` / `BEAR_MARKET` mit **Konfidenz `> 0.6`**.

---

#### 14. [`MlRegimeRadarSpyIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarSpyIndicator.js) – [`MlRegimeRadarSpyIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarSpyIndicator.js)
* **Zweck:** Mappt die LSTM-Vorhersagen für den S&P 500 (SPY).
* **Konkrete Schwellenwerte:**
  * **`CRITICAL`:** Phase `MACRO_TOP` / `CYCLE_TOP` ODER `MACRO_BOTTOM` / `CYCLE_BOTTOM`.
  * **`WARNING`:** Phase `DOWNTREND` / `BEAR_MARKET` mit **Konfidenz `> 0.6`**.

---

#### 15. [`TechCycleRadarIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TechCycleRadarIndicator.js) – [`TechCycleRadarIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TechCycleRadarIndicator.js)
* **Zweck:** Misst die Rotation im Tech-Sektor zwischen Halbleitern/Hardware (SMH) und Software/SaaS (IGV) sowie Flucht in Cybersecurity (CIBR).
* **Konkrete Schwellenwerte:**
  * Berechnet das Ratio `SMH / IGV` und glättet es über einen schnellen **15-Tage-MA** und einen langsamen **50-Tage-MA**.
  * **`CRITICAL` (Hardware-Start):** Golden Cross des Ratios (`MA15 > MA50`, zuvor darunter).
  * **`CRITICAL` (Software-Start):** Death Cross des Ratios (`MA15 < MA50`, zuvor darüber).
  * **`WARNING` (Distribution):** Hardware dominiert, aber 5-Tage-Momentum des MA15 flacht ab (`< 0`).
  * **Flucht-Erkennung:** Steigt die relative Stärke `CIBR / SPY` in 15 Tagen um **`> 2.0 %`**, meldet der Indikator defensive Flucht in Cybersecurity.

---

### Teil 2: Die 8 inaktiven / aus der Pipeline entfernten Indikatoren

#### 16. [`BankReservesIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BankReservesIndicator.js) – [`BankReservesIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BankReservesIndicator.js)
* **Zweck:** Überwacht die Gesamtbankreserven bei der FED (`TOTRESNS`) auf Liquiditätskrisen im Interbankenmarkt (LCLOR / Repo-Krise).
* **Konkrete Schwellenwerte:**
  * **`CRITICAL`:** Bankreserven **`< 2.800 Mrd. USD`** (2,8 Billionen USD = akute Repo-Krise).
  * **`WARNING`:** Bankreserven **`< 3.000 Mrd. USD`** (3,0 Billionen USD = Annäherung an Gefahrenzone).

---

#### 17. [`TgaIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TgaIndicator.js) – [`TgaIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TgaIndicator.js)
* **Zweck:** Misst 30-Tage-Veränderungen des US-Finanzminister-Kontos (TGA) zur Erkennung von Liquiditätsentzug vs. Stealth-Stimulus.
* **Konkrete Schwellenwerte:**
  * Berechnet `diff = TGA_heute - TGA_vor_30_Tagen`.
  * **`WARNING`:** Anstieg um **`> +100 Mrd. USD`** (Finanzministerium entzieht dem Markt Liquidität).
  * **`OK` (Stealth-Stimulus):** Rückgang um **`< -100 Mrd. USD`** (TGA schüttet Liquidität in die Märkte aus).

---

#### 18. [`KatastrophenMatrixIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/KatastrophenMatrixIndicator.js) – [`KatastrophenMatrixIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/KatastrophenMatrixIndicator.js)
* **Zweck:** Klassisches 3-Säulen-Makro-Schutzschild (jetzt durch [`MacroStressSensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/MacroStressSensorHub.js) abgelöst).
* **Konkrete Schwellenwerte:**
  * **1. Chart-Bedingung:** `SPY < SMA 200` **UND** `SPY-Drawdown vom 252-Tage-Hoch >= 8.0 %` (`<= -8.0 %`).
  * **2. Mindestens eine Makro-Säule ROT:**
    * **Säule A (Schock-Panik):** `VIX >= 28.0`.
    * **Säule B (Kreditstress):** `Chicago Fed Stress Index > -0.20` **ODER** `High-Yield Spread > 4.0 %`.
    * **Säule C (Liquidität):** `Net Liquidity 8-Wochen-Delta < -5.0 %` **ODER** `Margin Debt Drawdown <= -5.0 %`.
  * **3. Anti-Whipsaw-Hysterese:** Nach dem Auslösen bleibt der Schutzschirm mindestens **15 Handelstage** (`minHoldingPeriodDays`) ununterbrochen verriegelt.

---

#### 19. [`SmartDumbMoneyBottomIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyBottomIndicator.js) – [`SmartDumbMoneyBottomIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyBottomIndicator.js)
* **Zweck:** Klassischer 3-Faktor-Boden-Sensor (jetzt als `@deprecated` markiert und durch [`MarketBottomSensorHub`](file:///D:/GitHub/CrashRadar/src/signals/hubs/MarketBottomSensorHub.js) abgelöst).
* **Konkrete Schwellenwerte:**
  * **`CRITICAL`:** Nur wenn **alle 3 Bedingungen gleichzeitig** erfüllt sind:
    1. **`VIX > 40`** (extreme Volatilität)
    2. **`AAII_Spread < -25 %`** (starke Retail-Pessimismus-Übermacht)
    3. **`DIX > 45 %`** (Wale akkumulieren im Dark Pool)

---

#### 20. [`BtcTrailingStopIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BtcTrailingStopIndicator.js) – [`BtcTrailingStopIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BtcTrailingStopIndicator.js)
* **Zweck:** Makro-Taktgeber für Bitcoin über den Trend von MicroStrategy (MSTR).
* **Konkrete Schwellenwerte:**
  * Vergleicht MSTR mit seinem **SMA 200**.
  * **`CRITICAL` (`BEAR_EXIT`, frischer Bruch):** `MSTR < SMA 200` **UND** `MSTR_gestern >= SMA 200` (Zyklustop innerhalb von 30–60 Tagen erwartet, Trailing-Stop für BTC sofort extrem eng ziehen).
  * **`WARNING`:** `MSTR < SMA 200` (Bärenmarkt-Klima aktiv).

---

#### 21. [`DarkPoolAccumulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DarkPoolAccumulationIndicator.js) – [`DarkPoolAccumulationIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DarkPoolAccumulationIndicator.js)
* **Zweck:** Atomarer Sensor für Wal-Akkumulation über den außerbörslichen Dark Index (DIX).
* **Konkrete Schwellenwerte:**
  * **`CRITICAL`:** Einzeltag **`DIX >= 48.0 %`** **ODER** 3-Tage-Durchschnitt **`avgDix >= 45.0 %`** (aggressive institutionelle Akkumulation).
  * **`WARNING`:** Einzeltag **`DIX >= 45.0 %`** (erhöhte Kaufaktivität).

---

#### 22. [`GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js) – [`GoldSniperIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js)
* **Zweck:** 4-Phasen-Orchestrierung für Gold-Hedge, Notausstieg vor Margin Calls und Re-Entry.
* **Konkrete Schwellenwerte:**
  * **Phase 1 (Hedge):** Katastrophen-Matrix schlägt an -> Signal `ALLOCATE_GOLD`.
  * **Phase 2 (Pre-Margin-Call Exit):** Wenn SPY-Drawdown vom Hoch **`-18.0 %` bis `-19.0 %`** (`exitDrawdownMin`) erreicht -> Signal `EXIT_GOLD_TO_CASH` (Gold verkaufen und Cash halten, bevor die Zwangsliquidierungswelle bei -20 % einsetzt).
  * **Phase 3 (Margin-Call Lock):** Wenn SPY-Drawdown **`<= -20.0 %`** (`marginCallThreshold`) -> Signal `HOLD_CASH`.
  * **Phase 4 (Re-Entry):** Signal `DEPLOY_CASH` wird nur freigegeben, wenn SPY-Drawdown mind. **`-18.0 %`** (`bottomDrawdownMin`) tief ist **UND** ein Boden-Sensor (`PanicCapitulation`, `DarkPool`, `VixSpikeCrush`) `CRITICAL` meldet.

---

#### 23. [`VixSpikeCrushIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/VixSpikeCrushIndicator.js) – [`VixSpikeCrushIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/VixSpikeCrushIndicator.js)
* **Zweck:** Erkennt den Volatilitätskollaps (Vol-Crush) nach Panikspitzen als starkes Einstiegssignal.
* **Konkrete Schwellenwerte:**
  * Ermittelt das 30-Tage-Maximum des VIX (`maxVix30`).
  * **`CRITICAL` (Kaufsignal):** `maxVix30 >= 40.0` **UND** aktueller VIX bricht um mindestens **20 %** ein (`aktueller VIX < maxVix30 * 0.80`).
  * **`WARNING`:** `maxVix30 >= 35.0` **UND** VIX bricht um **15 %** ein (`aktueller VIX < maxVix30 * 0.85`).

---

## Vorkommen der Indikator-Dateinamen in `.json`-, `.js`- und `.md`-Dateien

### Gesamtergebnis auf einen Blick

* **`.json`-Dateien:** **Keine**. Kein einziger der 23 ungenutzten Indikatoren ist mehr in einer JSON-Datei vorhanden.
* **`.js`-Dateien:** Jeder Indikator besitzt eine Testdatei in [`tests/analysis/indicators/`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/). Einige tauchen zusätzlich in Scratch-Forschungsskripten oder als verwaiste Imports in [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js) und [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js) auf.
* **`.md`-Dateien:** Sie werden in Dokumentationen in [`docs/`](file:///D:/GitHub/CrashRadar/docs/) erwähnt.

---

### Detaillierte Dateiliste je Indikator

#### 1. [`BitcoinDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinDivergenceIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/BitcoinDivergenceIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/BitcoinDivergenceIndicator.test.js)
* **`.md`:**
  * [`docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md)

---

#### 2. [`BitcoinSellingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BitcoinSellingClimaxIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/BitcoinSellingClimaxIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/BitcoinSellingClimaxIndicator.test.js)
* **`.md`:**
  * [`docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md)

---

#### 3. [`CryptoCycleDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoCycleDivergenceIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/CryptoCycleDivergenceIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/CryptoCycleDivergenceIndicator.test.js)
* **`.md`:**
  * [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)
  * [`docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md)

---

#### 4. [`CryptoPortfolioExitIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoPortfolioExitIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/CryptoPortfolioExitIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/CryptoPortfolioExitIndicator.test.js)
* **`.md`:**
  * [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)
  * [`docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md)

---

#### 5. [`DxyParabolicClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DxyParabolicClimaxIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/DxyParabolicClimaxIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/DxyParabolicClimaxIndicator.test.js)
* **`.md`:** *Keine*

---

#### 6. [`GdxBuyingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxBuyingClimaxIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`scratch/architecture/strategies/analyze_historical_gold_signals.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/analyze_historical_gold_signals.js)
  * [`scratch/architecture/strategies/summarize_gold_events.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/summarize_gold_events.js)
  * [`tests/analysis/indicators/GdxBuyingClimaxIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/GdxBuyingClimaxIndicator.test.js)
* **`.md`:** *Keine*

---

#### 7. [`GdxGoldDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxGoldDivergenceIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`scratch/architecture/strategies/analyze_historical_gold_signals.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/analyze_historical_gold_signals.js)
  * [`scratch/architecture/strategies/summarize_gold_events.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/summarize_gold_events.js)
  * [`tests/analysis/indicators/GdxGoldDivergenceIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/GdxGoldDivergenceIndicator.test.js)
* **`.md`:** *Keine*

---

#### 8. [`GdxSellingClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GdxSellingClimaxIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`scratch/architecture/strategies/analyze_historical_gold_signals.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/analyze_historical_gold_signals.js)
  * [`scratch/architecture/strategies/summarize_gold_events.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/summarize_gold_events.js)
  * [`scratch/research/strategies/DebugMarch2020.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/DebugMarch2020.js)
  * [`tests/analysis/indicators/GdxSellingClimaxIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/GdxSellingClimaxIndicator.test.js)
* **`.md`:** *Keine*

---

#### 9. [`GoldCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldCapitulationIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`scratch/architecture/strategies/analyze_historical_gold_signals.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/analyze_historical_gold_signals.js)
  * [`scratch/architecture/strategies/summarize_gold_events.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/summarize_gold_events.js)
  * [`tests/analysis/indicators/GoldCapitulationIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/GoldCapitulationIndicator.test.js)
* **`.md`:** *Keine*

---

#### 10. [`GoldVolumeClimaxIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldVolumeClimaxIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`scratch/architecture/strategies/analyze_historical_gold_signals.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/analyze_historical_gold_signals.js)
  * [`scratch/architecture/strategies/summarize_gold_events.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/summarize_gold_events.js)
  * [`scratch/research/strategies/DebugMarch2020.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/DebugMarch2020.js)
  * [`tests/analysis/indicators/GoldVolumeClimaxIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/GoldVolumeClimaxIndicator.test.js)
* **`.md`:** *Keine*

---

#### 11. [`MlRegimeRadarBtcIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarBtcIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/MlRegimeRadarBtcIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/MlRegimeRadarBtcIndicator.test.js)
* **`.md`:**
  * [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)
  * [`docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md)

---

#### 12. [`MlRegimeRadarCryptoIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarCryptoIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/MlRegimeRadarCryptoIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/MlRegimeRadarCryptoIndicator.test.js)
* **`.md`:** *Keine*

---

#### 13. [`MlRegimeRadarQqqIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarQqqIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/MlRegimeRadarQqqIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/MlRegimeRadarQqqIndicator.test.js)
* **`.md`:** *Keine*

---

#### 14. [`MlRegimeRadarSpyIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarSpyIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/MlRegimeRadarSpyIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/MlRegimeRadarSpyIndicator.test.js)
* **`.md`:** *Keine*

---

#### 15. [`TechCycleRadarIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TechCycleRadarIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`tests/analysis/indicators/TechCycleRadarIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/TechCycleRadarIndicator.test.js)
* **`.md`:** *Keine*

---

#### 16. [`BankReservesIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BankReservesIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`src/analysis/MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js)
  * [`tests/analysis/indicators/BankReservesIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/BankReservesIndicator.test.js)
* **`.md`:**
  * [`docs/research/DailyPortfolioCompass/ADR-008-LCLOR-Bankreserven-These.md`](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/ADR-008-LCLOR-Bankreserven-These.md)
  * [`docs/research/macro-proofs/Indikatoren-Grand-Prix-21-Jahre-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/Indikatoren-Grand-Prix-21-Jahre-Analyse.md)

---

#### 17. [`TgaIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/TgaIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`src/analysis/MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js)
  * [`tests/analysis/indicators/TgaIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/TgaIndicator.test.js)
  * [`tests/analysis/MacroRegimeEngine.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/MacroRegimeEngine.test.js)
* **`.md`:**
  * [`docs/research/macro-proofs/Indikatoren-Grand-Prix-21-Jahre-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/Indikatoren-Grand-Prix-21-Jahre-Analyse.md)

---

#### 18. [`KatastrophenMatrixIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/KatastrophenMatrixIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`src/analysis/MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js)
  * [`src/strategies/PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js)
  * [`src/analysis/indicators/GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js)
  * [`scratch/architecture/strategies/VerifyHubPerformanceEquivalence.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/VerifyHubPerformanceEquivalence.js)
  * [`scratch/research/strategies/InspectCorona2020.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/InspectCorona2020.js)
  * [`tests/analysis/indicators/KatastrophenMatrixIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/KatastrophenMatrixIndicator.test.js)
* **`.md`:**
  * [`docs/architecture/signals/Makrowetter-Audit-und-Refactoring.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signals/Makrowetter-Audit-und-Refactoring.md)
  * [`docs/research/strategies/GoldSpyDailyStressTest.md`](file:///D:/GitHub/CrashRadar/docs/research/strategies/GoldSpyDailyStressTest.md)

---

#### 19. [`SmartDumbMoneyBottomIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyBottomIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`src/analysis/MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js)
  * [`src/strategies/PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js)
  * [`scratch/architecture/strategies/SevenSlotGuruSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/SevenSlotGuruSimulation.js)
  * [`tests/analysis/indicators/SmartDumbMoneyBottomIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/SmartDumbMoneyBottomIndicator.test.js)
* **`.md`:**
  * [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)
  * [`docs/architecture/signals/Makrowetter-Audit-und-Refactoring.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signals/Makrowetter-Audit-und-Refactoring.md)
  * [`docs/architecture/strategies/guru-archive/7-Slot-Guru-Konsens-System-v2.1-Archive.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/guru-archive/7-Slot-Guru-Konsens-System-v2.1-Archive.md)

---

#### 20. [`BtcTrailingStopIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BtcTrailingStopIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`src/strategies/PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js)
  * [`tests/analysis/indicators/BtcTrailingStopIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/BtcTrailingStopIndicator.test.js)
* **`.md`:**
  * [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)
  * [`docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/MSTR-Krypto-Taktgeber-Analyse.md)

---

#### 21. [`DarkPoolAccumulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/DarkPoolAccumulationIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`src/analysis/MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js)
  * [`src/strategies/PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js)
  * [`src/analysis/indicators/GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js)
  * [`scratch/research/strategies/CompareTranches21Years.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/CompareTranches21Years.js)
  * [`scratch/research/strategies/DebugMarch2020.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/DebugMarch2020.js)
  * [`scratch/research/strategies/TestTrancheModels.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/TestTrancheModels.js)
  * [`tests/analysis/indicators/DarkPoolAccumulationIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/DarkPoolAccumulationIndicator.test.js)
* **`.md`:** *Keine*

---

#### 22. [`GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`src/analysis/MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js)
  * [`src/strategies/PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js)
  * [`src/analysis/indicators/SmartDumbMoneyBottomIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyBottomIndicator.js) *(in Kommentar)*
  * [`scratch/research/strategies/InspectCorona2020.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/InspectCorona2020.js)
  * [`scratch/research/strategies/TestTrancheModels.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/TestTrancheModels.js)
  * [`tests/analysis/indicators/GoldSniperIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/GoldSniperIndicator.test.js)
* **`.md`:**
  * [`docs/research/strategies/Corona2020DrawdownRootCauseAnalysis.md`](file:///D:/GitHub/CrashRadar/docs/research/strategies/Corona2020DrawdownRootCauseAnalysis.md)
  * [`docs/research/strategies/GoldSpyDailyStressTest.md`](file:///D:/GitHub/CrashRadar/docs/research/strategies/GoldSpyDailyStressTest.md)

---

#### 23. [`VixSpikeCrushIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/VixSpikeCrushIndicator.js)
* **`.json`:** *Keine*
* **`.js`:**
  * [`src/analysis/indicators/GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js)
  * [`scratch/research/strategies/DebugMarch2020.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/DebugMarch2020.js)
  * [`tests/analysis/indicators/VixSpikeCrushIndicator.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/indicators/VixSpikeCrushIndicator.test.js)
* **`.md`:** *Keine*
