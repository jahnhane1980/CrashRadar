import { PortfolioStrategyInterface } from './PortfolioStrategyInterface.js';

/**
 * GoldSpyDcaStrategy
 * 
 * Quantitative Trend-Schild & Gold-Hedge-Strategie für dynamisches DCA im S&P 500.
 * 
 * REGELWERK (config/strategies/gold-spy.json v2.3.0):
 * 1. Normalbetrieb:
 *    - 100% S&P 500 DCA (SPY: 100.0%, CASH: 0.0%).
 * 2. 3-Säulen-Katastrophen-Matrix aktiv (isShieldActive):
 *    - Evakuierung in den Sweet Spot: 75% physisches Gold (GLD) / 25% Cash (USD).
 * 3. Pre-Margin-Call Exit (Gold-Sniper 'EXIT_GOLD_TO_CASH' bei -18% bis -19% SPY DD):
 *    - Glattstellung der Gold-Gewinne in 100% Cash (CASH: 100.0%, GLD: 0.0%, SPY: 0.0%).
 * 4. Asymmetrischer Re-Entry (30 / 40 / 30% Tranchen-Modell):
 *    - Tranche 1 (30% SPY / 70% Cash): Erster antizyklischer Einstieg bei autorisiertem DEPLOY_CASH (DD <= -18%).
 *    - Tranche 2 (+40% auf 70% SPY / 30% Cash): Wal-Einstieg via Dark Pools (DIX >= 48%) OR weiterer Dip >= 6% OR 12 Tage.
 *    - Tranche 3 (+30% auf 100% SPY / 0% Cash): Trendbestätigung (SPY > SMA 20) OR 12 Tage OR Katastrophen-Matrix inaktiv.
 */
export class GoldSpyDcaStrategy extends PortfolioStrategyInterface {
  constructor(config = {}) {
    super();
    this.manifest = config.manifest || PortfolioStrategyInterface.loadManifest('gold-spy');
    this.id = this.manifest.id || 'GOLD_SPY';
    this.name = this.manifest.name || 'Gold-SPY Dynamic DCA Portfolio';
    this.version = this.manifest.version || '2.3.0';

    this.activeMode = this.manifest.allocation_rules?.emergency_shield?.active_mode || 'gold_focused_mode';
    this.modes = this.manifest.allocation_rules?.emergency_shield?.allocation_options || {
      gold_focused_mode: { gold_gld_pct: 75.0, cash_usd_pct: 25.0 }
    };

    // Tranche State Machine
    this.trancheLevel = 0; // 0 = hedge/cash/normal; 1 = 30%, 2 = 70%, 3 = 100%
    this.daysInTranche = 0;
    this.t1SpyPrice = null;
    this.t1Date = null;

    this.lastEvaluation = null;
  }

