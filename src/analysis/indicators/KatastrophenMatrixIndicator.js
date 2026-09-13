import { MathUtils } from '../../utils/MathUtils.js';

/**
 * KatastrophenMatrixIndicator
 * 
 * Die 3-Säulen-Katastrophen-Matrix koppelt einen Chart-Trendbruch an 3 unabhängige Makro-Säulen:
 * 
 * 1. Chart-Bedingung: Benchmark (SPY) schließt unter SMA 200 UND weist mindestens 8,0% Drawdown vom Hoch auf.
 * 2. Mindestens eine Makro-Säule leuchtet ROT:
 *    - Säule A (Schock-Panik): VIX >= 28.0 (fängt exogene Black Swans wie Corona 2020 ab).
 *    - Säule B (Kredit- & Solvenzstress): Chicago Fed Index > -0.20 oder High-Yield Spread > 4.0% (fängt Krediteinbrüche wie 2008 ab).
 *    - Säule C (Liquiditäts-Entzug & Deleveraging): Net Liquidity 8W-Delta < -5.0% ODER FINRA Margin Debt DD <= -5.0%.
 * 3. Anti-Whipsaw-Hysterese: Nach Auslösen bleibt der Schutzschirm mindestens 15 Handelstage verriegelt,
 *    um Fehlsignale und Whipsaws im Bärenmarkt zu unterbinden.
 * 
 * Signal:
 * Gibt bei aktivem Katastrophen-Schutzschirm das reine Signal 'ALLOCATE_GOLD' aus.
 * Die individuelle Allokation (% Gold vs. % Cash) obliegt der jeweiligen Portfolio-Strategie.
 */
export class KatastrophenMatrixIndicator {
  constructor(config = {}) {
    this.name = '3-Säulen-Katastrophen-Matrix (System-Alarm & Trendbruch)';
    this.category = 'MACRO_SHIELD';

    // Konfigurierbare Parameter gemäß Manifesten (gold-spy.json / kamikaze-growth.json)
    this.benchmark = config.benchmark || 'SPY';
    this.smaPeriod = config.smaPeriod || 200;
    this.minAthDrawdownPct = config.minAthDrawdownPct ?? 8.0; // Drawdown >= 8% (d.h. <= -8.0%)
    this.athLookback = config.athLookback || 252; // 1 Handelsjahr (~252 Tage)
    this.minHoldingPeriodDays = config.minHoldingPeriodDays || 15; // Anti-Whipsaw-Hysterese

    // Schwellenwerte der 3 Makro-Säulen
    this.vixShockThreshold = config.vixShockThreshold || 28.0; // Säule A: Schock-Panik
    this.chicagoFedIndexThreshold = config.chicagoFedIndexThreshold ?? -0.20; // Säule B: Kredit- & Solvenzstress
    this.highYieldSpreadThreshold = config.highYieldSpreadThreshold || 4.0; // Säule B Ergänzung: HY Spread > 4.0%
    this.netLiqDelta8wThreshold = config.netLiqDelta8wThreshold ?? -5.0; // Säule C: 8-Wochen-Delta Net Liquidity < -5.0%
    this.marginDebtDrawdownThreshold = config.marginDebtDrawdownThreshold ?? -5.0; // Säule C: Margin Debt DD <= -5.0%
    this.netLiqLookbackDays = config.netLiqLookbackDays || 40; // ~8 Handelswochen (40 Handelstage)
    this.marginDebtLookbackDays = config.marginDebtLookbackDays || 180;
  }

