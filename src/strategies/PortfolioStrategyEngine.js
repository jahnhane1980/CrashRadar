import { Logger } from '../core/Logger.js';
import { PortfolioStrategyInterface } from './PortfolioStrategyInterface.js';
import { KatastrophenMatrixIndicator } from '../analysis/indicators/KatastrophenMatrixIndicator.js';
import { GoldSniperIndicator } from '../analysis/indicators/GoldSniperIndicator.js';
import { TreasuryCapacityRadarIndicator } from '../analysis/indicators/TreasuryCapacityRadarIndicator.js';
import { PanicCapitulationIndicator } from '../analysis/indicators/PanicCapitulationIndicator.js';
import { SmartDumbMoneyBottomIndicator } from '../analysis/indicators/SmartDumbMoneyBottomIndicator.js';

/**
 * PortfolioStrategyEngine
 * 
 * Zentraler Orchestrator und Registry für alle CrashRadar Portfoliostrategien.
 * 
 * AUFGABEN:
 * 1. Vorberechnung des standardisierten Makro-Signalkontexts (macroSignalContext):
 *    - 3-Säulen-Katastrophen-Matrix (Trendbruch + Makro-Türsteher)
 *    - Gold-Sniper (Pre-Margin-Call Exit bei -18%/-19% & Re-Entry)
 *    - Liquiditäts-Radar (Treasury Capacity, Slack, Imminent Drain)
 *    - Bottom-Sniper (Panic Capitulation & Smart/Dumb Money)
 * 2. Autonome Ausführung der registrierten Strategien (evaluateDaily).
 * 3. Erstellung des aggregierten Tages-Snapshots (daily_intelligence.json) für Cloudflare D1.
 */
export class PortfolioStrategyEngine {
  constructor(config = {}, dependencies = {}) {
    this.config = config;
    this._strategies = new Map();

    // Standard-Sensoren der SignalEngine
    this.katastrophenMatrix = dependencies.katastrophenMatrix || new KatastrophenMatrixIndicator(config.katastrophenMatrix || {});
    this.panicCapitulation = dependencies.panicCapitulation || new PanicCapitulationIndicator();
    this.goldSniper = dependencies.goldSniper || new GoldSniperIndicator(config.goldSniper || {}, {
      katastrophenMatrix: this.katastrophenMatrix,
      panicCapitulation: this.panicCapitulation
    });
    this.treasuryCapacity = dependencies.treasuryCapacity || new TreasuryCapacityRadarIndicator(config.treasuryCapacity || {});
    this.smartDumbBottom = dependencies.smartDumbBottom || new SmartDumbMoneyBottomIndicator();
  }

  /**
   * Registriert eine neue Strategie in der Engine.
   * Validiert zur Laufzeit das PortfolioStrategyInterface.
   * @param {Object} strategy 
   */
  registerStrategy(strategy) {
    PortfolioStrategyInterface.validate(strategy);
    const id = strategy.getId();
    this._strategies.set(id, strategy);
    Logger.info(`[PortfolioStrategyEngine] Strategie '${strategy.getName()}' (${id} v${strategy.getVersion?.() || '1.0.0'}) registriert.`);
    return this;
  }

  /**
   * Liefert eine registrierte Strategie anhand ihrer ID.
   * @param {string} id 
   * @returns {Object|null}
   */
  getStrategy(id) {
    return this._strategies.get(id) || null;
  }

  /**
   * Liefert alle registrierten Strategien als Array.
   * @returns {Array}
   */
  getRegisteredStrategies() {
    return Array.from(this._strategies.values());
  }

