import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';
import { GeopoliticalOilSensor } from '../sensors/GeopoliticalOilSensor.js';
import { TransportationMarginSensor } from '../sensors/TransportationMarginSensor.js';

/**
 * GeopoliticalCostSensorHub (Composite Hub)
 * 
 * Aggregiert geopolitische Rohstoffschocks und reale Kostendivergenzen:
 * - Parabolische Öl-Rallye & Kupfer/Öl-Stagflationsschere
 * - Logistik- und Frachtkostenkompression (IYT vs. CL=F)
 */
export class GeopoliticalCostSensorHub extends SignalComponent {
  constructor(config = {}, dependencies = {}) {
    super();
    this.oilSensor = dependencies.oilSensor || new GeopoliticalOilSensor(config.oilConfig || {});
    this.transportSensor = dependencies.transportSensor || new TransportationMarginSensor(config.transportConfig || {});
    this.thresholdWarning = config.thresholdWarning ?? 45;
    this.thresholdCritical = config.thresholdCritical ?? 70;
  }

  getId() {
    return 'GEOPOLITICAL_COST_SENSOR_HUB';
  }

  getName() {
    return 'Geopolitischer Rohstoff- & Transportkosten-Hub';
  }

  getComponentType() {
    return 'HUB';
  }

  evaluate(timeline, context = {}) {
    if (!Array.isArray(timeline) || timeline.length < 30) {
      return {
        status: SignalStatus.UNKNOWN,
        stagflationPressureScore: null,
        message: 'Zu wenig Daten für Kosten-Hub Auswertung',
        diagnostics: {}
      };
    }

    const oilResult = this.oilSensor.evaluate(timeline);
    const transportResult = this.transportSensor.evaluate(timeline);

    let score = 0;
    if (oilResult.status === SignalStatus.CRITICAL) score += 55;
    else if (oilResult.status === SignalStatus.WARNING) score += 30;

    if (transportResult.status === SignalStatus.CRITICAL) score += 45;
    else if (transportResult.status === SignalStatus.WARNING) score += 25;

    const stagflationPressureScore = Math.min(100, score);
    const isCritical = stagflationPressureScore >= this.thresholdCritical;
    const isWarning = stagflationPressureScore >= this.thresholdWarning;

    let status = SignalStatus.OK;
    let message = 'Rohstoffpreise und Frachtmargen im normalen Konjunkturkorridor.';

    if (isCritical) {
      status = SignalStatus.CRITICAL;
      message = `Akuter Stagflations- und Kostendruck (Score: ${stagflationPressureScore}/100)! Öl-Schock & Fracht-Squeeze aktiv.`;
    } else if (isWarning) {
      status = SignalStatus.WARNING;
      message = `Erhöhte geopolitische Kostenbelastung (Score: ${stagflationPressureScore}/100). Vorsicht bei Margen.`;
    }

    return {
      status,
      stagflationPressureScore,
      message,
      diagnostics: {
        stagflationPressureScore,
        oilResult,
        transportResult
      }
    };
  }
}
