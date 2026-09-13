import { PortfolioStrategyInterface } from './PortfolioStrategyInterface.js';

/**
 * KamikazeGrowthStrategy
 * 
 * Reales Echtgeld-Flaggschiff (~94.000 $ Realdepot) für High-Beta Wachstumsaktien,
 * Krypto-Equities und antizyklische Zündfunken-Einstiege.
 * 
 * KERN-ARCHITEKTUR & REGELN (config/strategies/kamikaze-growth.json):
 * 1. Broker-Live-Sync & Discretionary Override:
 *    - Reale Kontoführung (free_usd, pending_orders, Positionsgrößen) überschreibt theoretische Modelle.
 *    - Für externe Nutzer auf Telegram strikt Read-Only (kein Bot-Sparplan).
 * 2. Spezifische Asset-Klassifizierung:
 *    - LASTING_HOLD (z. B. PLTR, AIRO): Generational Monopolies sind 100% IMMUN gegen Makro-Ausstiege
 *      und werden bei Katastrophen-Alarm NIEMALS liquidiert!
 *    - CYCLICAL_TECH & CRYPTO_EQUITIES (z. B. MSTR, NVTS): Werden im Makro-Alarm selektiv
 *      in den Hedge-Pool (50% Gold / 50% Cash) evakuiert.
 * 3. Dynamischer Zündfunken-Pool:
 *    - 35% des tatsächlich freien Kapitals (free_usd) stehen als scharfe Munition für Stage-2-Ausbrüche bereit.
 * 4. Pre-Margin-Call Exit & Bottom Re-Entry:
 *    - Bei -18% bis -19% SPY Drawdown: Gold-Hedge glattstellen in 100% Cash.
 *    - Bei Bottom Sniper: Zündfunken-Munition scharf schalten für Dip-Käufe am Panik-Tief.
 */