  /**
   * Berechnet den standardisierten Makro-Signalkontext für alle Strategien.
   * @param {Array} timeline - Historische Timeline aus FinanceExpert
   * @param {Object} precalculated - Optionale Vorberechnungen
   * @returns {Object}
   */
  buildMacroSignalContext(timeline, precalculated = {}) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return {
        status: 'UNKNOWN',
        regime: 'NORMAL',
        katastrophenMatrix: { status: 'UNKNOWN', signal: 'NONE', isShieldActive: false },
        goldSniper: { status: 'UNKNOWN', state: 'NORMAL', signal: 'NONE', isGoldHedgeActive: false, isCashLockActive: false },
        treasuryCapacity: { status: 'UNKNOWN' },
        bottomSniper: { status: 'UNKNOWN', isCritical: false },
        cryptoRegime: { status: 'UNKNOWN' }
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const dateStr = currentDay?.date || new Date().toISOString().split('T')[0];

    // 1. Katastrophen-Matrix
    const kmRes = precalculated.katastrophenMatrix || this.katastrophenMatrix.evaluate(timeline);

    // 2. Gold-Sniper
    const gsRes = precalculated.goldSniper || this.goldSniper.evaluate(timeline, {
      katastrophenMatrix: kmRes,
      panicCapitulation: precalculated.panicCapitulation
    });

    // 3. Liquiditäts-Radar (Treasury Capacity)
    let tcRes = precalculated.treasuryCapacity;
    if (!tcRes) {
      try {
        tcRes = this.treasuryCapacity.evaluate(timeline);
      } catch (e) {
        tcRes = { status: 'UNKNOWN', message: e.message };
      }
    }

    // 4. Bottom-Sniper
    let pcRes = precalculated.panicCapitulation;
    if (!pcRes) {
      try {
        pcRes = this.panicCapitulation.evaluate(timeline);
      } catch (e) {
        pcRes = { status: 'UNKNOWN', message: e.message };
      }
    }

    // 5. Smart / Dumb Money Bottom
    let sdRes = precalculated.smartDumbBottom;
    if (!sdRes) {
      try {
        sdRes = this.smartDumbBottom.evaluate(timeline);
      } catch (e) {
        sdRes = { status: 'UNKNOWN', message: e.message };
      }
    }

    const isBottomCritical = (pcRes?.status === 'CRITICAL') || (sdRes?.status === 'CRITICAL');

    // Übergeordnetes Regime
    let regime = 'EXPANSION';
    if (kmRes.isShieldActive) {
      regime = 'CRISIS_ALERT';
    } else if (tcRes?.status === 'CRITICAL' || kmRes.status === 'WARNING') {
      regime = 'SLOWDOWN';
    }

    // Krypto 21W-EMA (147 Tage)
    let btcPrice = currentDay?.assets?.BTC || currentDay?.assets?.['BTC-USD'] || null;
    let btcRegime = 'UNKNOWN';
    if (btcPrice !== null && timeline.length >= 147) {
      let btcSum = 0;
      let count = 0;
      for (let i = timeline.length - 147; i < timeline.length; i++) {
        const p = timeline[i]?.assets?.BTC || timeline[i]?.assets?.['BTC-USD'];
        if (p) {
          btcSum += Number(p);
          count++;
        }
      }
      if (count > 100) {
        const sma147 = btcSum / count;
        btcRegime = btcPrice >= sma147 ? 'BULL' : 'BEAR';
      }
    }

    return {
      date: dateStr,
      regime,
      katastrophenMatrix: kmRes,
      goldSniper: gsRes,
      treasuryCapacity: tcRes,
      bottomSniper: {
        status: isBottomCritical ? 'CRITICAL' : (pcRes?.status || 'OK'),
        isCritical: isBottomCritical,
        panicCapitulation: pcRes,
        smartDumbBottom: sdRes
      },
      cryptoRegime: {
        status: btcRegime,
        btcPrice: btcPrice ? Number(btcPrice) : null
      }
    };
  }

  /**
   * Führt alle registrierten Strategien für den gegebenen Tag aus.
   * @param {Object} params
   * @param {string} params.date - Tag (YYYY-MM-DD)
   * @param {Object} params.marketData - Tageskurse & Ticker-Daten
   * @param {Array} params.timeline - Historische Timeline
   * @param {Object} [params.brokerStates={}] - Reale Broker-Konto-Rohdaten je Strategie
   * @param {Object} [params.precalculatedSignals={}] - Vorkalkulierte Signale
   * @returns {Object} Evaluationsergebnisse aller Strategien
   */
  async evaluateAll({ date, marketData = {}, timeline = [], brokerStates = {}, precalculatedSignals = {} }) {
    const todayStr = date || (timeline.length > 0 ? timeline[timeline.length - 1].date : new Date().toISOString().split('T')[0]);
    const macroSignalContext = this.buildMacroSignalContext(timeline, precalculatedSignals);

    const results = {};

    for (const [strategyId, strategy] of this._strategies.entries()) {
      try {
        const context = {
          date: todayStr,
          marketData,
          macroSignalContext,
          timeline,
          brokerState: brokerStates[strategyId] || null
        };

        const result = await strategy.evaluateDaily(context);
        results[strategyId] = result;
      } catch (err) {
        Logger.error(`[PortfolioStrategyEngine] Fehler bei der Ausführung von Strategie '${strategyId}':`, err.message);
        results[strategyId] = {
          status: 'ERROR',
          error: err.message
        };
      }
    }

    return {
      date: todayStr,
      macroSignalContext,
      strategyResults: results
    };
  }

  /**
   * Erstellt das standardisierte Snapshot-Payload für Cloudflare D1 (daily_intelligence.json).
   * @param {string} date
   * @param {Object} macroSignalContext
   * @returns {Object}
   */
  buildDailySnapshot(date, macroSignalContext = {}) {
    const todayStr = date || new Date().toISOString().split('T')[0];
    const strategySnapshots = {};

    for (const [strategyId, strategy] of this._strategies.entries()) {
      try {
        strategySnapshots[strategyId] = strategy.getSnapshot(todayStr);
      } catch (err) {
        Logger.error(`[PortfolioStrategyEngine] Fehler beim Snapshot von '${strategyId}':`, err.message);
        strategySnapshots[strategyId] = {
          strategy_id: strategyId,
          status: 'ERROR',
          error: err.message
        };
      }
    }

    return {
      schema_version: '2.1.0',
      snapshot_date: todayStr,
      timestamp: new Date().toISOString(),
      macro_regime: macroSignalContext.regime || 'NORMAL',
      macro_context: macroSignalContext,
      active_strategies_count: this._strategies.size,
      strategies: strategySnapshots
    };
  }
}
