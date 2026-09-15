import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus, DerivativesRegime } from '../contracts/SignalTypes.js';
import { OpexCalendarSensor } from '../sensors/OpexCalendarSensor.js';
import { GammaPressureSensor } from '../sensors/GammaPressureSensor.js';
import { ShortSqueezeCoilSensor } from '../sensors/ShortSqueezeCoilSensor.js';
import { VolCrushSensor } from '../sensors/VolCrushSensor.js';

/**
 * DerivativesSensorHub (Composite Hub)
 * 
 * Aggregiert deterministische Options- und Hexensabbat-Zyklen mit
 * dynamischen Derivate-Marktdaten (Put/Call Ratio, SKEW, Short-Volumen, VIX-Crush).
 * 
 * Emittiert rein deskriptive Markt-Regimes:
 * - EXTREME_SQUEEZE_COIL: Hexensabbat/OpEx + extremer Put/Short-Überhang (Bärenfalle / Squeeze-Potenzial)
 * - MILD_OPEX_PINNING: Normale Verfallswoche (Max-Pain Gravitation)
 * - VOL_CRUSH_REBOUND: VIX-Settlement erreicht + implizite Volatilität kollabiert
 * - POST_OPEX_EXPANSION: Folgewoche nach Verfall (Gamma-Klammer gelöst)
 * - NEUTRAL_FLOW: Außerhalb von Verfallsfenstern
 */
export class DerivativesSensorHub extends SignalComponent {
  constructor(config = {}, dependencies = {}) {
    super();
    this.calendarSensor = dependencies.calendarSensor || new OpexCalendarSensor(config.calendarConfig || {});
    this.gammaSensor = dependencies.gammaSensor || new GammaPressureSensor(config.gammaConfig || {});
    this.squeezeSensor = dependencies.squeezeSensor || new ShortSqueezeCoilSensor(config.squeezeConfig || {});
    this.volCrushSensor = dependencies.volCrushSensor || new VolCrushSensor(config.volCrushConfig || {});
  }

  getId() {
    return 'DERIVATIVES_SENSOR_HUB';
  }

  getName() {
    return 'Derivate-, OpEx- & Hexensabbat-Sensor-Hub';
  }

  getComponentType() {
    return 'HUB';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: SignalStatus.UNKNOWN,
        regime: DerivativesRegime.UNKNOWN,
        message: 'Keine Timeline-Daten vorhanden',
        guidance: 'Keine Daten zur Bewertung verfügbar.',
        diagnostics: {}
      };
    }

    const calRes = this.calendarSensor.evaluate(timeline);
    const gammaRes = this.gammaSensor.evaluate(timeline);
    const squeezeRes = this.squeezeSensor.evaluate(timeline);
    const volRes = this.volCrushSensor.evaluate(timeline);

    const isPreOrPinning = calRes.phase === 'PRE_OPEX_PRESSURE' || calRes.phase === 'WITCHING_PINNING';
    const isExtremePressure = gammaRes.isExtremeShortGamma || squeezeRes.isExtremeShorts;

    let regime = DerivativesRegime.NEUTRAL_FLOW;
    let status = SignalStatus.OK;
    let message = 'Regulärer Markttrend außerhalb von Derivate-Extremphasen.';
    let guidance = calRes.guidance || 'Der Markt folgt primär Makro- und Fundamentaldaten.';

    // 1. Post-OpEx Unpinning (Folgewoche nach Verfall)
    if (calRes.phase === 'POST_OPEX_UNPINNING') {
      regime = DerivativesRegime.POST_OPEX_EXPANSION;
      status = SignalStatus.OK;
      message = 'POST-OPEX EXPANSION AKTIV: Die Gamma-Klammer der Market Maker ist gelöst.';
      guidance = 'Gamma-Fessel weg! Aufgestauter Trend bricht sich Bahn. Gedeckelte Werte vollziehen oft kräftige Erleichterungsrallyes.';
    }
    // 2. VIX-Settlement oder akuter Volatilitäts-Kollaps
    else if (calRes.phase === 'VIX_CRUSH' || volRes.isVolCrushing) {
      regime = DerivativesRegime.VOL_CRUSH_REBOUND;
      status = SignalStatus.CRITICAL; // Hohe Relevanz als Rebound-Signal!
      message = 'VOLATILITY CRUSH AKTIV: VIX-Abrechnung eingeleitet / Implizite Volatilität bricht ein.';
      guidance = 'Das Angst-Ventil öffnet sich! Durch fallenden VIX müssen Market Maker Leerverkäufe eindecken. Wendepunkt-Potenzial für Rebounds.';
    }
    // 3. Maximale Federspannung (Pre-OpEx + extreme Absicherung/Shorts)
    else if (isPreOrPinning && isExtremePressure) {
      regime = DerivativesRegime.EXTREME_SQUEEZE_COIL;
      status = SignalStatus.CRITICAL;
      message = `MAXIMALE FEDERSPANNUNG! ${calRes.phaseLabel} trifft auf extremen Put- & Short-Überhang (PCR: ${gammaRes.pcr?.toFixed(2) || 'N/A'}, Short-Vol: ${squeezeRes.shortVolumePct || 'N/A'}).`;
      guidance = 'Dealer in massivem Short-Gamma. Stop-Fishing und künstliche Dochte abwarten – ideale konträre Einstiegszone vor dem Short-Squeeze!';
    }
    // 4. Reguläres Pinning (Verfallswoche, aber moderates Sentiment)
    else if (isPreOrPinning) {
      regime = DerivativesRegime.MILD_OPEX_PINNING;
      status = SignalStatus.WARNING;
      message = `${calRes.phaseLabel}: Normale Verfallswochen-Gravitation zu Max-Pain-Strikes.`;
      guidance = 'Kurse werden von Händlern an Schlüsselstrikes gebunden. Keine Ausbrüche vor Freitagabend überinterpretieren.';
    }

    return {
      status,
      regime,
      message,
      guidance,
      isQuadrupleWitching: calRes.isQuadrupleWitching,
      daysToOpEx: calRes.daysToOpEx,
      daysToVixSettlement: calRes.daysToVixSettlement,
      diagnostics: {
        calendar: calRes,
        gamma: gammaRes,
        squeeze: squeezeRes,
        volCrush: volRes
      }
    };
  }
}
