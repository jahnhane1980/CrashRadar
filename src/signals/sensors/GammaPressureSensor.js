import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * GammaPressureSensor (Atomarer Leaf-Sensor)
 * 
 * Misst das Dealer-Gamma-Risiko und den Absicherungsdruck über:
 * - CBOE Total Put/Call Ratio (PCR)
 * - CBOE SKEW Index (Tail-Risk Nachfrage)
 * 
 * Wenn Institute panisch Puts kaufen (hohes PCR & hoher SKEW),
 * geraten Market Maker in eine "Short-Gamma" Position. Sie müssen fallende Kurse
 * durch zusätzliche Leerverkäufe hinterher-hedgen, was Kursstürze künstlich übertreibt.
 */
export class GammaPressureSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.pcrElevated = config.pcrElevated ?? 1.10;
    this.pcrExtreme = config.pcrExtreme ?? 1.30;
    this.skewElevated = config.skewElevated ?? 135.0;
    this.skewExtreme = config.skewExtreme ?? 145.0;
  }

  getId() {
    return 'GAMMA_PRESSURE_SENSOR';
  }

  getName() {
    return 'Dealer Gamma & Put/Call Hedging Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        pcr: null,
        skew: null,
        isShortGamma: false,
        isExtremeShortGamma: false,
        message: 'Keine Daten vorhanden'
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const rawPcr = currentDay.assets?.TotalPCR ?? currentDay.macroGroups?.SentimentRisk?.TotalPCR ?? currentDay.TotalPCR;
    const rawSkew = currentDay.assets?.SKEW ?? currentDay.macroGroups?.SentimentRisk?.SKEW ?? currentDay.SKEW;

    const pcr = rawPcr !== undefined && rawPcr !== null ? Number(rawPcr) : null;
    const skew = rawSkew !== undefined && rawSkew !== null ? Number(rawSkew) : null;

    if (pcr === null && skew === null) {
      return {
        status: SignalStatus.UNKNOWN,
        pcr: null,
        skew: null,
        isShortGamma: false,
        isExtremeShortGamma: false,
        message: 'Weder PCR noch SKEW verfügbar'
      };
    }

    const isPcrExtreme = pcr !== null && pcr >= this.pcrExtreme;
    const isPcrElevated = pcr !== null && pcr >= this.pcrElevated;

    const isSkewExtreme = skew !== null && skew >= this.skewExtreme;
    const isSkewElevated = skew !== null && skew >= this.skewElevated;

    const isExtremeShortGamma = (isPcrExtreme && isSkewElevated) || (isPcrElevated && isSkewExtreme) || (pcr !== null && pcr >= 1.50);
    const isShortGamma = isPcrElevated || isSkewElevated;

    let status = SignalStatus.OK;
    let message = 'Hedging-Aktivität im Normalbereich (Dealer in neutralem oder Long-Gamma).';

    if (isExtremeShortGamma) {
      status = SignalStatus.CRITICAL;
      message = `EXTREMES SHORT-GAMMA! PCR (${pcr?.toFixed(2) || 'N/A'}) und SKEW (${skew?.toFixed(1) || 'N/A'}) signalisieren massive Put-Überhänge. Dealer verstärken Abwärtsdochte mechanisch.`;
    } else if (isShortGamma) {
      status = SignalStatus.WARNING;
      message = `Erhöhte Absicherungsnachfrage (PCR: ${pcr?.toFixed(2) || 'N/A'}, SKEW: ${skew?.toFixed(1) || 'N/A'}). Markt nähert sich Short-Gamma.`;
    }

    return {
      status,
      pcr,
      skew,
      isShortGamma,
      isExtremeShortGamma,
      message
    };
  }
}
