import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';
import { JapanCarryStressSensor } from '../sensors/JapanCarryStressSensor.js';
import { ChinaLiquiditySensor } from '../sensors/ChinaLiquiditySensor.js';

/**
 * GlobalLiquiditySensorHub (Composite Hub)
 * 
 * Aggregiert globale Liquiditätsströme jenseits der Fed:
 * - Japan Carry Trade Unwind (JGB Yield Spread & Yen-Schock)
 * - China FX-Stress & Kreditimpuls (USD/CNY)
 * - EZB-Bilanzsumme (ECBASSETSW) Delta
 * - US-Dollar Index (DXY) als globaler Liquiditäts-Staubsauger
 */
export class GlobalLiquiditySensorHub extends SignalComponent {
  constructor(config = {}, dependencies = {}) {
    super();
    this.japanCarrySensor = dependencies.japanCarrySensor || new JapanCarryStressSensor(config.japanConfig || {});
    this.chinaLiquiditySensor = dependencies.chinaLiquiditySensor || new ChinaLiquiditySensor(config.chinaConfig || {});
    this.thresholdWarning = config.thresholdWarning ?? 45;
    this.thresholdCritical = config.thresholdCritical ?? 70;
  }

  getId() {
    return 'GLOBAL_LIQUIDITY_SENSOR_HUB';
  }

  getName() {
    return 'Globaler Liquiditäts- & Notenbank-Hub (Japan, China, EZB, DXY)';
  }

  getComponentType() {
    return 'HUB';
  }

  evaluate(timeline, context = {}) {
    if (!Array.isArray(timeline) || timeline.length < 30) {
      return {
        status: SignalStatus.UNKNOWN,
        globalStressScore: null,
        message: 'Zu wenig Daten für globale Liquiditäts-Auswertung',
        diagnostics: {}
      };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const past30 = timeline[Math.max(0, n - 30)];
    const past60 = timeline[Math.max(0, n - 60)];

    // 1. Kind-Sensoren auswerten
    const japanResult = this.japanCarrySensor.evaluate(timeline);
    const chinaResult = this.chinaLiquiditySensor.evaluate(timeline);

    // 2. DXY Momentum (Dollar-Saugglocke)
    const curDxy = currentDay.macroGroups?.FinancialConditions?.DXY ?? null;
    const pastDxy = past30.macroGroups?.FinancialConditions?.DXY ?? curDxy;
    const dxyRoc30d = (curDxy && pastDxy) ? ((curDxy - pastDxy) / pastDxy) * 100 : 0;
    const isDxySucking = dxyRoc30d >= 3.0 || (curDxy !== null && curDxy >= 105.0);

    // 3. EZB Bilanz-Rückgang
    const curEcb = currentDay.macroGroups?.GlobalMacro?.EcbAssets ?? null;
    const pastEcb = past60.macroGroups?.GlobalMacro?.EcbAssets ?? curEcb;
    const ecbDeltaPct = (curEcb && pastEcb) ? ((curEcb - pastEcb) / pastEcb) * 100 : 0;
    const isEcbShrinking = ecbDeltaPct <= -2.0;

    // 4. Scoring (0 - 100)
    let score = 0;
    if (japanResult.status === SignalStatus.CRITICAL) score += 40;
    else if (japanResult.status === SignalStatus.WARNING) score += 20;

    if (chinaResult.status === SignalStatus.CRITICAL) score += 30;
    else if (chinaResult.status === SignalStatus.WARNING) score += 15;

    if (isDxySucking) score += 20;
    if (isEcbShrinking) score += 10;

    const globalStressScore = Math.min(100, score);
    const isCritical = globalStressScore >= this.thresholdCritical;
    const isWarning = globalStressScore >= this.thresholdWarning;

    let status = SignalStatus.OK;
    let message = 'Globale Liquiditätsbedingungen (Japan, China, EZB) neutral bis expansiv.';

    if (isCritical) {
      status = SignalStatus.CRITICAL;
      message = `Kritischer globaler Liquiditäts-Entzug (Score: ${globalStressScore}/100)! DXY: ${curDxy?.toFixed(1)}, Yen/China-Druck aktiv.`;
    } else if (isWarning) {
      status = SignalStatus.WARNING;
      message = `Erhöhter globaler Liquiditäts-Stress (Score: ${globalStressScore}/100). Wachsamkeit bei Cross-Border-Flüssen.`;
    }

    return {
      status,
      globalStressScore,
      message,
      diagnostics: {
        globalStressScore,
        japanResult,
        chinaResult,
        curDxy,
        dxyRoc30d: Number(dxyRoc30d.toFixed(1)),
        isDxySucking,
        ecbDeltaPct: Number(ecbDeltaPct.toFixed(1)),
        isEcbShrinking
      }
    };
  }
}