  evaluate(timeline) {
    if (!Array.isArray(timeline) || timeline.length < this.smaPeriod) {
      return {
        status: 'UNKNOWN',
        signal: 'NONE',
        isShieldActive: false,
        isHysteresisActive: false,
        daysInAlarm: 0,
        triggeredDate: null,
        benchmark: this.benchmark,
        spyPrice: null,
        spySma200: null,
        spyDrawdownPct: null,
        chartBreak: false,
        activePillars: [],
        macroSensors: {},
        value: 'DATA<200',
        message: `Zu wenig Daten (< ${this.smaPeriod} Tage für SMA ${this.smaPeriod})`
      };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const currentPrice = currentDay?.assets?.[this.benchmark];

    if (currentPrice === null || currentPrice === undefined || isNaN(Number(currentPrice))) {
      return {
        status: 'UNKNOWN',
        signal: 'NONE',
        isShieldActive: false,
        isHysteresisActive: false,
        daysInAlarm: 0,
        triggeredDate: null,
        benchmark: this.benchmark,
        spyPrice: null,
        spySma200: null,
        spyDrawdownPct: null,
        chartBreak: false,
        activePillars: [],
        macroSensors: {},
        value: 'NO_PRICE',
        message: `Fehlender oder ungültiger Preis für Benchmark ${this.benchmark}`
      };
    }

    // Hilfsfunktion zur Auswertung eines einzelnen Tages index idx
    const evaluateDay = (idx) => {
      const day = timeline[idx];
      const price = day?.assets?.[this.benchmark];
      if (price === null || price === undefined || isNaN(Number(price))) return null;

      // 1. SMA 200 an Tag idx
      const sliceUntilIdx = timeline.slice(0, idx + 1);
      const sma200 = MathUtils.getSma(sliceUntilIdx, t => t.assets?.[this.benchmark], this.smaPeriod, 0);

      // 2. ATH / Peak Drawdown bis Tag idx
      const ddLookback = Math.min(sliceUntilIdx.length, this.athLookback);
      const ddPct = MathUtils.getDrawdownFromMax(sliceUntilIdx, t => t.assets?.[this.benchmark], ddLookback);

      const isBelowSma = sma200 !== null && price < sma200;
      const isDdBreached = ddPct !== null && ddPct <= -this.minAthDrawdownPct;
      const chartBreak = Boolean(isBelowSma && isDdBreached);

      // 3. Makro-Säulen
      const activePillars = [];

      // Säule A: Schock-Panik (VIX)
      const vix = day?.assets?.VIX !== undefined && day?.assets?.VIX !== null ? Number(day.assets.VIX) : null;
      if (vix !== null && !isNaN(vix) && vix >= this.vixShockThreshold) {
        activePillars.push(`Säule A: VIX Panik-Schock (${vix.toFixed(1)} >= ${this.vixShockThreshold})`);
      }

      // Säule B: Kredit- & Solvenzstress (Chicago Fed Index & HY Spreads)
      const cfi = day?.macroGroups?.FinancialConditions?.ChicagoFedIndex !== undefined && day?.macroGroups?.FinancialConditions?.ChicagoFedIndex !== null
        ? Number(day.macroGroups.FinancialConditions.ChicagoFedIndex)
        : (day?.assets?.ChicagoFedIndex !== undefined && day?.assets?.ChicagoFedIndex !== null ? Number(day.assets.ChicagoFedIndex) : null);
      if (cfi !== null && !isNaN(cfi) && cfi > this.chicagoFedIndexThreshold) {
        activePillars.push(`Säule B: Kreditstress ChicagoFedIndex (${cfi.toFixed(2)} > ${this.chicagoFedIndexThreshold})`);
      }

      const hySpread = day?.macroGroups?.FinancialConditions?.HighYieldSpread !== undefined && day?.macroGroups?.FinancialConditions?.HighYieldSpread !== null
        ? Number(day.macroGroups.FinancialConditions.HighYieldSpread)
        : (day?.macroGroups?.YieldCurve?.BAMLH0A0HYM2 !== undefined && day?.macroGroups?.YieldCurve?.BAMLH0A0HYM2 !== null ? Number(day.macroGroups.YieldCurve.BAMLH0A0HYM2) : null);
      if (hySpread !== null && !isNaN(hySpread) && hySpread > this.highYieldSpreadThreshold) {
        activePillars.push(`Säule B: High-Yield Spread (${hySpread.toFixed(2)}% > ${this.highYieldSpreadThreshold}%)`);
      }

      // Säule C: Liquiditäts-Entzug & Deleveraging
      // C1: Net Liquidity 8W Delta (WALCL - TGA - RRP)
      let netLiqDelta8w = null;
      const curNl = day?.macroGroups?.NetLiquidity;
      if (curNl && curNl.WALCL !== undefined && curNl.WALCL !== null) {
        const curVal = Number(curNl.WALCL) - Number(curNl.TGA || 0) - Number(curNl.RRPONTSYD || 0);
        const pastIdx = Math.max(0, idx - this.netLiqLookbackDays);
        const pastNl = timeline[pastIdx]?.macroGroups?.NetLiquidity;
        if (pastNl && pastNl.WALCL !== undefined && pastNl.WALCL !== null) {
          const pastVal = Number(pastNl.WALCL) - Number(pastNl.TGA || 0) - Number(pastNl.RRPONTSYD || 0);
          if (pastVal !== 0) {
            netLiqDelta8w = ((curVal - pastVal) / Math.abs(pastVal)) * 100;
          }
        }
      }
      if (netLiqDelta8w !== null && netLiqDelta8w < this.netLiqDelta8wThreshold) {
        activePillars.push(`Säule C: NetLiq 8W-Entzug (${netLiqDelta8w.toFixed(1)}% < ${this.netLiqDelta8wThreshold}%)`);
      }

      // C2: FINRA Margin Debt Drawdown
      const mdLookback = Math.min(sliceUntilIdx.length, this.marginDebtLookbackDays);
      const marginDebtDd = MathUtils.getDrawdownFromMax(sliceUntilIdx, t => t.macroGroups?.Leading?.MarginDebt, mdLookback);
      if (marginDebtDd !== null && marginDebtDd <= this.marginDebtDrawdownThreshold) {
        activePillars.push(`Säule C: Deleveraging Margin Debt DD (${marginDebtDd.toFixed(1)}% <= ${this.marginDebtDrawdownThreshold}%)`);
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
        activePillars,
        macroSensors: {
          vix,
          chicagoFedIndex: cfi,
          highYieldSpread: hySpread,
          netLiqDelta8w,
          marginDebtDd
        }
      };
    };

    // Scan über das Hysterese-Fenster zur Bestimmung des Schutzschild-Zustands
    const lookbackWindow = Math.min(n, Math.max(60, this.minHoldingPeriodDays * 3));
    const startScanIdx = Math.max(this.smaPeriod - 1, n - lookbackWindow);

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
        // Shield bleibt aktiv, solange minHoldingPeriodDays nicht erreicht sind (Anti-Whipsaw)
        // ODER solange der Chart-Bruch fortbesteht
        // ODER solange mindestens eine Makro-Säule rot leuchtet
        if (daysInAlarm >= this.minHoldingPeriodDays && !dayEval.chartBreak && !dayEval.hasMacroPillar) {
          isShieldActive = false;
          triggeredDate = null;
          daysInAlarm = 0;
        }
      }
    }

