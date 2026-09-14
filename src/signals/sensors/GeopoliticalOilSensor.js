import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * GeopoliticalOilSensor (Atomarer Leaf-Sensor)
 * 
 * Erkennt geopolitische Öl-Preisschocks und Stagflations-Divergenzen:
 * - Parabolische Öl-Rallye (WTI CL=F > 92 USD oder 30d-Sprung > 18%)
 * - Kupfer/Öl-Ratio (HG=F / CL=F): Schere zwischen realer Konjunktur (Kupfer) und Angebotsschock (Öl)
 */
export class GeopoliticalOilSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.oilWarningPrice = config.oilWarningPrice ?? 92.0; // 92 USD/bbl
    this.oilCriticalPrice = config.oilCriticalPrice ?? 100.0; // 100 USD/bbl Schmerzgrenze
    this.oilSpikeWarningPct = config.oilSpikeWarningPct ?? 18.0; // +18% in 30d
    this.oilSpikeCriticalPct = config.oilSpikeCriticalPct ?? 30.0; // +30% Panik-Spike
    this.copperOilRatioDropPct = config.copperOilRatioDropPct ?? -15.0; // -15% Schere in 60d
  }

  getId() {
    return 'GEOPOLITICAL_OIL_SENSOR';
  }

  getName() {
    return 'Geopolitischer Öl-Schock & Kupfer/Öl-Stagflations Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < 30) {
      return {
        status: SignalStatus.UNKNOWN,
        oilPrice: null,
        oilRoc30d: null,
        copperOilRatio: null,
        message: 'Zu wenig Daten für Öl-Sensor Auswertung'
      };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const past30 = timeline[Math.max(0, n - 30)];
    const past60 = timeline[Math.max(0, n - 60)];

    const curOil = currentDay.assets?.Oil ?? null;
    const pastOil30 = past30.assets?.Oil ?? curOil;
    const pastOil60 = past60.assets?.Oil ?? curOil;

    const curCopper = currentDay.assets?.Copper ?? null;
    const pastCopper60 = past60.assets?.Copper ?? curCopper;

    if (curOil === null) {
      return {
        status: SignalStatus.UNKNOWN,
        oilPrice: null,
        message: 'Ölpreis (CL=F) in Timeline nicht verfügbar'
      };
    }

    const oilRoc30d = pastOil30 ? ((curOil - pastOil30) / pastOil30) * 100 : 0;
    const curRatio = (curCopper && curOil) ? (curCopper / curOil) : null;
    const pastRatio = (pastCopper60 && pastOil60) ? (pastCopper60 / pastOil60) : curRatio;
    const ratioDelta60d = (curRatio && pastRatio) ? ((curRatio - pastRatio) / pastRatio) * 100 : 0;

    const isPriceCritical = curOil >= this.oilCriticalPrice;
    const isPriceWarning = curOil >= this.oilWarningPrice;
    const isSpikeCritical = oilRoc30d >= this.oilSpikeCriticalPct;
    const isSpikeWarning = oilRoc30d >= this.oilSpikeWarningPct;
    const isStagflationDivergence = ratioDelta60d <= this.copperOilRatioDropPct && isSpikeWarning;

    let status = SignalStatus.OK;
    let message = `Ölmarkt stabil ($${curOil.toFixed(2)}/bbl).`;

    if (isPriceCritical || isSpikeCritical || (isPriceWarning && isStagflationDivergence)) {
      status = SignalStatus.CRITICAL;
      message = `Akuter Öl-Schock! WTI: $${curOil.toFixed(2)} (+${oilRoc30d.toFixed(1)}% in 30d), Kupfer/Öl-Schere: ${ratioDelta60d.toFixed(1)}%`;
    } else if (isPriceWarning || isSpikeWarning || isStagflationDivergence) {
      status = SignalStatus.WARNING;
      message = `Geopolitischer Öl-Druck erhöht: WTI: $${curOil.toFixed(2)} (+${oilRoc30d.toFixed(1)}% in 30d)`;
    }

    return {
      status,
      oilPrice: Number(curOil.toFixed(2)),
      oilRoc30d: Number(oilRoc30d.toFixed(1)),
      copperOilRatio: curRatio !== null ? Number(curRatio.toFixed(4)) : null,
      ratioDelta60d: Number(ratioDelta60d.toFixed(1)),
      message,
      diagnostics: {
        curOil,
        curCopper,
        isPriceWarning,
        isPriceCritical,
        isSpikeWarning,
        isSpikeCritical,
        isStagflationDivergence
      }
    };
  }
}
