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
