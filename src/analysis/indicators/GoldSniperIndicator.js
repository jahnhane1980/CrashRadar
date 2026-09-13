import { MathUtils } from '../../utils/MathUtils.js';
import { KatastrophenMatrixIndicator } from './KatastrophenMatrixIndicator.js';
import { PanicCapitulationIndicator } from './PanicCapitulationIndicator.js';

/**
 * GoldSniperIndicator
 * 
 * Sensor für antizyklische Gold-Evakuierung, Pre-Margin-Call Gewinnsicherung und Bottom-Re-Entry:
 * 
 * 1. PHASE 1 (Gold-Hedge):
 *    - Sobald die 3-Säulen-Katastrophen-Matrix auslöst, schaltet der Indikator in den Hedge-Modus.
 *    - Signal: 'ALLOCATE_GOLD'
 *    - WICHTIG: Der Indikator gibt keine Prozentquoten vor (z. B. 50% vs. 75%).
 *      Die genaue Allokations-Aufteilung obliegt ausschließlich der jeweiligen Portfolio-Strategie!
 * 
 * 2. PHASE 2 (Pre-Margin-Call Exit bei -18% bis -19% SPY Drawdown):
 *    - Gold steigt in der Frühphase von Panik-Bärenmärkten als sicherer Hafen.
 *    - Ab ca. -20% S&P 500 Drawdown setzt jedoch die institutionelle Margin-Call-Kaskade ein,
 *      bei der liquide Gold-Positionen zwangsliquidiert werden.
 *    - Wenn der SPY-Drawdown vom Hochpunkt -18,0% bis -19,0% erreicht, feuert der Indikator:
 *    - Signal: 'EXIT_GOLD_TO_CASH' (Gewinne sichern, bevor der -20% Margin Call Liquidierungen erzwingt).
 * 
 * 3. PHASE 3 (Cash-Hold & Margin-Call Warnung):
 *    - Unterhalb von -20,0% SPY Drawdown: 'MARGIN_CALL_ACTIVE'.
 *    - Signal: 'HOLD_CASH' (Füße stillhalten, Cash-Airbag schützen).
 * 
 * 4. PHASE 4 (Generationen-Boden Re-Entry):
 *    - Schlägt der universelle Bottom-Sniper (PanicCapitulationIndicator: VIX >= 35, CBOE-Spike, RSI-Divergenz)
 *      am Panik-Tief an, feuert der Indikator:
 *    - Signal: 'DEPLOY_CASH' (Gezieltes Bereitstellen von Cash für Re-Entry in Tech, Aktien und Krypto).
 */
export class GoldSniperIndicator {
  constructor(config = {}, dependencies = {}) {
    this.name = 'Gold-Sniper (Pre-Margin-Call Exit & Bottom Re-Entry)';
    this.category = 'HEDGE_RADAR';

    this.benchmark = config.benchmark || 'SPY';
    this.goldAsset = config.goldAsset || 'GLD';
    this.exitDrawdownMin = config.exitDrawdownMin ?? -18.0; // Ab -18.0% SPY DD Gewinne sichern
    this.exitDrawdownMax = config.exitDrawdownMax ?? -19.0; // Spätestens bei -19.0% vor dem Margin Call
    this.marginCallThreshold = config.marginCallThreshold ?? -20.0; // Ab -20.0% akute Liquidierungswelle
    this.athLookback = config.athLookback || 252;

    this.katastrophenMatrix = dependencies.katastrophenMatrix || new KatastrophenMatrixIndicator(config.katastrophenMatrixConfig || {});
    this.panicCapitulation = dependencies.panicCapitulation || new PanicCapitulationIndicator();
  }

