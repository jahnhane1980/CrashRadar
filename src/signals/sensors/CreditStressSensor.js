import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * CreditStressSensor (Atomarer Leaf-Sensor)
 * 
 * Misst Stress im Kredit- und Bankensektor:
 * - High-Yield Option-Adjusted Spread (HYG/BAMLH0A0HYM2) > 4.0%
 * - Chicago Fed National Financial Conditions Index (NFCI / Credit Subindex) > -0.20
 */
export class CreditStressSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.highYieldThreshold = config.highYieldThreshold ?? 4.0;
    this.chicagoFedThreshold = config.chicagoFedThreshold ?? -0.20;
  }

  getId() {
    return 'CREDIT_STRESS_SENSOR';
  }

  getName() {
    return 'Kredit- & Solvenzstress Sensor (HY Spread & Chicago Fed)';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        isCreditStress: false,
        highYieldSpread: null,
        chicagoFedIndex: null,
        message: 'Keine Daten vorhanden'
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const rawHy = currentDay?.assets?.HighYieldSpread ?? currentDay?.macroGroups?.CreditStress?.HighYieldSpread;
    const rawNfci = currentDay?.assets?.ChicagoFedIndex ?? currentDay?.macroGroups?.CreditStress?.ChicagoFedIndex ?? currentDay?.assets?.NFCI;

    const hySpread = rawHy !== undefined && rawHy !== null ? Number(rawHy) : null;
    const nfci = rawNfci !== undefined && rawNfci !== null ? Number(rawNfci) : null;

    const isHyStressed = hySpread !== null && hySpread > this.highYieldThreshold;
    const isNfciStressed = nfci !== null && nfci > this.chicagoFedThreshold;
    const isCreditStress = isHyStressed || isNfciStressed;

    let status = SignalStatus.OK;
    let message = 'Kreditmärkte entspannt.';

    if (isCreditStress) {
      status = SignalStatus.CRITICAL;
      const reasons = [];
      if (isHyStressed) reasons.push(`HY-Spread: ${hySpread?.toFixed(2)}% (> ${this.highYieldThreshold}%)`);
      if (isNfciStressed) reasons.push(`Chicago Fed: ${nfci?.toFixed(2)} (> ${this.chicagoFedThreshold})`);
      message = `Kreditstress aktiv! ${reasons.join(', ')}`;
    }

    return {
      status,
      isCreditStress,
      highYieldSpread: hySpread !== null ? Number(hySpread.toFixed(2)) : null,
      chicagoFedIndex: nfci !== null ? Number(nfci.toFixed(2)) : null,
      message
    };
  }
}
