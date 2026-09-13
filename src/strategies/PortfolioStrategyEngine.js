import { Logger } from '../core/Logger.js';
import { PortfolioStrategyInterface } from './PortfolioStrategyInterface.js';
import { KatastrophenMatrixIndicator } from '../analysis/indicators/KatastrophenMatrixIndicator.js';
import { GoldSniperIndicator } from '../analysis/indicators/GoldSniperIndicator.js';
import { TreasuryCapacityRadarIndicator } from '../analysis/indicators/TreasuryCapacityRadarIndicator.js';
import { PanicCapitulationIndicator } from '../analysis/indicators/PanicCapitulationIndicator.js';
import { SmartDumbMoneyBottomIndicator } from '../analysis/indicators/SmartDumbMoneyBottomIndicator.js';
import { DarkPoolAccumulationIndicator } from '../analysis/indicators/DarkPoolAccumulationIndicator.js';
import { BtcTrailingStopIndicator } from '../analysis/indicators/BtcTrailingStopIndicator.js';
import { CryptoSensorHub } from '../signals/hubs/CryptoSensorHub.js';
import { MacroStressSensorHub } from '../signals/hubs/MacroStressSensorHub.js';
import { LiquiditySensorHub } from '../signals/hubs/LiquiditySensorHub.js';
import { MarketBottomSensorHub } from '../signals/hubs/MarketBottomSensorHub.js';

/**
 * PortfolioStrategyEngine
 * 
 * Zentraler Orchestrator und Registry für alle CrashRadar Portfoliostrategien.
 * 
 * AUFGABEN:
 * 1. Vorberechnung des standardisierten Makro-Signalkontexts (macroSignalContext):
 *    - Moderne Sensor-Hubs (Composite-Pattern): CryptoHub, MacroStressHub, LiquidityHub, BottomHub
 *    - 3-Säulen-Katastrophen-Matrix & Gold-Sniper (Abwärtskompatibilitäts-Brücke)
 *    - Liquiditäts-Radar & TTC-Zeitprognose
 * 2. Autonome Ausführung der registrierten Strategien (evaluateDaily).
 * 3. Erstellung des aggregierten Tages-Snapshots (daily_intelligence.json) für Cloudflare D1.
 */
