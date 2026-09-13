import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';
import { MathUtils } from '../../utils/MathUtils.js';

/**
 * SpyTrendSensor (Atomarer Leaf-Sensor)
 * 
 * Misst den übergeordneten Aktien-Trend des S&P 500 (SPY):
 * - Kurs vs. 200-Tage-Linie (SMA 200)
 * - Drawdown vom 252-Tage-Hoch
 * - Chart-Trendbruch: SPY < SMA 200 UND Drawdown <= -8.0%
 * - Margin-Call-Zone: Drawdown <= -18.0% (Pre-Margin-Call Liquidierung)
 */
export class SpyTrendSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.smaPeriod = config.smaPeriod || 200;
    this.athLookback = config.athLookback || 252;
    this.chartBreakDrawdownThreshold = config.chartBreakDrawdownThreshold ?? -8.0;
    this.marginCallThreshold = config.marginCallThreshold ?? -18.0;
  }

  getId() {
    return 'SPY_TREND_SENSOR';
  }

  getName() {
    return 'S&P 500 Trend- & Drawdown-Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < this.smaPeriod) {
      return {
        status: SignalStatus.UNKNOWN,
        spyPrice: null,
        sma200: null,
        drawdownPct: null,
        isBelowSma200: false,
        isChartBreak: false,
        isMarginCallZone: false,
        message: `Zu wenig Daten (< ${this.smaPeriod} Tage)`
      };
    }

    const currentEntry = timeline[timeline.length - 1];
    const rawSpy = currentEntry?.assets?.SPY ?? currentEntry?.SPY;
    if (rawSpy === undefined || rawSpy === null) {
      return {
        status: SignalStatus.UNKNOWN,
        spyPrice: null,
        sma200: null,
        drawdownPct: null,
        isBelowSma200: false,
        isChartBreak: false,
        isMarginCallZone: false,
        message: 'Kein SPY-Kurs verfügbar'
      };
    }

    const spyPrice = Number(rawSpy);
    const sma200 = MathUtils.getSma(timeline, t => t.assets?.SPY ?? t.SPY, this.smaPeriod, 0);

    if (!sma200) {
      return {
        status: SignalStatus.UNKNOWN,
        spyPrice,
        sma200: null,
        drawdownPct: null,
        isBelowSma200: false,
        isChartBreak: false,
        isMarginCallZone: false,
        message: 'SMA 200 konnte nicht berechnet werden'
      };
    }

    // 252-Tage ATH
    let maxHigh = 0;
    const lookback = Math.min(timeline.length, this.athLookback);
    for (let i = timeline.length - lookback; i < timeline.length; i++) {
      const p = timeline[i]?.assets?.SPY ?? timeline[i]?.SPY;
      if (p !== undefined && p !== null && !isNaN(Number(p))) {
        if (Number(p) > maxHigh) maxHigh = Number(p);
      }
    }

    const drawdownPct = maxHigh > 0 ? ((spyPrice - maxHigh) / maxHigh) * 100 : 0;
    const roundedDd = Number(drawdownPct.toFixed(2));
    const isBelowSma200 = spyPrice < sma200;
    const isChartBreak = isBelowSma200 && (roundedDd <= this.chartBreakDrawdownThreshold);
    const isMarginCallZone = roundedDd <= this.marginCallThreshold;

    let status = SignalStatus.OK;
    let message = `SPY ($${spyPrice.toFixed(2)}) über SMA 200 ($${sma200.toFixed(2)}), DD: ${roundedDd}%.`;

    if (isMarginCallZone) {
      status = SignalStatus.CRITICAL;
      message = `Akute Margin-Call-Zone! SPY Drawdown: ${roundedDd}% (Schwelle <= ${this.marginCallThreshold}%).`;
    } else if (isChartBreak) {
      status = SignalStatus.WARNING;
      message = `Chart-Trendbruch! SPY unter SMA-200 mit ${Math.abs(roundedDd)}% Drawdown vom Hoch.`;
    } else if (isBelowSma200) {
      message = `SPY leicht unter SMA-200, aber Drawdown noch < 8%.`;
    }

    return {
      status,
      spyPrice: Number(spyPrice.toFixed(2)),
      sma200: Number(sma200.toFixed(2)),
      drawdownPct: roundedDd,
      isBelowSma200,
      isChartBreak,
      isMarginCallZone,
      message
    };
  }
}
