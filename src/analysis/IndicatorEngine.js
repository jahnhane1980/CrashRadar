import fs from 'fs';
import path from 'path';
import { MathUtils } from '../utils/MathUtils.js';
import { BankReservesIndicator } from './indicators/BankReservesIndicator.js';
import { MaturityWallIndicator } from './indicators/MaturityWallIndicator.js';
import { TgaIndicator } from './indicators/TgaIndicator.js';
import { YieldCurveIndicator } from './indicators/YieldCurveIndicator.js';
import { SahmRuleIndicator } from './indicators/SahmRuleIndicator.js';
import { MarginDebtIndicator } from './indicators/MarginDebtIndicator.js';
import { ArccIndicator } from './indicators/ArccIndicator.js';
import { BitcoinDivergenceIndicator } from './indicators/BitcoinDivergenceIndicator.js';
import { CryptoCycleDivergenceIndicator } from './indicators/CryptoCycleDivergenceIndicator.js';
import { NfciIndicator } from './indicators/NfciIndicator.js';
import { GoldVolumeClimaxIndicator } from './indicators/GoldVolumeClimaxIndicator.js';
import { GdxSellingClimaxIndicator } from './indicators/GdxSellingClimaxIndicator.js';
import { GdxBuyingClimaxIndicator } from './indicators/GdxBuyingClimaxIndicator.js';
import { GdxGoldDivergenceIndicator } from './indicators/GdxGoldDivergenceIndicator.js';
import { RedAlertIndicator } from './indicators/RedAlertIndicator.js';
import { RateShockIndicator } from './indicators/RateShockIndicator.js';
import { HygDivergenceIndicator } from './indicators/HygDivergenceIndicator.js';
import { BizdIndicator } from './indicators/BizdIndicator.js';
import { BklnIndicator } from './indicators/BklnIndicator.js';
import { CbPolicyErrorIndicator } from './indicators/CbPolicyErrorIndicator.js';
import { CryptoPortfolioExitIndicator } from './indicators/CryptoPortfolioExitIndicator.js';
import { BtcTrailingStopIndicator } from './indicators/BtcTrailingStopIndicator.js';
import { PanicCapitulationIndicator } from './indicators/PanicCapitulationIndicator.js';
import { VixSpikeCrushIndicator } from './indicators/VixSpikeCrushIndicator.js';
import { GoldCapitulationIndicator } from './indicators/GoldCapitulationIndicator.js';
import { BitcoinSellingClimaxIndicator } from './indicators/BitcoinSellingClimaxIndicator.js';
import { TechCycleRadarIndicator } from './indicators/TechCycleRadarIndicator.js';
import { MlRegimeRadarSpyIndicator } from './indicators/MlRegimeRadarSpyIndicator.js';
import { MlRegimeRadarQqqIndicator } from './indicators/MlRegimeRadarQqqIndicator.js';
import { MlRegimeRadarBtcIndicator } from './indicators/MlRegimeRadarBtcIndicator.js';
import { MarketPanicCapitulationIndicator } from './indicators/MarketPanicCapitulationIndicator.js';
import { MlRegimeRadarMacroIndicator } from './indicators/MlRegimeRadarMacroIndicator.js';
import { MlRegimeRadarMacroIndicator } from './indicators/MlRegimeRadarMacroIndicator.js';
import { MlRegimeRadarCryptoIndicator } from './indicators/MlRegimeRadarCryptoIndicator.js';
import { NotificationManager } from '../services/NotificationManager.js';

