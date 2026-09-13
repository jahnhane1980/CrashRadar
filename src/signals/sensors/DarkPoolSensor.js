import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * DarkPoolSensor (Atomarer Leaf-Sensor)
 * 
 * Misst den SqueezeMetrics Dark Index (DIX) als Indikator für
 * außerbörsliche Wal-Akkumulation in Crash- und Konsolidierungsphasen.
 */
export class DarkPoolSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.thresholdStrong = config.thresholdStrong ?? 48.0;
    this.thresholdAccumulation = config.thresholdAccumulation ?? 45.0;
    this.avgDays = config.avgDays ?? 3;
  }

  getId() {
    return 'DARK_POOL_SENSOR';
  }

  getName() {
    return 'Dark Pool Wal-Akkumulations Sensor (DIX)';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        dix: null,
        avgDix: null,
        isWhaleBuying: false,
        message: 'Keine Daten vorhanden'
      };
    }

    const currentDay = timeline[timeline.length - 1];
    let rawDix = currentDay?.assets?.DIX ?? currentDay?.DIX;
    if (rawDix === undefined || rawDix === null) {
      return {
        status: SignalStatus.UNKNOWN,
        dix: null,
        avgDix: null,
        isWhaleBuying: false,
        message: 'Keine DIX-Daten im aktuellen Datensatz'
      };
    }

    let dix = Number(rawDix);
    if (isNaN(dix)) {
      return {
        status: SignalStatus.UNKNOWN,
        dix: null,
        avgDix: null,
        isWhaleBuying: false,
        message: 'Ungültige DIX-Daten'
      };
    }

    if (dix > 0 && dix <= 1) {
      dix = dix * 100;
    }

    // Rollierender Durchschnitt
    let sum = 0;
    let count = 0;
    const lookback = Math.min(timeline.length, this.avgDays);
    for (let i = timeline.length - lookback; i < timeline.length; i++) {
      let d = timeline[i]?.assets?.DIX ?? timeline[i]?.DIX;
      if (d !== undefined && d !== null) {
        let val = Number(d);
        if (val > 0 && val <= 1) val = val * 100;
        if (!isNaN(val)) {
          sum += val;
          count++;
        }
      }
    }
    const avgDix = count > 0 ? (sum / count) : dix;

    const isAggressiveWhale = dix >= this.thresholdStrong;
    const isMultiDayWhale = avgDix >= this.thresholdAccumulation;
    const isWhaleBuying = isAggressiveWhale || isMultiDayWhale;

    let status = SignalStatus.OK;
    let message = `DIX: ${dix.toFixed(1)}% (Normalbereich)`;

    if (isAggressiveWhale) {
      status = SignalStatus.CRITICAL;
      message = `Aggressive Wal-Akkumulation! DIX bei ${dix.toFixed(1)}% (Schwelle >= ${this.thresholdStrong}%).`;
    } else if (isMultiDayWhale) {
      status = SignalStatus.CRITICAL;
      message = `Mehrtägige Wal-Akkumulation! 3T-Schnitt: ${avgDix.toFixed(1)}% (Schwelle >= ${this.thresholdAccumulation}%).`;
    } else if (dix >= this.thresholdAccumulation) {
      status = SignalStatus.WARNING;
      message = `Erhöhte Wal-Aktivität im Dark Pool: ${dix.toFixed(1)}%.`;
    }

    return {
      status,
      dix: Number(dix.toFixed(2)),
      avgDix: Number(avgDix.toFixed(2)),
      isWhaleBuying,
      message
    };
  }
}