export class PortfolioStrategyEngine {
  constructor(config = {}, dependencies = {}) {
    this.config = config;
    this._strategies = new Map();

    // Moderne Sensor-Hubs (Composite-Pattern)
    this.cryptoHub = dependencies.cryptoHub || new CryptoSensorHub(config.cryptoHub || {});
    this.macroStressHub = dependencies.macroStressHub || new MacroStressSensorHub(config.macroStressHub || {});
    this.liquidityHub = dependencies.liquidityHub || new LiquiditySensorHub(config.liquidityHub || {});
    this.bottomHub = dependencies.bottomHub || new MarketBottomSensorHub(config.bottomHub || {});

    // Standard-Sensoren / Legacy-Kompatibilität
    this.katastrophenMatrix = dependencies.katastrophenMatrix || new KatastrophenMatrixIndicator(config.katastrophenMatrix || {});
    this.panicCapitulation = dependencies.panicCapitulation || new PanicCapitulationIndicator();
    this.goldSniper = dependencies.goldSniper || new GoldSniperIndicator(config.goldSniper || {}, {
      katastrophenMatrix: this.katastrophenMatrix,
      panicCapitulation: this.panicCapitulation
    });
    this.treasuryCapacity = dependencies.treasuryCapacity || new TreasuryCapacityRadarIndicator(config.treasuryCapacity || {});
    this.smartDumbBottom = dependencies.smartDumbBottom || new SmartDumbMoneyBottomIndicator();
    this.darkPoolAccumulation = dependencies.darkPoolAccumulation || new DarkPoolAccumulationIndicator(config.darkPoolAccumulation || {});
    this.btcTrailingStop = dependencies.btcTrailingStop || new BtcTrailingStopIndicator(config.btcTrailingStop || {});
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
        date: new Date().toISOString().split('T')[0],
        status: 'UNKNOWN',
        regime: 'EXPANSION',
        cryptoHub: { status: 'UNKNOWN', regime: 'UNKNOWN', message: 'Keine Daten' },
        macroStressHub: { status: 'UNKNOWN', regime: 'UNKNOWN', isShieldActive: false, isMarginCallZone: false, daysInAlarm: 0, message: 'Keine Daten' },
        liquidityHub: { status: 'UNKNOWN', regime: 'UNKNOWN', ttcDays: null, message: 'Keine Daten' },
        bottomHub: { status: 'UNKNOWN', regime: 'UNKNOWN', isCritical: false, message: 'Keine Daten' }
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const dateStr = currentDay?.date || new Date().toISOString().split('T')[0];

    // 1. Moderne Sensor-Hubs (Composite-Pattern)
    let bottomHubRes = precalculated.bottomHub;
    if (!bottomHubRes) {
      try {
        bottomHubRes = this.bottomHub.evaluate(timeline);
      } catch (e) {
        bottomHubRes = { status: 'UNKNOWN', regime: 'UNKNOWN', isCritical: false, message: e.message };
      }
    }

    let macroStressRes = precalculated.macroStressHub;
    if (!macroStressRes) {
      try {
        macroStressRes = this.macroStressHub.evaluate(timeline, { bottomHubResult: bottomHubRes });
      } catch (e) {
        macroStressRes = { status: 'UNKNOWN', regime: 'UNKNOWN', isShieldActive: false, message: e.message };
      }
    }

    let cryptoHubRes = precalculated.cryptoHub;
    if (!cryptoHubRes) {
      try {
        cryptoHubRes = this.cryptoHub.evaluate(timeline, { bottomHubResult: bottomHubRes });
      } catch (e) {
        cryptoHubRes = { status: 'UNKNOWN', regime: 'UNKNOWN', message: e.message };
      }
    }

    let liquidityHubRes = precalculated.liquidityHub;
    if (!liquidityHubRes) {
      try {
        liquidityHubRes = this.liquidityHub.evaluate(timeline);
      } catch (e) {
        liquidityHubRes = { status: 'UNKNOWN', regime: 'UNKNOWN', message: e.message };
      }
    }

    // Übergeordnetes Makro-Regime
    let regime = 'EXPANSION';
    if (macroStressRes.regime === 'SYSTEMIC_STRESS' || macroStressRes.regime === 'LIQUIDATION_CASCADE' || macroStressRes.status === 'CRITICAL') {
      regime = 'CRISIS_ALERT';
    } else if (liquidityHubRes?.status === 'CRITICAL' || macroStressRes.status === 'WARNING' || liquidityHubRes?.regime === 'CRITICAL_DRAIN') {
      regime = 'SLOWDOWN';
    }

    return {
      date: dateStr,
      regime,
      // Strikte 4 Sensor-Hubs (Composite Pattern)
      cryptoHub: {
        status: cryptoHubRes.status,
        regime: cryptoHubRes.regime,
        message: cryptoHubRes.message
      },
      macroStressHub: {
        status: macroStressRes.status,
        regime: macroStressRes.regime,
        isShieldActive: Boolean(macroStressRes.isShieldActive),
        isMarginCallZone: Boolean(macroStressRes.isMarginCallZone),
        daysInAlarm: macroStressRes.daysInAlarm || 0,
        message: macroStressRes.message
      },
      liquidityHub: {
        status: liquidityHubRes.status,
        regime: liquidityHubRes.regime,
        ttcDays: liquidityHubRes.ttcDays ?? null,
        projectedCollision: liquidityHubRes.projectedCollision ?? null,
        message: liquidityHubRes.message
      },
      bottomHub: {
        status: bottomHubRes.status,
        regime: bottomHubRes.regime,
        isCritical: Boolean(bottomHubRes.isCritical),
        message: bottomHubRes.message
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
