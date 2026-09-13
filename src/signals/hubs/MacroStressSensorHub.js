import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus, MacroStressRegime } from '../contracts/SignalTypes.js';
import { SpyTrendSensor } from '../sensors/SpyTrendSensor.js';
import { VixShockSensor } from '../sensors/VixShockSensor.js';
import { CreditStressSensor } from '../sensors/CreditStressSensor.js';
import { MathUtils } from '../../utils/MathUtils.js';

/**
 * MacroStressSensorHub (Composite)
 * 
 * Aggregiert die 3-Säulen-Katastrophen-Matrix und die Margin-Call-Kaskade.
 * Emittiert rein deskriptive Markt-Zustände (KEINE bevormundenden Handelsbefehle!):
 * - NORMAL_EXPANSION: Makro-Klima und Aktien-Trend intakt.
 * - SYSTEMIC_STRESS: Trendbruch (SPY < SMA 200 & DD >= 8%) + mind. 1 Makro-Pfeiler ROT.
 * - LIQUIDATION_CASCADE: SPY Drawdown erreicht -18% bis -20% (akute Zwangsliquidierungen).
 * - PANIC_CAPITULATION: Panik-Boden erreicht, Verkäufer-Erschöpfung.
 */
export class MacroStressSensorHub extends SignalComponent {
  constructor(config = {}, dependencies = {}) {
    super();
    this.minHoldingPeriodDays = config.minHoldingPeriodDays || 15; // Anti-Whipsaw-Hysterese
    this.netLiqLookbackDays = config.netLiqLookbackDays || 40;
    this.marginDebtLookbackDays = config.marginDebtLookbackDays || 180;

    this.spyTrendSensor = dependencies.spyTrendSensor || new SpyTrendSensor(config.spyConfig || {});
    this.vixShockSensor = dependencies.vixShockSensor || new VixShockSensor(config.vixConfig || {});
    this.creditStressSensor = dependencies.creditStressSensor || new CreditStressSensor(config.creditConfig || {});
  }

  getId() {
    return 'MACRO_STRESS_SENSOR_HUB';
  }

  getName() {
    return 'Makro-Systemstress & Katastrophen-Sensor-Hub';
  }

  getComponentType() {
    return 'HUB';
  }