export class KamikazeGrowthStrategy extends PortfolioStrategyInterface {
  constructor(config = {}) {
    super();
    this.manifest = config.manifest || PortfolioStrategyInterface.loadManifest('kamikaze-growth');
    this.id = this.manifest.id || 'KAMIKAZE_GROWTH';
    this.name = this.manifest.name || 'Kamikaze Growth Portfolio';
    this.version = this.manifest.version || '1.2.4';

    this.evacuateTargets = this.manifest.allocation_rules?.emergency_evacuation?.evacuate_targets || [
      'MOTHERSHIP_POOL', 'CRYPTO_EQUITIES', 'CYCLICAL_TECH'
    ];
    this.preserveTargets = this.manifest.allocation_rules?.emergency_evacuation?.preserve_targets || [
      'LASTING_HOLD'
    ];

    this.fireSparkPct = this.manifest.allocation_rules?.fire_spark_pct_of_free_mothership || 35;
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
    const { date, macroSignalContext = {}, brokerState = null } = context;
    const todayStr = date || new Date().toISOString().split('T')[0];

    // 1. Broker-Reconciliation ("Broker-Realität ist Gesetz")
    const freeUsd = brokerState?.free_usd !== undefined
      ? Number(brokerState.free_usd)
      : Number(this.manifest.cash_pots?.free_usd || 7034.67);

    const pendingOrdersUsd = brokerState?.pending_orders_usd !== undefined
      ? Number(brokerState.pending_orders_usd)
      : Number(this.manifest.cash_pots?.pending_orders_usd || 4287.00);

    const positions = brokerState?.positions || this.manifest.positions || [];
    const pendingOrders = brokerState?.pending_orders || this.manifest.cash_pots?.pending_orders || [];

    // 2. Makro-Signalkontext analysieren
    const macroStress = macroSignalContext.macroStressHub || macroSignalContext.katastrophenMatrix || {};
    const bottom = macroSignalContext.bottomHub || macroSignalContext.bottomSniper || {};
    const gs = macroSignalContext.goldSniper || {};

    // 3. Asset-Klassifizierung trennen
    const lastingHoldPositions = positions.filter(p => p.investmentType === 'LASTING_HOLD');
    const cyclicalPositions = positions.filter(p => p.investmentType !== 'LASTING_HOLD');

    let status = 'ACTIVE_MANAGEMENT';
    let action = 'HOLD';
    let hedgeAllocation = { gold_pct: 0, cash_pct: 100 };
    let fireSparkUsd = Number(((freeUsd * this.fireSparkPct) / 100).toFixed(2));
    let reason = 'Normalbetrieb: Wachstums- und Dauerhold-Positionen aktiv. Zündfunken-Pool bereit.';

    // Priorität 1: Bottom-Sniper Re-Entry
    const isDeployCash = bottom.regime === 'CAPITULATION_CONFIRMED' || bottom.status === 'CRITICAL' || gs.signal === 'DEPLOY_CASH';
    const isMarginCall = macroStress.regime === 'LIQUIDATION_CASCADE' || Boolean(macroStress.isMarginCallZone) ||
                         gs.signal === 'EXIT_GOLD_TO_CASH' || gs.state === 'PRE_MARGIN_LOCK' || gs.state === 'MARGIN_CALL_ACTIVE';
    const isSystemicStress = macroStress.regime === 'SYSTEMIC_STRESS' || macroStress.status === 'CRITICAL' ||
                             Boolean(macroStress.isShieldActive) || Boolean(gs.isGoldHedgeActive);

    if (isDeployCash) {
      status = 'RE_ENTRY_SNIPER';
      action = 'DEPLOY_SPARK';
      reason = `🎯 Generationen-Boden Sniper aktiv! Zündfunken-Pool (${fireSparkUsd.toFixed(2)} $) für antizyklische Dip-Buys freigeschaltet.`;
    }
    // Priorität 2: Pre-Margin-Call Cash-Lock (-18%/-19% SPY Drawdown)
    else if (isMarginCall) {
      status = (macroStress.regime === 'LIQUIDATION_CASCADE' || gs.state === 'MARGIN_CALL_ACTIVE') ? 'MARGIN_CALL_ACTIVE' : 'PRE_MARGIN_CASH_LOCK';
      action = (macroStress.regime === 'LIQUIDATION_CASCADE' || gs.signal === 'EXIT_GOLD_TO_CASH') ? 'EXIT_GOLD_TO_CASH' : 'HOLD_CASH';
      hedgeAllocation = { gold_pct: 0, cash_pct: 100 };
      const lastingHoldTickers = lastingHoldPositions.map(p => p.ticker).join(', ') || 'Keine';
      reason = `💰 Pre-Margin-Call Gewinnsicherung: Gold-Hedge glattgestellt in 100% Cash. LASTING_HOLD Positionen (${lastingHoldTickers}) bleiben unberührt geschützt.`;
    }
    // Priorität 3: Katastrophen-Matrix aktiv (50% Gold / 50% Cash Schutzschirm)
    else if (isSystemicStress) {
      status = 'EMERGENCY_HEDGE';
      action = 'EVACUATE_HEDGE';
      hedgeAllocation = { gold_pct: 50, cash_pct: 50 };
      const lastingHoldTickers = lastingHoldPositions.map(p => p.ticker).join(', ') || 'Keine';
      const cyclicalTickers = cyclicalPositions.map(p => p.ticker).join(', ') || 'Keine';
      reason = `🚨 Katastrophen-Matrix aktiv! Zykliker & Pool (${cyclicalTickers}) evakuiert in 50% Gold / 50% Cash. LASTING_HOLD Monopole (${lastingHoldTickers}) bleiben unangetastet im Depot!`;
    }

    this.lastEvaluation = {
      date: todayStr,
      status,
      action,
      freeUsd,
      pendingOrdersUsd,
      fireSparkUsd,
      hedgeAllocation,
      lastingHoldTickers: lastingHoldPositions.map(p => p.ticker),
      cyclicalTickers: cyclicalPositions.map(p => p.ticker),
      positionsCount: positions.length,
      pendingOrdersCount: pendingOrders.length,
      reason
    };

    return this.lastEvaluation;
  }

  getSnapshot(date) {
    const todayStr = date || (this.lastEvaluation?.date) || new Date().toISOString().split('T')[0];
    const evalData = this.lastEvaluation || {
      status: 'ACTIVE_MANAGEMENT',
      action: 'HOLD',
      freeUsd: Number(this.manifest.cash_pots?.free_usd || 7034.67),
      pendingOrdersUsd: Number(this.manifest.cash_pots?.pending_orders_usd || 4287.00),
      fireSparkUsd: 2462.13,
      lastingHoldTickers: ['PLTR', 'AIRO'],
      cyclicalTickers: ['SEMI', 'CDNX', 'PGY'],
      reason: 'Normalbetrieb'
    };

    return {
      strategy_id: this.id,
      name: this.name,
      version: this.version,
      snapshot_date: todayStr,
      read_only: true,
      stream_type: 'FLAGSHIP_BROADCAST',
      status: evalData.status,
      action: evalData.action,
      cash_pots: {
        free_usd: evalData.freeUsd,
        pending_orders_usd: evalData.pendingOrdersUsd,
        fire_spark_usd: evalData.fireSparkUsd
      },
      preserved_monopolies: evalData.lastingHoldTickers,
      active_positions_count: evalData.positionsCount || this.manifest.positions?.length || 0,
      reason: evalData.reason
    };
  }
}