export class IndicatorEngine {
  constructor(notificationConfig = { topics: {}, indicators: {} }, cycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21', dangerWindowStartDays: 970 } }) {
    this.notificationConfig = notificationConfig;
    this.cycleConfig = cycleConfig;

    const THRESHOLDS = {
      TOTRESNS_CRITICAL: 2800,
      TOTRESNS_WARNING: 3000,
      MW_CRITICAL: 21,
      MW_WARNING: 15,
      TGA_DIFF: 100,
      SAHM_CRITICAL: 0.50,
      NFCI_CRITICAL: 0,
      RATE_SHOCK_CRITICAL: 0.50,
      RATE_SHOCK_WARNING: 0.30,
      HYG_CRITICAL: -3.0,
      HYG_WARNING: -1.5,
      VIX_SPIKE: 40,
      VIX_WARNING: 35,
      VIX_CRUSH_PCT: 0.8,
      VIX_CRUSH_WARNING_PCT: 0.85,
      GOLD_BREAKOUT_PCT: 1.02,
      BIZD_CRITICAL: -5.0,
      BIZD_WARNING: -2.5,
      BKLN_CRITICAL: -2.0,
      BKLN_WARNING: -1.0,
      ARCC_INTEREST_GROWTH_CRITICAL: 15.0,
      ARCC_INTEREST_GROWTH_WARNING: 5.0,
      GOLD_CLIMAX_VOL_MULTIPLIER: 5.0,
      GOLD_CLIMAX_PRICE_DROP: -2.0,
      GOLD_CLIMAX_PRICE_RISE: 2.0,
      GDX_CLIMAX_VOL_MULTIPLIER: 3.0,
      GDX_CLIMAX_PRICE_DROP: -5.0,
      GDX_CLIMAX_PRICE_RISE: 5.0
    };

    this.indicators = [
      // 🟢 LEADING (Frühindikatoren)
      new BankReservesIndicator(),
      new MaturityWallIndicator(),
      new TgaIndicator(),
      new YieldCurveIndicator(),
      new SahmRuleIndicator(),
      new MarginDebtIndicator(),
      new ArccIndicator(),
      new BitcoinDivergenceIndicator(),
      new CryptoCycleDivergenceIndicator(),

      // 🟡 CONTEMPORANEOUS (Akut)
      new NfciIndicator(),
      new GoldVolumeClimaxIndicator(),
      new GdxSellingClimaxIndicator(),
      new GdxBuyingClimaxIndicator(),
      new GdxGoldDivergenceIndicator(),

      // 🔴 TRIGGER (Verkaufssignale)
      new RedAlertIndicator(),
      new RateShockIndicator(),
      new HygDivergenceIndicator(),
      new BizdIndicator(),
      new BklnIndicator(),
      new CbPolicyErrorIndicator(),

      new CryptoPortfolioExitIndicator(() => this.cycleConfig),
      new BtcTrailingStopIndicator(),

      // 🔵 TROUGH (Boden-Suche / Kaufsignale nach Crash)
      new PanicCapitulationIndicator(),
      new VixSpikeCrushIndicator(),
      new GoldCapitulationIndicator(),
      new BitcoinSellingClimaxIndicator(),
      new TechCycleRadarIndicator(),
      new MlRegimeRadarSpyIndicator(),
      new MlRegimeRadarQqqIndicator(),
      new MlRegimeRadarBtcIndicator(),
      new MarketPanicCapitulationIndicator(),
      new MlRegimeRadarMacroIndicator(),
      new MlRegimeRadarMacroIndicator(),
      new MlRegimeRadarCryptoIndicator()
    ];

    this.notificationManager = new NotificationManager(this.indicators, this.notificationConfig);
  }

  generateReport(groupedData, cleanText = false) {
    return this.notificationManager.generateReport(groupedData, cleanText);
  }

  run(groupedData) {
    // Console Log für die CLI mit Farben
    const report = this.generateReport(groupedData, false);
    // Wir entfernen das letzte \n vom report, da console.log eh eins anhängt
    console.log('\n' + report.trimEnd());
  }

  getAlerts(groupedData, alertHistory = {}, debounceDays = 14) {
    return this.notificationManager.getAlerts(groupedData, alertHistory, debounceDays);
  }

  getDailyStatusReport(groupedData) {
    return this.notificationManager.getDailyStatusReport(groupedData);
  }
}
