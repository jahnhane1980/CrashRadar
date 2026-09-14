import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * TransportationMarginSensor (Atomarer Leaf-Sensor)
 * 
 * Misst den Margen- und Kostendruck in der Logistikkette:
 * - Divergenz zwischen Rohöl (CL=F) und dem Transport-Sektor-ETF (IYT)
 * - Wenn Spritkosten explodieren, während Transportaktien abverkauft werden,
 *   signalisiert dies schwere Margenkompression in der Realwirtschaft.
 */
export class TransportationMarginSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.divergenceWarningThreshold = config.divergenceWarningThreshold ?? 20.0; // 20% Schere in 30d
    this.divergenceCriticalThreshold = config.divergenceCriticalThreshold ?? 35.0; // 35% extremer Kosten-Squeeze
  }

  getId() {
    return 'TRANSPORTATION_MARGIN_SENSOR';
  }

  getName() {
    return 'Transport & Frachtkosten Margen-Kompression Sensor (IYT vs. CL=F)';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < 30) {
      return {
        status: SignalStatus.UNKNOWN,
        divergence30d: null,
        message: 'Zu wenig Daten für Transport-Margen Auswertung'
      };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const past30 = timeline[Math.max(0, n - 30)];

    const curOil = currentDay.assets?.Oil ?? null;
    const pastOil = past30.assets?.Oil ?? curOil;

    const curIyt = currentDay.assets?.IYT ?? null;
    const pastIyt = past30.assets?.IYT ?? curIyt;

    if (curOil === null || curIyt === null) {
      return {
        status: SignalStatus.UNKNOWN,
        divergence30d: null,
        message: 'Öl (CL=F) oder Transport-ETF (IYT) nicht verfügbar'
      };
    }

    const oilRoc30d = pastOil ? ((curOil - pastOil) / pastOil) * 100 : 0;
    const iytRoc30d = pastIyt ? ((curIyt - pastIyt) / pastIyt) * 100 : 0;
    const divergence30d = oilRoc30d - iytRoc30d;

    const isWarning = divergence30d >= this.divergenceWarningThreshold && oilRoc30d > 5.0;
    const isCritical = divergence30d >= this.divergenceCriticalThreshold && oilRoc30d > 10.0;

    let status = SignalStatus.OK;
    let message = `Transport- und Frachtmargen im Gleichgewicht (Divergenz: ${divergence30d.toFixed(1)}%).`;

    if (isCritical) {
      status = SignalStatus.CRITICAL;
      message = `Kritischer Margen-Squeeze! Öl +${oilRoc30d.toFixed(1)}% vs. IYT ${iytRoc30d.toFixed(1)}% (Schere: ${divergence30d.toFixed(1)}%)`;
    } else if (isWarning) {
      status = SignalStatus.WARNING;
      message = `Erhöhter Kostendruck im Frachtsektor (Öl-IYT Schere: ${divergence30d.toFixed(1)}%)`;
    }

    return {
      status,
      divergence30d: Number(divergence30d.toFixed(1)),
      oilRoc30d: Number(oilRoc30d.toFixed(1)),
      iytRoc30d: Number(iytRoc30d.toFixed(1)),
      message,
      diagnostics: {
        curOil,
        curIyt,
        isWarning,
        isCritical
      }
    };
  }
}
