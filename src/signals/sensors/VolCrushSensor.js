import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * VolCrushSensor (Atomarer Leaf-Sensor)
 * 
 * Erkennt den plötzlichen Kollaps der impliziten Volatilität (VIX-Crush),
 * der typischerweise nach VIX-Settlement oder Zinsentscheiden einsetzt.
 * 
 * Schwellen:
 * - 1-Tages-Delta VIX <= -1.5 Punkte ODER 3-Tages-Delta <= -3.0 Punkte: Volatilitäts-Kollaps aktiv
 */
export class VolCrushSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.crushDelta1d = config.crushDelta1d ?? -1.5;
    this.crushDelta3d = config.crushDelta3d ?? -3.0;
  }

  getId() {
    return 'VOL_CRUSH_SENSOR';
  }

  getName() {
    return 'Volatility Crush & Rebound Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        currentVix: null,
        vixDelta1d: null,
        vixDelta3d: null,
        isVolCrushing: false,
        message: 'Keine Timeline-Daten vorhanden'
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const rawVix = currentDay.assets?.VIX ?? currentDay.macro?.VIX ?? currentDay.VIX;

    if (rawVix === undefined || rawVix === null) {
      return {
        status: SignalStatus.UNKNOWN,
        currentVix: null,
        vixDelta1d: null,
        vixDelta3d: null,
        isVolCrushing: false,
        message: 'Kein aktueller VIX verfügbar'
      };
    }

    const currentVix = Number(rawVix);
    const prev1Day = timeline.length >= 2 ? timeline[timeline.length - 2] : null;
    const prev3Day = timeline.length >= 4 ? timeline[timeline.length - 4] : null;

    const prev1Vix = prev1Day ? Number(prev1Day.assets?.VIX ?? prev1Day.macro?.VIX ?? prev1Day.VIX) : null;
    const prev3Vix = prev3Day ? Number(prev3Day.assets?.VIX ?? prev3Day.macro?.VIX ?? prev3Day.VIX) : null;

    const delta1d = (prev1Vix !== null && !isNaN(prev1Vix)) ? (currentVix - prev1Vix) : null;
    const delta3d = (prev3Vix !== null && !isNaN(prev3Vix)) ? (currentVix - prev3Vix) : null;

    const isCrush1d = delta1d !== null && delta1d <= this.crushDelta1d;
    const isCrush3d = delta3d !== null && delta3d <= this.crushDelta3d;
    const isVolCrushing = isCrush1d || isCrush3d;

    let status = SignalStatus.OK;
    let message = `Volatilität stabil (VIX: ${currentVix.toFixed(2)}).`;

    if (isVolCrushing) {
      status = SignalStatus.CRITICAL; // Positiver Katalysator für Aktien!
      message = `VOLATILITY CRUSH AKTIV! VIX kollabiert (${delta1d !== null ? (delta1d.toFixed(2) + ' in 1d') : ''}${delta3d !== null ? (', ' + delta3d.toFixed(2) + ' in 3d') : ''}). Mechanischer Kaufdruck durch abnehmenden Hedging-Zwang!`;
    }

    return {
      status,
      currentVix,
      vixDelta1d: delta1d,
      vixDelta3d: delta3d,
      isVolCrushing,
      message
    };
  }
}