  evaluate(timeline, precalculated = {}) {
    if (!Array.isArray(timeline) || timeline.length < 200) {
      return {
        status: 'UNKNOWN',
        state: 'NORMAL',
        signal: 'NONE',
        isShieldActive: false,
        isGoldHedgeActive: false,
        isCashLockActive: false,
        isMarginCallActive: false,
        isBottomSniperActive: false,
        benchmark: this.benchmark,
        goldAsset: this.goldAsset,
        spyPrice: null,
        spyDrawdownPct: null,
        goldPrice: null,
        goldReturnDuringHedgePct: null,
        triggeredDate: null,
        goldExitDate: null,
        bottomSniperDate: null,
        daysInHedge: 0,
        value: 'DATA<200',
        message: 'Zu wenig Daten (< 200 Tage für Benchmark SMA 200)'
      };
    }

    const n = timeline.length;
    const currentDay = timeline[n - 1];
    const currentPrice = currentDay?.assets?.[this.benchmark];

    if (currentPrice === null || currentPrice === undefined || isNaN(Number(currentPrice))) {
      return {
        status: 'UNKNOWN',
        state: 'NORMAL',
        signal: 'NONE',
        isShieldActive: false,
        isGoldHedgeActive: false,
        isCashLockActive: false,
        isMarginCallActive: false,
        isBottomSniperActive: false,
        benchmark: this.benchmark,
        goldAsset: this.goldAsset,
        spyPrice: null,
        spyDrawdownPct: null,
        goldPrice: null,
        goldReturnDuringHedgePct: null,
        triggeredDate: null,
        goldExitDate: null,
        bottomSniperDate: null,
        daysInHedge: 0,
        value: 'NO_PRICE',
        message: `Fehlender oder ungültiger Preis für Benchmark ${this.benchmark}`
      };
    }

    // Bestimme Lookback für die State Machine
    const lookbackWindow = Math.min(n, Math.max(90, (this.katastrophenMatrix.minHoldingPeriodDays || 15) * 4));
    const startIdx = Math.max(199, n - lookbackWindow);

    let state = 'NORMAL';
    let signal = 'NONE';
    let isShieldActive = false;
    let isGoldHedgeActive = false;
    let isCashLockActive = false;
    let isMarginCallActive = false;
    let isBottomSniperActive = false;

    let triggeredDate = null;
    let goldExitDate = null;
    let bottomSniperDate = null;
    let goldEntryPrice = null;
    let daysInHedge = 0;

    for (let i = startIdx; i < n; i++) {
      const sliceUntilI = timeline.slice(0, i + 1);
      const day = timeline[i];
      const spyPriceAtI = day.assets?.[this.benchmark];
      const rawGoldAtI = day.assets?.[this.goldAsset] ?? day.assets?.Gold ?? day.assets?.GLD;
      const goldPriceAtI = rawGoldAtI !== undefined && rawGoldAtI !== null ? Number(rawGoldAtI) : null;

      // 1. Katastrophen-Matrix an Tag i
      let matrixRes;
      if (i === n - 1 && precalculated.katastrophenMatrix) {
        matrixRes = precalculated.katastrophenMatrix;
      } else {
        matrixRes = this.katastrophenMatrix.evaluate(sliceUntilI);
      }

      // 2. SPY Peak Drawdown an Tag i
      const ddLookback = Math.min(sliceUntilI.length, this.athLookback);
      const spyDdAtI = MathUtils.getDrawdownFromMax(sliceUntilI, t => t.assets?.[this.benchmark], ddLookback) ?? 0;

      // 3. Bottom Sniper an Tag i
      let bottomRes;
      if (i === n - 1 && precalculated.panicCapitulation) {
        bottomRes = precalculated.panicCapitulation;
      } else {
        bottomRes = this.panicCapitulation.evaluate(sliceUntilI);
      }
      const isBottomCrit = bottomRes && bottomRes.status === 'CRITICAL';

      // State-Machine Transitionen:
      if (matrixRes.isShieldActive) {
        isShieldActive = true;

        if (state === 'NORMAL') {
          // Neuer Eintritt in den Gold-Hedge
          state = 'HEDGE_ACTIVE';
          signal = 'ALLOCATE_GOLD';
          triggeredDate = day.date || `Day-${i}`;
          goldEntryPrice = goldPriceAtI;
          goldExitDate = null;
          bottomSniperDate = null;
          daysInHedge = 1;
        } else if (state === 'HEDGE_ACTIVE') {
          daysInHedge++;

          // Prüfung auf Bottom Sniper V-Umkehr (auch vor -18% möglich)
          if (isBottomCrit) {
            state = 'RE_ENTRY';
            signal = 'DEPLOY_CASH';
            bottomSniperDate = day.date || `Day-${i}`;
          }
          // Prüfung auf Erreichen der Pre-Margin-Call Schwelle (-18.0% bis -19.0%)
          else if (spyDdAtI <= this.exitDrawdownMin) {
            state = 'PRE_MARGIN_LOCK';
            signal = 'EXIT_GOLD_TO_CASH';
            goldExitDate = day.date || `Day-${i}`;
            isCashLockActive = true;
          } else {
            signal = 'ALLOCATE_GOLD';
          }
        } else if (state === 'PRE_MARGIN_LOCK' || state === 'MARGIN_CALL_ACTIVE') {
          // Wir sind bereits aus Gold in Cash gewechselt
          if (isBottomCrit) {
            state = 'RE_ENTRY';
            signal = 'DEPLOY_CASH';
            bottomSniperDate = day.date || `Day-${i}`;
          } else if (spyDdAtI <= this.marginCallThreshold) {
            state = 'MARGIN_CALL_ACTIVE';
            signal = 'HOLD_CASH';
            isMarginCallActive = true;
          } else {
            signal = 'HOLD_CASH';
          }
        } else if (state === 'RE_ENTRY') {
          // Nach Auslösen des Re-Entry Signals
          signal = 'DEPLOY_CASH';
        }
      } else {
        // Schutzschild der Katastrophen-Matrix ist inaktiv
        if (state !== 'NORMAL') {
          // Erholung oder Abschluss
          state = 'NORMAL';
          signal = 'NONE';
          isShieldActive = false;
          isGoldHedgeActive = false;
          isCashLockActive = false;
          isMarginCallActive = false;
          isBottomSniperActive = false;
          goldEntryPrice = null;
          daysInHedge = 0;
        }
      }
    }

    // Berechne Abschluss-Werte für den heutigen Tag (n - 1)
    const rawCurrentGold = currentDay?.assets?.[this.goldAsset] ?? currentDay?.assets?.Gold ?? currentDay?.assets?.GLD;
    const currentGoldPrice = rawCurrentGold !== undefined && rawCurrentGold !== null
      ? Number(rawCurrentGold)
      : null;

    let goldReturnDuringHedgePct = null;
    if (goldEntryPrice !== null && goldEntryPrice > 0 && currentGoldPrice !== null) {
      goldReturnDuringHedgePct = ((currentGoldPrice - goldEntryPrice) / goldEntryPrice) * 100;
    }

    // Finale Flags für den heutigen Zustand
    isGoldHedgeActive = (state === 'HEDGE_ACTIVE');
    isCashLockActive = (state === 'PRE_MARGIN_LOCK' || state === 'MARGIN_CALL_ACTIVE' || state === 'RE_ENTRY');
    isMarginCallActive = (state === 'MARGIN_CALL_ACTIVE');
    isBottomSniperActive = (state === 'RE_ENTRY');

    const ddLookback = Math.min(n, this.athLookback);
    const currentSpyDd = MathUtils.getDrawdownFromMax(timeline, t => t.assets?.[this.benchmark], ddLookback) ?? 0;

    let status = 'OK';
    let message = 'Normalbetrieb: Markt-Trend intakt & kein Gold-Hedge aktiv.';

    if (state === 'HEDGE_ACTIVE') {
      status = 'CRITICAL';
      const returnStr = goldReturnDuringHedgePct !== null ? ` (Gold-Rendite seit Einstieg: ${goldReturnDuringHedgePct >= 0 ? '+' : ''}${goldReturnDuringHedgePct.toFixed(2)}%)` : '';
      message = `🥇 GOLD-HEDGE AKTIV (Tag ${daysInHedge}): Katastrophen-Matrix hat ausgelöst. Signal: ALLOCATE_GOLD. SPY DD: ${currentSpyDd.toFixed(1)}%${returnStr}.`;
    } else if (state === 'PRE_MARGIN_LOCK') {
      status = 'CRITICAL';
      const returnStr = goldReturnDuringHedgePct !== null ? ` mit ${goldReturnDuringHedgePct >= 0 ? '+' : ''}${goldReturnDuringHedgePct.toFixed(2)}% Gold-Gewinn` : '';
      message = `💰 PRE-MARGIN-CALL GEWINNSICHERUNG! SPY Drawdown hat ${currentSpyDd.toFixed(1)}% erreicht (Schwelle ${this.exitDrawdownMin}%). Gold-Positionen${returnStr} jetzt glattstellen und in 100% Cash gehen VOR dem -20% Margin Call! Signal: ${signal}.`;
    } else if (state === 'MARGIN_CALL_ACTIVE') {
      status = 'CRITICAL';
      message = `⚠️ MARGIN-CALL KASKADE AKTIV! SPY Drawdown bei ${currentSpyDd.toFixed(1)}% (<= ${this.marginCallThreshold}%). Liquidierungswelle läuft. Cash eisern halten, kein Messer-Fangen. Signal: HOLD_CASH.`;
    } else if (state === 'RE_ENTRY') {
      status = 'CRITICAL';
      message = `🎯 GENERATIONEN-BODEN SNIPER! Bottom-Sniper hat angeschlagen. Signal: DEPLOY_CASH. Bereitgestelltes Cash jetzt antizyklisch in Tech, Aktien und Krypto investieren!`;
    }

    return {
      status,
      state,
      signal,
      isShieldActive,
      isGoldHedgeActive,
      isCashLockActive,
      isMarginCallActive,
      isBottomSniperActive,
      benchmark: this.benchmark,
      goldAsset: this.goldAsset,
      spyPrice: Number(currentPrice),
      spyDrawdownPct: currentSpyDd,
      goldPrice: currentGoldPrice,
      goldReturnDuringHedgePct,
      triggeredDate,
      goldExitDate,
      bottomSniperDate,
      daysInHedge,
      value: `STATE:${state}|SIGNAL:${signal}|SPY_DD:${currentSpyDd.toFixed(1)}%`,
      message
    };
  }
}
