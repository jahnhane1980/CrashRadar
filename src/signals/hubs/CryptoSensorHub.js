import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus, CryptoRegime } from '../contracts/SignalTypes.js';
import { MstrLeadSensor } from '../sensors/MstrLeadSensor.js';
import { BtcTrendSensor } from '../sensors/BtcTrendSensor.js';

/**
 * CryptoSensorHub (Composite)
 * 
 * Orchestriert Krypto-Sensoren (MstrLeadSensor, BtcTrendSensor) und betreibt Sensor-Fusion.
 * Emittiert rein deskriptive Markt-Regimes für Krypto-Allokationen (Satellite, Kamikaze):
 * - BULL_EXPANSION: Makro-Liquidität & Trend intakt (HODL).
 * - BULL_WARNING: Schwungverlust / MSTR unter Trend, aber BTC noch stabil.
 * - BULL_CRITICAL: Akuter Vorlauf-Crash! MSTR verliert SMA-200 (Zyklus-Top Warnung).
 * - BEAR_REGIME: Krypto-Winter (MSTR & BTC beide unter Trendlinie).
 * - CYCLE_BOTTOM_CLOSE: Panik-Kapitulation / Generations-Boden erkannt.
 */
export class CryptoSensorHub extends SignalComponent {
  constructor(config = {}, dependencies = {}) {
    super();
    this.mstrSensor = dependencies.mstrSensor || new MstrLeadSensor(config.mstrConfig || {});
    this.btcTrendSensor = dependencies.btcTrendSensor || new BtcTrendSensor(config.btcTrendConfig || {});
  }

  getId() {
    return 'CRYPTO_SENSOR_HUB';
  }

  getName() {
    return 'Krypto Makro- & Zyklus-Sensor-Hub';
  }

  getComponentType() {
    return 'HUB';
  }

  evaluate(timeline, context = {}) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        regime: CryptoRegime.UNKNOWN,
        message: 'Keine Daten für Krypto-Auswertung vorhanden',
        diagnostics: {}
      };
    }

    const mstrRes = this.mstrSensor.evaluate(timeline);
    const btcTrendRes = this.btcTrendSensor.evaluate(timeline);
    const bottomSignal = context.bottomSignal || context.bottomHubResult || null;

    // 1. Generations-Boden (Cycle Bottom)
    if (bottomSignal?.status === SignalStatus.CRITICAL || bottomSignal?.isCritical) {
      return {
        status: SignalStatus.OK,
        regime: CryptoRegime.CYCLE_BOTTOM_CLOSE,
        message: 'Generations-Kaufgelegenheit / Panik-Boden erkannt. Re-Entry vorbereiten.',
        diagnostics: { mstr: mstrRes, btcTrend: btcTrendRes }
      };
    }

    // Wenn keine MSTR-Daten vorhanden sind -> Fallback auf reinen BTC-Trend
    if (mstrRes.status === SignalStatus.UNKNOWN) {
      if (btcTrendRes.status === SignalStatus.UNKNOWN) {
        return {
          status: SignalStatus.UNKNOWN,
          regime: CryptoRegime.UNKNOWN,
          message: 'Weder MSTR- noch BTC-Trenddaten verfügbar',
          diagnostics: { mstr: mstrRes, btcTrend: btcTrendRes }
        };
      }
      const isBull = btcTrendRes.trend === 'BULL';
      return {
        status: isBull ? SignalStatus.OK : SignalStatus.WARNING,
        regime: isBull ? CryptoRegime.BULL_EXPANSION : CryptoRegime.BEAR_REGIME,
        message: `Krypto-Regime (Fallback ohne MSTR): BTC ${btcTrendRes.trend}`,
        diagnostics: { mstr: mstrRes, btcTrend: btcTrendRes }
      };
    }

    // 2. Akuter Top-Alarm (Fresh Death Cross bei MSTR)
    if (mstrRes.isFreshBreak) {
      return {
        status: SignalStatus.CRITICAL,
        regime: CryptoRegime.BULL_CRITICAL,
        message: 'ALARM: MSTR verliert heute die 200-Tage-Linie! Struktureller Liquiditäts-Abriss. Zyklus-Top voraus.',
        diagnostics: { mstr: mstrRes, btcTrend: btcTrendRes }
      };
    }

    // 3. Voller Bärenmarkt (MSTR bleibt unter SMA 200 UND BTC unter 21W-EMA)
    if (!mstrRes.isAboveSma200 && btcTrendRes.trend === 'BEAR') {
      return {
        status: SignalStatus.CRITICAL,
        regime: CryptoRegime.BEAR_REGIME,
        message: 'Krypto-Winter aktiv. MSTR und BTC beide unter ihren langfristigen Trendlinien.',
        diagnostics: { mstr: mstrRes, btcTrend: btcTrendRes }
      };
    }

    // 4. Warnung (MSTR unter SMA 200, aber BTC hält sich noch über Wasser ODER umgekehrt)
    if (!mstrRes.isAboveSma200 || btcTrendRes.trend === 'BEAR') {
      return {
        status: SignalStatus.WARNING,
        regime: CryptoRegime.BULL_WARNING,
        message: 'Divergenz: MSTR oder BTC schwächeln. Erhöhte Wachsamkeit im Krypto-Sektor.',
        diagnostics: { mstr: mstrRes, btcTrend: btcTrendRes }
      };
    }

    // 5. Normaler Bullenmarkt (Beide im Aufwärtstrend)
    return {
      status: SignalStatus.OK,
      regime: CryptoRegime.BULL_EXPANSION,
      message: 'Krypto-Bullenmarkt intakt. MSTR und BTC beide stabil über ihren Trendlinien.',
      diagnostics: { mstr: mstrRes, btcTrend: btcTrendRes }
    };
  }
}
