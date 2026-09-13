import { PortfolioStrategyInterface } from './PortfolioStrategyInterface.js';

/**
 * GoldSpyDcaStrategy
 * 
 * Quantitative Trend-Schild & Gold-Hedge-Strategie für dynamisches DCA im S&P 500.
 * 
 * REGELWERK (config/strategies/gold-spy.json):
 * 1. Normalbetrieb:
 *    - 100% S&P 500 DCA (SPY: 100.0%, CASH: 0.0%).
 * 2. 3-Säulen-Katastrophen-Matrix aktiv (isShieldActive):
 *    - Evakuierung in den Sweet Spot: 75% physisches Gold (GLD) / 25% Cash (USD).
 * 3. Pre-Margin-Call Exit (Gold-Sniper 'EXIT_GOLD_TO_CASH' bei -18% bis -19% SPY DD):
 *    - Glattstellung der Gold-Gewinne in 100% Cash (CASH: 100.0%, GLD: 0.0%, SPY: 0.0%).
 * 4. Antizyklischer Re-Entry (Bottom-Sniper 'DEPLOY_CASH'):
 *    - 100% Reinvestition des Cash-Puffers in das S&P 500 Mutterschiff (SPY: 100.0%).
 */
export class GoldSpyDcaStrategy extends PortfolioStrategyInterface {
  constructor(config = {}) {
    super();
    this.manifest = config.manifest || PortfolioStrategyInterface.loadManifest('gold-spy');
    this.id = this.manifest.id || 'GOLD_SPY';
    this.name = this.manifest.name || 'Gold-SPY Dynamic DCA Portfolio';
    this.version = this.manifest.version || '2.2.0';

    this.activeMode = this.manifest.allocation_rules?.emergency_shield?.active_mode || 'gold_focused_mode';
    this.modes = this.manifest.allocation_rules?.emergency_shield?.allocation_options || {
      gold_focused_mode: { gold_gld_pct: 75.0, cash_usd_pct: 25.0 }
    };

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
    const { date, macroSignalContext = {} } = context;
    const todayStr = date || new Date().toISOString().split('T')[0];

    const km = macroSignalContext.katastrophenMatrix || {};
    const gs = macroSignalContext.goldSniper || {};
    const bs = macroSignalContext.bottomSniper || {};

    let status = 'NORMAL_DCA';
    let trancheAction = 'HOLD';
    let targetAllocationPct = { SPY: 100.0, GLD: 0.0, CASH: 0.0 };
    let reason = '100% S&P 500 DCA im Normalbetrieb, ungestörter Zinseszins.';

    // 1. Priorität: Bottom Sniper Re-Entry Signal
    if (gs.signal === 'DEPLOY_CASH' || bs.isCritical) {
      status = 'RE_ENTRY_SNIPER';
      trancheAction = 'BUY_TRANCHE';
      targetAllocationPct = { SPY: 100.0, GLD: 0.0, CASH: 0.0 };
      reason = '🎯 Generationen-Boden Sniper aktiv! Cash-Reserven zu 100% antizyklisch in SPY reinvestieren.';
    }
    // 2. Priorität: Pre-Margin-Call Cash-Lock (SPY <= -18% bis -20%+)
    else if (gs.signal === 'EXIT_GOLD_TO_CASH' || gs.state === 'PRE_MARGIN_LOCK' || gs.state === 'MARGIN_CALL_ACTIVE') {
      status = gs.state === 'MARGIN_CALL_ACTIVE' ? 'MARGIN_CALL_ACTIVE' : 'PRE_MARGIN_CASH_LOCK';
      trancheAction = gs.signal === 'EXIT_GOLD_TO_CASH' ? 'EXIT_GOLD_TO_CASH' : 'HOLD_CASH';
      targetAllocationPct = { SPY: 0.0, GLD: 0.0, CASH: 100.0 };
      reason = gs.state === 'MARGIN_CALL_ACTIVE'
        ? '⚠️ Margin-Call Kaskade im Gange (SPY <= -20%). 100% Cash eisern halten, kein Messer-Fangen.'
        : '💰 Pre-Margin-Call Gewinnsicherung (-18%/-19% SPY DD): Gold glattstellen und in 100% Cash wechseln!';
    }
    // 3. Priorität: Katastrophen-Matrix Notfall-Hedge (Sweet Spot 75% Gold / 25% Cash)
    else if (km.isShieldActive || gs.isGoldHedgeActive) {
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

    this.lastEvaluation = {
      date: todayStr,
      status,
      trancheAction,
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
      target_allocation_pct: evalData.targetAllocationPct,
      savings_rate_allocation: evalData.targetAllocationPct,
      reason: evalData.reason
    };
  }
}
