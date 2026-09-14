import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';

/**
 * JapanCarryStressSensor (Atomarer Leaf-Sensor)
 * 
 * Überwacht den globalen Yen-Carry-Trade & Zins-Spread:
 * - US-Japan 10Y Yield Spread (DGS10 - JGB 10Y) Kompression
 * - USD/JPY Währungs-Schock (starke Yen-Aufwertung zwingt Carry-Trades zur Liquidation)
 */
export class JapanCarryStressSensor extends SignalComponent {
  constructor(config = {}) {
    super();
    this.spreadCompressionThreshold = config.spreadCompressionThreshold ?? -0.40; // -40 bps Kompression in 60d
    this.jpySurgeThresholdPct = config.jpySurgeThresholdPct ?? -4.0; // -4% USD/JPY Rückgang in 20d (Yen erstarkt)
    this.jpyPanicThresholdPct = config.jpyPanicThresholdPct ?? -7.0; // -7% Yen-Schock
  }

  getId() {
    return 'JAPAN_CARRY_STRESS_SENSOR';
  }

  getName() {
    return 'Japan Carry Trade & JGB Yield Spread Sensor';
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < 20) {
      return {
        status: SignalStatus.UNKNOWN,
        usJapanSpread: null,
        spreadDelta60d: null,
        usdJpyRoc20d: null,
        message: 'Zu wenig Daten für Japan-Carry Auswertung'
      };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const past20 = timeline[Math.max(0, n - 20)];
    const past60 = timeline[Math.max(0, n - 60)];

    const curUs10y = currentDay.macroGroups?.YieldCurve?.Yield10y ?? null;
    const curJp10y = currentDay.macroGroups?.YieldCurve?.Japan10y ?? 0.8;
    const curUsdJpy = currentDay.macroGroups?.GlobalMacro?.UsdJpy ?? null;

    const pastUs10y = past60.macroGroups?.YieldCurve?.Yield10y ?? curUs10y;
    const pastJp10y = past60.macroGroups?.YieldCurve?.Japan10y ?? curJp10y;
    const pastUsdJpy = past20.macroGroups?.GlobalMacro?.UsdJpy ?? curUsdJpy;

    const curSpread = (curUs10y !== null && curJp10y !== null) ? (curUs10y - curJp10y) : null;
    const pastSpread = (pastUs10y !== null && pastJp10y !== null) ? (pastUs10y - pastJp10y) : null;
    const spreadDelta60d = (curSpread !== null && pastSpread !== null) ? (curSpread - pastSpread) : null;

    const usdJpyRoc20d = (curUsdJpy && pastUsdJpy) ? ((curUsdJpy - pastUsdJpy) / pastUsdJpy) * 100 : null;

    const isSpreadStressed = spreadDelta60d !== null && spreadDelta60d <= this.spreadCompressionThreshold;
    const isJpyUnwinding = usdJpyRoc20d !== null && usdJpyRoc20d <= this.jpySurgeThresholdPct;
    const isJpyPanic = usdJpyRoc20d !== null && usdJpyRoc20d <= this.jpyPanicThresholdPct;

    let status = SignalStatus.OK;
    let message = 'Yen-Carry-Trade ruhig und stabil.';

    if (isJpyPanic || (isSpreadStressed && isJpyUnwinding)) {
      status = SignalStatus.CRITICAL;
      message = `Akuter Yen-Carry Unwind! USD/JPY 20d: ${usdJpyRoc20d?.toFixed(1)}%, Spread-Delta 60d: ${((spreadDelta60d || 0) * 100).toFixed(0)} bps`;
    } else if (isSpreadStressed || isJpyUnwinding) {
      status = SignalStatus.WARNING;
      message = `Erhöhte Wachsamkeit im Japan-Carry: Spread-Delta: ${((spreadDelta60d || 0) * 100).toFixed(0)} bps, USD/JPY 20d: ${usdJpyRoc20d?.toFixed(1)}%`;
    }

    return {
      status,
      usJapanSpread: curSpread !== null ? Number(curSpread.toFixed(2)) : null,
      spreadDelta60d: spreadDelta60d !== null ? Number(spreadDelta60d.toFixed(2)) : null,
      usdJpyRoc20d: usdJpyRoc20d !== null ? Number(usdJpyRoc20d.toFixed(1)) : null,
      usdJpy: curUsdJpy,
      message,
      diagnostics: {
        curUs10y,
        curJp10y,
        isSpreadStressed,
        isJpyUnwinding,
        isJpyPanic
      }
    };
  }
}
