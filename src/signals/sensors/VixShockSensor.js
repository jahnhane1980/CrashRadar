import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * VixShockSensor (Atomarer Leaf-Sensor)
 * 
 * Misst Markt-Panik anhand des CBOE Volatilitätsindex (VIX).
 * Schwellen:
 * - >= 28.0: Schock-Panik (Säule A der Katastrophen-Matrix)
 * - >= 35.0: Extreme Kapitulation (Panik-Climax / Bottom-Finder)
 */
export class VixShockSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.shockThreshold = config.shockThreshold ?? 28.0;
    this.panicThreshold = config.panicThreshold ?? 35.0;
  }

  getId() {
    return 'VIX_SHOCK_SENSOR';
  }

  getName() {
    return 'CBOE VIX Volatilitäts-Schock Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        vix: null,
        isShock: false,
        isExtremePanic: false,
        message: 'Keine Daten vorhanden'
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const rawVix = currentDay?.assets?.VIX ?? currentDay?.VIX;
    if (rawVix === undefined || rawVix === null) {
      return {
        status: SignalStatus.UNKNOWN,
        vix: null,
        isShock: false,
        isExtremePanic: false,
        message: 'Kein VIX-Wert verfügbar'
      };
    }

    const vix = Number(rawVix);
    if (isNaN(vix)) {
      return {
        status: SignalStatus.UNKNOWN,
        vix: null,
        isShock: false,
        isExtremePanic: false,
        message: 'Ungültiger VIX-Wert'
      };
    }

    const isExtremePanic = vix >= this.panicThreshold;
    const isShock = vix >= this.shockThreshold;

    let status = SignalStatus.OK;
    let message = `VIX bei ${vix.toFixed(1)} (Ruhiger Markt)`;

    if (isExtremePanic) {
      status = SignalStatus.CRITICAL;
      message = `Extremer Panik-Climax! VIX bei ${vix.toFixed(1)} (>= ${this.panicThreshold}).`;
    } else if (isShock) {
      status = SignalStatus.WARNING;
      message = `Volatilitäts-Schock! VIX bei ${vix.toFixed(1)} (>= ${this.shockThreshold}).`;
    }

    return {
      status,
      vix: Number(vix.toFixed(2)),
      isShock,
      isExtremePanic,
      message
    };
  }
}