  /**
   * Setzt den internen Tranchen-Status zurück (z.B. für Backtests oder neue Zyklen).
   */
  resetState() {
    this.trancheLevel = 0;
    this.daysInTranche = 0;
    this.t1SpyPrice = null;
    this.t1Date = null;
    this.lastEvaluation = null;
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  getVersion() {
    return this.version;
  }

  evaluateDaily(context) {
    const { date, marketData = {}, timeline = [], macroSignalContext = {} } = context;
    const todayStr = date || new Date().toISOString().split('T')[0];

    const km = macroSignalContext.katastrophenMatrix || {};
    const gs = macroSignalContext.goldSniper || {};
    const bs = macroSignalContext.bottomSniper || {};

    // Aktuellen SPY-Kurs und 20-Tage-SMA ermitteln (falls Timeline vorhanden)
    let currentSpyPrice = null;
    let sma20 = null;
    if (timeline && timeline.length > 0) {
      const lastDay = timeline[timeline.length - 1];
      currentSpyPrice = Number(lastDay?.assets?.SPY ?? marketData?.SPY);
      if (timeline.length >= 20) {
        let sum = 0;
        for (let i = timeline.length - 20; i < timeline.length; i++) {
          sum += Number(timeline[i]?.assets?.SPY || 0);
        }
        sma20 = sum / 20;
      }
    } else if (marketData?.SPY) {
      currentSpyPrice = Number(marketData.SPY);
    }

    const dpIsCritical = bs.darkPoolAccumulation?.status === 'CRITICAL' ||
                         (bs.darkPoolAccumulation?.currentDix >= 48.0);

    let status = 'NORMAL_DCA';
    let trancheAction = 'HOLD';
    let targetAllocationPct = { SPY: 100.0, GLD: 0.0, CASH: 0.0 };
    let reason = '100% S&P 500 DCA im Normalbetrieb, ungestörter Zinseszins.';

    // 1. Fail-Safe: Wenn Markt nach Re-Entry weiter kollabiert und Margincall auslöst
    const isMarginCall = (gs.signal === 'HOLD_CASH' && gs.state === 'MARGIN_CALL_ACTIVE') ||
                         (gs.signal === 'EXIT_GOLD_TO_CASH' || gs.state === 'PRE_MARGIN_LOCK');

    if (isMarginCall && gs.signal !== 'DEPLOY_CASH') {
      this.trancheLevel = 0;
      this.daysInTranche = 0;
      this.t1SpyPrice = null;
      this.t1Date = null;

      status = gs.state === 'MARGIN_CALL_ACTIVE' ? 'MARGIN_CALL_ACTIVE' : 'PRE_MARGIN_CASH_LOCK';
      trancheAction = gs.signal === 'EXIT_GOLD_TO_CASH' ? 'EXIT_GOLD_TO_CASH' : 'HOLD_CASH';
      targetAllocationPct = { SPY: 0.0, GLD: 0.0, CASH: 100.0 };
      reason = gs.state === 'MARGIN_CALL_ACTIVE'
        ? '⚠️ Margin-Call Kaskade im Gange (SPY <= -20%). Tranchen-Kauf pausiert, 100% Cash eisern halten.'
        : '💰 Pre-Margin-Call Gewinnsicherung (-18%/-19% SPY DD): Gold glattstellen und in 100% Cash wechseln!';
    }
    // 2. Re-Entry via 30 / 40 / 30% Asymmetrisches Tranchenmodell
    else if (gs.signal === 'DEPLOY_CASH' || this.trancheLevel > 0) {
      status = 'RE_ENTRY_SNIPER';

      if (this.trancheLevel === 0) {
        // Eintritt in Tranche 1 (30% SPY / 70% Cash)
        this.trancheLevel = 1;
        this.daysInTranche = 1;
        this.t1SpyPrice = currentSpyPrice;
        this.t1Date = todayStr;
      } else {
        this.daysInTranche++;
      }

      // Übergang von Tranche 1 -> Tranche 2 (Wal-Einstieg +40% -> 70% SPY)
      if (this.trancheLevel === 1) {
        const dropped6Pct = (this.t1SpyPrice && currentSpyPrice)
          ? ((currentSpyPrice - this.t1SpyPrice) / this.t1SpyPrice) <= -0.06
          : false;
        const reached12Days = this.daysInTranche >= 12;

        if (dpIsCritical || dropped6Pct || reached12Days) {
          this.trancheLevel = 2;
          this.daysInTranche = 1;
        }
      }

      // Übergang von Tranche 2 -> Tranche 3 (Trendbestätigung +30% -> 100% SPY)
      if (this.trancheLevel === 2) {
        const spyAboveSma20 = (sma20 && currentSpyPrice) ? currentSpyPrice > sma20 : false;
        const reached12DaysT2 = this.daysInTranche >= 12;
        const shieldOff = !km.isShieldActive;

        if (spyAboveSma20 || reached12DaysT2 || shieldOff) {
          this.trancheLevel = 3;
        }
      }

      // Allokation anhand des Tranchen-Levels zuweisen
      if (this.trancheLevel === 1) {
        trancheAction = 'BUY_TRANCHE_1';
        targetAllocationPct = { SPY: 30.0, GLD: 0.0, CASH: 70.0 };
        reason = '🎯 Re-Entry Tranche 1 (30% SPY): Erster antizyklischer Einstieg bei >= -18% SPY DD. 70% Cash verbleiben im Schutzschild.';
      } else if (this.trancheLevel === 2) {
        trancheAction = 'BUY_TRANCHE_2';
        targetAllocationPct = { SPY: 70.0, GLD: 0.0, CASH: 30.0 };
        reason = '🐋 Re-Entry Tranche 2 (+40% auf 70% SPY): Institutionelle Wal-Akkumulation / Panik-Dip. Weiterer Zukauf am Boden.';
      } else if (this.trancheLevel === 3) {
        trancheAction = 'BUY_TRANCHE_3';
        targetAllocationPct = { SPY: 100.0, GLD: 0.0, CASH: 0.0 };
        reason = '🚀 Re-Entry Tranche 3 (+30% auf 100% SPY): Trendbestätigung erfolgt. Vollständige Rückkehr in 100% S&P 500 DCA.';

        // Wenn der Schutzschild komplett erloschen ist, schaltet das System sauber zurück in Normalbetrieb
        if (!km.isShieldActive) {
          status = 'NORMAL_DCA';
          trancheAction = 'HOLD';
          reason = '100% S&P 500 DCA im Normalbetrieb, ungestörter Zinseszins.';
          this.trancheLevel = 0;
          this.daysInTranche = 0;
          this.t1SpyPrice = null;
          this.t1Date = null;
        }
      }
    }
    // 3. Katastrophen-Matrix Notfall-Hedge (75% Gold / 25% Cash Sweet Spot)
    else if (km.isShieldActive || gs.isGoldHedgeActive) {
      this.trancheLevel = 0;
      this.daysInTranche = 0;
      this.t1SpyPrice = null;
      this.t1Date = null;

      status = 'EMERGENCY_HEDGE';
      trancheAction = 'EVACUATE_HEDGE';

      const selectedOption = this.modes[this.activeMode] || this.modes.gold_focused_mode;
      const goldPct = selectedOption.gold_gld_pct ?? 75.0;
      const cashPct = selectedOption.cash_usd_pct ?? 25.0;

      targetAllocationPct = {
        SPY: 0.0,
        GLD: goldPct,
        CASH: cashPct
      };
      reason = `🚨 Katastrophen-Matrix aktiv: Evakuierung in den ${goldPct}/${cashPct} Gold/Cash Sweet Spot (Margin-Call Airbag).`;
    }
    // 4. Normalbetrieb (100% SPY)
    else {
      this.trancheLevel = 0;
      this.daysInTranche = 0;
      this.t1SpyPrice = null;
      this.t1Date = null;

      status = 'NORMAL_DCA';
      trancheAction = 'HOLD';
      targetAllocationPct = { SPY: 100.0, GLD: 0.0, CASH: 0.0 };
      reason = '100% S&P 500 DCA im Normalbetrieb, ungestörter Zinseszins.';
    }

    this.lastEvaluation = {
      date: todayStr,
      status,
      trancheAction,
      trancheLevel: this.trancheLevel,
      targetAllocationPct,
      reason
    };

    return this.lastEvaluation;
  }

  getSnapshot(date) {
    const todayStr = date || (this.lastEvaluation?.date) || new Date().toISOString().split('T')[0];
    const evalData = this.lastEvaluation || {
      status: 'NORMAL_DCA',
      trancheAction: 'HOLD',
      trancheLevel: 0,
      targetAllocationPct: { SPY: 100.0, GLD: 0.0, CASH: 0.0 },
      reason: 'Normalbetrieb'
    };

    return {
      strategy_id: this.id,
      name: this.name,
      version: this.version,
      snapshot_date: todayStr,
      status: evalData.status,
      tranche_action: evalData.trancheAction,
      tranche_level: evalData.trancheLevel ?? 0,
      target_allocation_pct: evalData.targetAllocationPct,
      savings_rate_allocation: evalData.targetAllocationPct,
      reason: evalData.reason
    };
  }
}