    const currentEval = evaluateDay(n - 1);
    const isHysteresisLock = isShieldActive && !currentEval.fullAlarm && daysInAlarm < this.minHoldingPeriodDays;

    let status = 'OK';
    let signal = 'NONE';
    let message = 'Normalbetrieb: Markt-Trend intakt & Makro-Umfeld stabil.';

    if (isShieldActive) {
      status = 'CRITICAL';
      signal = 'ALLOCATE_GOLD';
      if (currentEval.fullAlarm) {
        message = `🚨 KATASTROPHEN-ALARM AKTIV! Trendbruch (${this.benchmark} $${currentEval.price.toFixed(2)} < SMA200 $${currentEval.sma200.toFixed(2)}, DD ${currentEval.drawdownPct.toFixed(1)}%) bestätigt durch: ${currentEval.activePillars.join(' | ')}. Signal: ALLOCATE_GOLD.`;
      } else if (isHysteresisLock) {
        message = `🛡️ NOTFALL-SCHUTZSCHILD AKTIV (Anti-Whipsaw Hysterese Tag ${daysInAlarm}/${this.minHoldingPeriodDays}). Signal: ALLOCATE_GOLD.`;
      } else {
        message = `🛡️ NOTFALL-SCHUTZSCHILD AKTIV (Tag ${daysInAlarm}). Rest-Risiko aktiv: ${currentEval.activePillars.length > 0 ? currentEval.activePillars.join(' | ') : 'Chart noch nicht erholt'}. Signal: ALLOCATE_GOLD.`;
      }
    } else if (currentEval.chartBreak && !currentEval.hasMacroPillar) {
      status = 'WARNING';
      signal = 'MONITOR';
      message = `⚠️ KORREKTUR-MODUS: ${this.benchmark} schließt unter SMA200 mit ${currentEval.drawdownPct.toFixed(1)}% DD, aber alle Makro-Säulen sind GRÜN (Gesunde Korrektur, kein System-Alarm). Signal: MONITOR.`;
    } else if (!currentEval.chartBreak && currentEval.hasMacroPillar) {
      status = 'WARNING';
      signal = 'MONITOR';
      message = `⚠️ MAKRO-ALARM: ${currentEval.activePillars.join(' | ')}, aber Chart-Trend intakt (${this.benchmark} über SMA 200). Erhöhte Wachsamkeit. Signal: MONITOR.`;
    }

    return {
      status,
      signal,
      isShieldActive,
      isHysteresisActive: isHysteresisLock,
      daysInAlarm,
      triggeredDate,
      benchmark: this.benchmark,
      spyPrice: currentEval.price,
      spySma200: currentEval.sma200,
      spyDrawdownPct: currentEval.drawdownPct,
      chartBreak: currentEval.chartBreak,
      activePillars: currentEval.activePillars,
      macroSensors: currentEval.macroSensors,
      value: `SPY_DD:${currentEval.drawdownPct.toFixed(1)}%|Pillars:${currentEval.activePillars.length}`,
      message
    };
  }
}
