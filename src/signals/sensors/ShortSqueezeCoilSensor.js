import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * ShortSqueezeCoilSensor (Atomarer Leaf-Sensor)
 * 
 * Misst die mechanische Federspannung für einen Short-Squeeze anhand des
 * FINRA SPY Short-Volume-Verhältnisses.
 * 
 * Schwellen:
 * - >= 55.0 %: Erhöhter Leerverkaufs-Anteil (Markt stark einseitig)
 * - >= 60.0 %: Extremes Leerverkaufs-Niveau (Squeeze-Pulverfass)
 */
export class ShortSqueezeCoilSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.elevatedThreshold = config.elevatedThreshold ?? 0.55;
    this.extremeThreshold = config.extremeThreshold ?? 0.60;
  }

  getId() {
    return 'SHORT_SQUEEZE_COIL_SENSOR';
  }

  getName() {
    return 'Short Squeeze Federspannungs-Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        shortVolumeRatio: null,
        isElevatedShorts: false,
        isExtremeShorts: false,
        message: 'Keine Daten vorhanden'
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const rawShort = currentDay.assets?.SPY_ShortVolumeRatio ?? 
                     currentDay.macroGroups?.SentimentRisk?.SPY_ShortVolumeRatio ?? 
                     currentDay.SPY_ShortVolumeRatio;

    if (rawShort === undefined || rawShort === null) {
      return {
        status: SignalStatus.UNKNOWN,
        shortVolumeRatio: null,
        isElevatedShorts: false,
        isExtremeShorts: false,
        message: 'Kein Short-Volume-Wert verfügbar'
      };
    }

    const shortRatio = Number(rawShort);
    if (isNaN(shortRatio)) {
      return {
        status: SignalStatus.UNKNOWN,
        shortVolumeRatio: null,
        isElevatedShorts: false,
        isExtremeShorts: false,
        message: 'Ungültiger Short-Volume-Wert'
      };
    }

    const isExtremeShorts = shortRatio >= this.extremeThreshold;
    const isElevatedShorts = shortRatio >= this.elevatedThreshold;

    let status = SignalStatus.OK;
    let message = `Short-Volumen im Normalbereich (${(shortRatio * 100).toFixed(1)} %).`;

    if (isExtremeShorts) {
      status = SignalStatus.CRITICAL;
      message = `MAXIMALE FEDERSPANNUNG! Short-Volumen bei ${(shortRatio * 100).toFixed(1)} % (>= ${(this.extremeThreshold * 100).toFixed(0)} %). Der Markt ist massiv über-gehedged. Hohes Squeeze-Potenzial!`;
    } else if (isElevatedShorts) {
      status = SignalStatus.WARNING;
      message = `Erhöhtes Leerverkaufsvolumen (${(shortRatio * 100).toFixed(1)} %). Bärenpositionen dominieren.`;
    }

    return {
      status,
      shortVolumeRatio: shortRatio,
      shortVolumePct: (shortRatio * 100).toFixed(1) + ' %',
      isElevatedShorts,
      isExtremeShorts,
      message
    };
  }
}
