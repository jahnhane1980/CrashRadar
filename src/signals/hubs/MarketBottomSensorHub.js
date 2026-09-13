import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus, BottomRegime } from '../contracts/SignalTypes.js';
import { VixShockSensor } from '../sensors/VixShockSensor.js';
import { DarkPoolSensor } from '../sensors/DarkPoolSensor.js';

/**
 * MarketBottomSensorHub (Composite)
 * 
 * Erkennt Generationen-Crash-Böden anhand von Markt-Physik (Options-Panik & Wal-Akkumulation),
 * ohne auf fehleranfällige RSI-Divergenzen in Wasserfall-Crashs hereinzufallen.
 */
export class MarketBottomSensorHub extends SignalComponent {
  constructor(config = {}, dependencies = {}) {
    super();
    this.vixSensor = dependencies.vixSensor || new VixShockSensor(config.vixConfig || {});
    this.darkPoolSensor = dependencies.darkPoolSensor || new DarkPoolSensor(config.darkPoolConfig || {});
  }

  getId() {
    return 'MARKET_BOTTOM_SENSOR_HUB';
  }

  getName() {
    return 'Markt-Boden & Kapitulations-Sensor-Hub';
  }

  getComponentType() {
    return 'HUB';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        regime: BottomRegime.UNKNOWN,
        isCritical: false,
        message: 'Keine Daten vorhanden',
        diagnostics: {}
      };
    }

    const vixRes = this.vixSensor.evaluate(timeline);
    const dixRes = this.darkPoolSensor.evaluate(timeline);

    const isExtremePanic = vixRes.isExtremePanic; // VIX >= 35
    const isWhaleAccumulation = dixRes.isWhaleBuying; // DIX >= 45% oder 48%

    // 1. Bestätigte Panik-Kapitulation (Panik + Wale saugen auf)
    if (isExtremePanic && isWhaleAccumulation) {
      return {
        status: SignalStatus.CRITICAL,
        regime: BottomRegime.CAPITULATION_CONFIRMED,
        isCritical: true,
        message: `GENERATIONEN-KAUFSIGNAL! Extremer Panik-Climax (VIX: ${vixRes.vix}) trifft auf aggressive Wal-Akkumulation im Dark Pool (DIX: ${dixRes.dix}%).`,
        diagnostics: { vix: vixRes, darkPool: dixRes }
      };
    }

    // 2. Bodenformierung (Eine von beiden Bedingungen leuchtet rot)
    if (isExtremePanic || isWhaleAccumulation) {
      return {
        status: SignalStatus.WARNING,
        regime: BottomRegime.BOTTOM_FORMING,
        isCritical: false,
        message: isExtremePanic 
          ? `Panik-Phase im Markt (VIX: ${vixRes.vix}), aber Dark Pool Wale zögern noch.`
          : `Starke Wal-Akkumulation (DIX: ${dixRes.dix}%), aber noch kein VIX-Panik-Climax.`,
        diagnostics: { vix: vixRes, darkPool: dixRes }
      };
    }

    return {
      status: SignalStatus.OK,
      regime: BottomRegime.NONE,
      isCritical: false,
      message: 'Kein Boden-Setup aktiv. Markt im Normalbereich.',
      diagnostics: { vix: vixRes, darkPool: dixRes }
    };
  }
}
