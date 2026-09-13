import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';
import { MathUtils } from '../../utils/MathUtils.js';

/**
 * MstrLeadSensor (Atomarer Leaf-Sensor)
 * 
 * Misst rein die Relation von MicroStrategy (MSTR) zu seinem 200-Tage-Durchschnitt (SMA 200)
 * als empirisch bewiesenen Vorlauf-Taktgeber für Bitcoin-Liquidität.
 */
export class MstrLeadSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.smaPeriod = config.smaPeriod || 200;
  }

  getId() {
    return 'MSTR_LEAD_SENSOR';
  }

  getName() {
    return 'MSTR 200-Tage-Linie Taktgeber-Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < this.smaPeriod) {
      return {
        status: SignalStatus.UNKNOWN,
        isAboveSma200: false,
        isFreshBreak: false,
        isFreshCrossAbove: false,
        mstrPrice: null,
        mstrSma200: null,
        dropPct: null,
        message: `Zu wenig Daten (< ${this.smaPeriod} Tage)`
      };
    }

    const currentEntry = timeline[timeline.length - 1];
    const prevEntry = timeline[timeline.length - 2];
    const mstr = currentEntry?.assets?.MSTR ?? currentEntry?.MSTR ?? null;
    const prevMstr = prevEntry?.assets?.MSTR ?? prevEntry?.MSTR ?? null;

    const mstrSma200 = MathUtils.getSma(timeline, t => t.assets?.MSTR ?? t.MSTR, this.smaPeriod, 0);
    const prevMstrSma200 = MathUtils.getSma(timeline, t => t.assets?.MSTR ?? t.MSTR, this.smaPeriod, 1);

    if (!mstr || !mstrSma200 || !prevMstrSma200) {
      return {
        status: SignalStatus.UNKNOWN,
        isAboveSma200: false,
        isFreshBreak: false,
        isFreshCrossAbove: false,
        mstrPrice: mstr || null,
        mstrSma200: mstrSma200 || null,
        dropPct: null,
        message: 'Keine MSTR Daten verfügbar'
      };
    }

    const dropPct = ((mstr - mstrSma200) / mstrSma200) * 100;
    const roundedDropPct = Number(dropPct.toFixed(2));
    const isAboveSma200 = mstr >= mstrSma200;

    // Frischer Bruch nach unten (Death Cross)
    if (mstr < mstrSma200 && prevMstr >= prevMstrSma200) {
      return {
        status: SignalStatus.CRITICAL,
        signal: 'BEAR_EXIT',
        isAboveSma200: false,
        isFreshBreak: true,
        isFreshCrossAbove: false,
        mstrPrice: mstr,
        mstrSma200: mstrSma200,
        dropPct: roundedDropPct,
        message: `MSTR verliert SMA-200 (${roundedDropPct}%). Liquiditäts-Abriss.`
      };
    }

    // Anhaltend unter SMA 200
    if (mstr < mstrSma200) {
      return {
        status: SignalStatus.WARNING,
        signal: 'BEAR_EXIT',
        isAboveSma200: false,
        isFreshBreak: false,
        isFreshCrossAbove: false,
        mstrPrice: mstr,
        mstrSma200: mstrSma200,
        dropPct: roundedDropPct,
        message: `MSTR bleibt unter SMA-200 (${roundedDropPct}%).`
      };
    }

    // Kurs liegt über SMA 200
    const isFreshCrossAbove = prevMstr < prevMstrSma200;
    return {
      status: SignalStatus.OK,
      signal: 'BULL_HOLD',
      isAboveSma200: true,
      isFreshBreak: false,
      isFreshCrossAbove,
      mstrPrice: mstr,
      mstrSma200: mstrSma200,
      dropPct: roundedDropPct,
      message: `MSTR intakt über SMA-200 (+${roundedDropPct}%).`
    };
  }
}