  evaluate(timeline, context = {}) {
    const smaPeriod = 200;
    if (!Array.isArray(timeline) || timeline.length < smaPeriod) {
      return {
        status: SignalStatus.UNKNOWN,
        regime: MacroStressRegime.UNKNOWN,
        isShieldActive: false,
        isMarginCallZone: false,
        isHysteresisActive: false,
        daysInAlarm: 0,
        message: 'Zu wenig Daten für Makrostress-Auswertung',
        diagnostics: {}
      };
    }

    const n = timeline.length;
    const benchmark = 'SPY';
    const athLookback = 252;
    const minAthDrawdownPct = 8.0;
    const vixShockThreshold = 28.0;
    const chicagoFedIndexThreshold = -0.20;
    const highYieldSpreadThreshold = 4.0;
    const netLiqDelta8wThreshold = -5.0;
    const netLiqLookbackDays = this.netLiqLookbackDays || 40;
    const marginDebtDrawdownThreshold = -5.0;
    const marginDebtLookbackDays = this.marginDebtLookbackDays || 180;

    const evaluateDay = (idx) => {
      const day = timeline[idx];
      if (!day) return null;
      const price = day?.assets?.[benchmark];
      if (price === null || price === undefined || isNaN(Number(price))) return null;

      const sliceUntilIdx = timeline.slice(0, idx + 1);
      const sma200 = MathUtils.getSma(sliceUntilIdx, t => t.assets?.[benchmark], smaPeriod, 0);
      const ddLookback = Math.min(sliceUntilIdx.length, athLookback);
      const ddPct = MathUtils.getDrawdownFromMax(sliceUntilIdx, t => t.assets?.[benchmark], ddLookback);

      const isBelowSma = sma200 !== null && price < sma200;
      const isDdBreached = ddPct !== null && ddPct <= -minAthDrawdownPct;
      const chartBreak = Boolean(isBelowSma && isDdBreached);

      const activePillars = [];
      const vix = day?.assets?.VIX !== undefined && day?.assets?.VIX !== null ? Number(day.assets.VIX) : null;
      if (vix !== null && !isNaN(vix) && vix >= vixShockThreshold) {
        activePillars.push(`Säule A: VIX Panik-Schock (${vix.toFixed(1)} >= ${vixShockThreshold})`);
      }

      const cfi = day?.macroGroups?.FinancialConditions?.ChicagoFedIndex !== undefined && day?.macroGroups?.FinancialConditions?.ChicagoFedIndex !== null
        ? Number(day.macroGroups.FinancialConditions.ChicagoFedIndex)
        : (day?.assets?.ChicagoFedIndex !== undefined && day?.assets?.ChicagoFedIndex !== null ? Number(day.assets.ChicagoFedIndex) : null);
      if (cfi !== null && !isNaN(cfi) && cfi > chicagoFedIndexThreshold) {
        activePillars.push(`Säule B: Kreditstress ChicagoFedIndex (${cfi.toFixed(2)} > ${chicagoFedIndexThreshold})`);
      }

      const hySpread = day?.macroGroups?.FinancialConditions?.HighYieldSpread !== undefined && day?.macroGroups?.FinancialConditions?.HighYieldSpread !== null
        ? Number(day.macroGroups.FinancialConditions.HighYieldSpread)
        : (day?.macroGroups?.YieldCurve?.BAMLH0A0HYM2 !== undefined && day?.macroGroups?.YieldCurve?.BAMLH0A0HYM2 !== null ? Number(day.macroGroups.YieldCurve.BAMLH0A0HYM2) : null);
      if (hySpread !== null && !isNaN(hySpread) && hySpread > highYieldSpreadThreshold) {
        activePillars.push(`Säule B: High-Yield Spread (${hySpread.toFixed(2)}% > ${highYieldSpreadThreshold}%)`);
      }

      let netLiqDelta8w = null;
      const curNl = day?.macroGroups?.NetLiquidity;
      if (curNl && curNl.WALCL !== undefined && curNl.WALCL !== null) {
        const curVal = Number(curNl.WALCL) - Number(curNl.TGA || 0) - Number(curNl.RRPONTSYD || 0);
        const pastIdx = Math.max(0, idx - netLiqLookbackDays);
        const pastNl = timeline[pastIdx]?.macroGroups?.NetLiquidity;
        if (pastNl && pastNl.WALCL !== undefined && pastNl.WALCL !== null) {
          const pastVal = Number(pastNl.WALCL) - Number(pastNl.TGA || 0) - Number(pastNl.RRPONTSYD || 0);
          if (pastVal !== 0) {
            netLiqDelta8w = ((curVal - pastVal) / Math.abs(pastVal)) * 100;
          }
        }
      }
      if (netLiqDelta8w !== null && netLiqDelta8w < netLiqDelta8wThreshold) {
        activePillars.push(`Säule C: NetLiq 8W-Entzug (${netLiqDelta8w.toFixed(1)}% < ${netLiqDelta8wThreshold}%)`);
      }

      const mdLookback = Math.min(sliceUntilIdx.length, marginDebtLookbackDays);
      const marginDebtDd = MathUtils.getDrawdownFromMax(sliceUntilIdx, t => t.macroGroups?.Leading?.MarginDebt, mdLookback);
      if (marginDebtDd !== null && marginDebtDd <= marginDebtDrawdownThreshold) {
        activePillars.push(`Säule C: Deleveraging Margin Debt DD (${marginDebtDd.toFixed(1)}% <= ${marginDebtDrawdownThreshold}%)`);
      }

      const hasMacroPillar = activePillars.length > 0;
      const fullAlarm = chartBreak && hasMacroPillar;

      return {
        date: day.date || `Day-${idx}`,
        price: Number(price),
        sma200,
        drawdownPct: ddPct,
        chartBreak,
        hasMacroPillar,
        fullAlarm,
        activePillars
      };
    };

    // Scan über das Hysterese-Fenster zur Bestimmung des Schutzschild-Zustands
    const lookbackWindow = Math.min(n, Math.max(60, this.minHoldingPeriodDays * 3));
    const startScanIdx = Math.max(smaPeriod - 1, n - lookbackWindow);

    let isShieldActive = false;
    let triggeredDate = null;
    let daysInAlarm = 0;

    for (let i = startScanIdx; i < n; i++) {
      const dayEval = evaluateDay(i);
      if (!dayEval) continue;

      if (dayEval.fullAlarm) {
        if (!isShieldActive) {
          isShieldActive = true;
          triggeredDate = dayEval.date;
          daysInAlarm = 0;
        } else {
          daysInAlarm++;
        }
      } else if (isShieldActive) {
        daysInAlarm++;
        if (daysInAlarm >= this.minHoldingPeriodDays && !dayEval.chartBreak && !dayEval.hasMacroPillar) {
          isShieldActive = false;
          triggeredDate = null;
          daysInAlarm = 0;
        }
      }
    }

    const currentEval = evaluateDay(n - 1);
    const isMarginCallZone = currentEval?.drawdownPct !== null && currentEval.drawdownPct <= -18.0;
    const isHysteresisActive = isShieldActive && !currentEval.fullAlarm && daysInAlarm < this.minHoldingPeriodDays;
    const bottomSignal = context.bottomSignal || context.bottomHubResult || null;

    // Bestimmung des deskriptiven Regimes
    let regime = MacroStressRegime.NORMAL_EXPANSION;
    let status = SignalStatus.OK;
    let message = 'Normalbetrieb: Makro-Klima und Aktienmarkt-Trend intakt.';

    if (bottomSignal?.status === SignalStatus.CRITICAL || bottomSignal?.isCritical || bottomSignal?.regime === 'CAPITULATION_CONFIRMED') {
      regime = MacroStressRegime.PANIC_CAPITULATION;
      status = SignalStatus.OK;
      message = 'Panik-Boden erreicht! Verkaufsdruck erschöpft. Marktwende imminent.';
    } else if (isMarginCallZone) {
      regime = MacroStressRegime.LIQUIDATION_CASCADE;
      status = SignalStatus.CRITICAL;
      message = `Liquidierungs-Kaskade! S&P 500 im tiefen Drawdown (${currentEval.drawdownPct?.toFixed(1)}%). Akuter Margin-Call-Druck.`;
    } else if (isShieldActive) {
      regime = MacroStressRegime.SYSTEMIC_STRESS;
      status = SignalStatus.CRITICAL;
      message = isHysteresisActive
        ? `Systemischer Stress: Schutzschirm in Mindesthaltedauer verriegelt (${daysInAlarm} Tage aktiv).`
        : `Systemischer Stress ausgelöst! Trendbruch mit Makro-Bestätigung: ${currentEval.activePillars.join(' | ')}.`;
    } else if (currentEval.chartBreak || currentEval.hasMacroPillar) {
      status = SignalStatus.WARNING;
      message = currentEval.chartBreak
        ? `Korrektur-Modus: SPY unter SMA200 (${currentEval.drawdownPct?.toFixed(1)}% DD), aber Makro stabil.`
        : `Makro-Warnung: ${currentEval.activePillars.join(' | ')}, aber Aktienmarkt-Trend intakt.`;
    }

    return {
      status,
      regime,
      isShieldActive,
      isMarginCallZone,
      isHysteresisActive,
      daysInAlarm,
      triggeredDate,
      message,
      diagnostics: {
        currentEval,
        activePillars: currentEval?.activePillars || [],
        spy: this.spyTrendSensor ? this.spyTrendSensor.evaluate(timeline) : null,
        vix: this.vixShockSensor ? this.vixShockSensor.evaluate(timeline) : null,
        credit: this.creditStressSensor ? this.creditStressSensor.evaluate(timeline) : null
      }
    };
  }
}
