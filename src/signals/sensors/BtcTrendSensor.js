import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * BtcTrendSensor (Atomarer Leaf-Sensor)
 * 
 * Misst den Bitcoin-Eigentrend anhand des 21-Wochen-Durchschnitts (147 Tage).
 */
export class BtcTrendSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.periodDays = config.periodDays || 147;
    this.minSamples = config.minSamples || 100;
  }

  getId() {
    return 'BTC_TREND_SENSOR';
  }

  getName() {
    return 'Bitcoin 21-Wochen-Trend Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < this.periodDays) {
      return {
        status: SignalStatus.UNKNOWN,
        trend: 'UNKNOWN',
        btcPrice: null,
        sma: null,
        message: `Zu wenig Daten (< ${this.periodDays} Tage)`
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const btcRaw = currentDay?.assets?.BTC ?? currentDay?.assets?.['BTC-USD'] ?? currentDay?.BTC ?? null;
    const btcPrice = btcRaw !== null ? Number(btcRaw) : null;

    if (btcPrice === null || isNaN(btcPrice)) {
      return {
        status: SignalStatus.UNKNOWN,
        trend: 'UNKNOWN',
        btcPrice: null,
        sma: null,
        message: 'Kein aktueller BTC-Preis vorhanden'
      };
    }

    let btcSum = 0;
    let count = 0;
    for (let i = timeline.length - this.periodDays; i < timeline.length; i++) {
      const p = timeline[i]?.assets?.BTC ?? timeline[i]?.assets?.['BTC-USD'] ?? timeline[i]?.BTC;
      if (p !== undefined && p !== null && !isNaN(Number(p))) {
        btcSum += Number(p);
        count++;
      }
    }

    if (count < this.minSamples) {
      return {
        status: SignalStatus.UNKNOWN,
        trend: 'UNKNOWN',
        btcPrice,
        sma: null,
        message: `Zu viele Datenlücken in den letzten ${this.periodDays} Tagen`
      };
    }

    const sma = btcSum / count;
    const isBull = btcPrice >= sma;

    return {
      status: isBull ? SignalStatus.OK : SignalStatus.WARNING,
      trend: isBull ? 'BULL' : 'BEAR',
      btcPrice: Number(btcPrice.toFixed(2)),
      sma: Number(sma.toFixed(2)),
      message: isBull 
        ? `BTC ($${btcPrice.toFixed(0)}) über 21W-EMA ($${sma.toFixed(0)})` 
        : `BTC ($${btcPrice.toFixed(0)}) unter 21W-EMA ($${sma.toFixed(0)})`
    };
  }
}
