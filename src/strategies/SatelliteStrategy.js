import { PortfolioStrategyInterface } from './PortfolioStrategyInterface.js';

/**
 * SatelliteStrategy
 * 
 * Geopolitisch gehärtetes Core-Satellite-System (80/15/5):
 * - 80% SPY (Core S&P 500 Mutterschiff)
 * - 15% DFNS (VanEck Defense UCITS ETF / DFNS.L)
 * - 5% BTC (Bitcoin HODL)
 * 
 * REGELWERK (docs/architecture/strategies/Satelite.md & config/strategies/satellite.json):
 * 1. Normalbetrieb (NORMAL_HODL):
 *    - HODL-Prinzip: Kein Verkaufs-Rebalancing im laufenden Bullenmarkt ("Let your winners run!").
 *    - Sparrate (1. des Monats): 80% SPY / 15% DFNS / 5% BTC.
 * 2. Notfall-Stecker (EMERGENCY_SHIELD):
 *    - Trigger: Katastrophen-Matrix SignalEngine aktiv (macroSignalContext.katastrophenMatrix.isShieldActive === true).
 *    - Aktion: 100% Notfall-Evakuierung aller 3 Assets in 50% Gold (GLD) / 50% Cash (USD).
 *    - Sparrate im Notfall: 50% Gold / 50% Cash.
 *    - Anti-Whipsaw-Hysterese: Mindesthaltedauer von 15 Handelstagen im Schutzhafen.
 * 3. Re-Entry & Rebalancing-Reset (RE_ENTRY_RESET):
 *    - Trigger Pfad A: Panik-Boden Sniper schlägt am Markttief an (macroSignalContext.bottomSniper.isCritical === true).
 *    - Trigger Pfad B: Katastrophen-Schutzschild deaktiviert sich (km.isShieldActive === false) NACH Mindesthaltedauer (>= 15 Tage).
 *    - Aktion: 100% Auflösung von Gold/Cash und Reinvestition exakt in 80% SPY / 15% DFNS / 5% BTC.
 *    - Anti-Whipsaw-Cooldown: 20 Handelstage Schutz vor erneutem Fehlausstieg nach Re-Entry.
 */
export class SatelliteStrategy extends PortfolioStrategyInterface {
  constructor(config = {}) {
    super();
    this.manifest = config.manifest || PortfolioStrategyInterface.loadManifest('satellite');
    this.id = this.manifest.id || 'SATELITE';
    this.name = this.manifest.name || 'Satellite Core-Satellite Portfolio';
    this.version = this.manifest.version || '1.0.0';

    this.allocationTargets = this.manifest.allocation_targets || {
      core: { ticker: 'SPY', target_pct: 80.0 },
      defense_satellite: { ticker: 'DFNS', target_pct: 15.0 },
      crypto_satellite: { ticker: 'BTC', target_pct: 5.0 }
    };

    this.emergencyAllocation = this.manifest.emergency_shield?.emergency_allocation || {
      gold_gld_pct: 50.0,
      cash_usd_pct: 50.0
    };

    // Hysterese & Anti-Whipsaw Parameter
    this.minHoldingPeriodDays = Number(this.manifest.emergency_shield?.hysteresis_and_cooldown?.min_holding_period_days ?? 15);
    this.reTriggerCooldownDays = Number(this.manifest.emergency_shield?.hysteresis_and_cooldown?.re_trigger_cooldown_days ?? 20);
    this.minBtcHedgeDays = Number(this.manifest.emergency_shield?.hysteresis_and_cooldown?.min_btc_hedge_days ?? 10);

    // Interner Zustandsmarker & Tracking
    this.currentStatus = 'NORMAL_HODL';
    this.daysInEmergency = 0;
    this.cooldownDays = 0;
    this.daysInBtcHedge = 0;
    this.lastEvaluation = null;
  }

  /**
   * Setzt den internen Status zurück (z. B. für Backtests oder neue Zyklen)
   */
  resetState() {
    this.currentStatus = 'NORMAL_HODL';
    this.daysInEmergency = 0;
    this.cooldownDays = 0;
    this.daysInBtcHedge = 0;
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

  /**
   * Führt die tägliche Auswertung anhand des standardisierten makroökonomischen Signalkontexts durch.
   * @param {Object} context
   * @param {string} [context.date] - Aktuelles Datum (YYYY-MM-DD)
   * @param {Object} [context.macroSignalContext={}] - Makro-Signale aus PortfolioStrategyEngine
   * @param {Object} [context.marketData={}] - Optionale Marktdaten
   * @param {Array} [context.timeline=[]] - Historische Marktdaten
   * @param {Object} [context.brokerState=null] - Optionaler Broker-Konto-Status
   * @returns {Object} Strategie-Ergebnis
   */
  evaluateDaily(context = {}) {
    const { date, macroSignalContext = {} } = context;
    const todayStr = date || new Date().toISOString().split('T')[0];

    const macroStress = macroSignalContext.macroStressHub || macroSignalContext.katastrophenMatrix || {};
    const bottom = macroSignalContext.bottomHub || macroSignalContext.bottomSniper || {};
    const crypto = macroSignalContext.cryptoHub || {};

    const isShieldActive = macroStress.regime === 'SYSTEMIC_STRESS' || macroStress.regime === 'LIQUIDATION_CASCADE' || macroStress.status === 'CRITICAL' || Boolean(macroStress.isShieldActive);
    const isBottomCritical = bottom.regime === 'CAPITULATION_CONFIRMED' || bottom.status === 'CRITICAL' || Boolean(bottom.isCritical);

    // Sparplan-Erkennung (Standard: 1. des Monats)
    const monthlySavingsDay = Number(this.manifest.notifications?.triggers?.monthly_savings_day ?? 1);
    const isMonthlySavingsDay = new Date(todayStr).getDate() === monthlySavingsDay;

    // Cooldown dekrementieren im Normalbetrieb
    if (this.currentStatus === 'NORMAL_HODL' && this.cooldownDays > 0) {
      this.cooldownDays--;
    }

    let nextStatus = this.currentStatus;
    let action = 'HODL';
    let targetAllocationPct = {
      SPY: 80.0,
      DFNS: 15.0,
      BTC: 5.0,
      GLD: 0.0,
      CASH: 0.0
    };
    let reason = 'Normalbetrieb: 80% SPY / 15% DFNS / 5% BTC. HODL-Prinzip aktiv (Gewinner laufen lassen).';

    if (isShieldActive) {
      if (this.currentStatus === 'EMERGENCY_SHIELD') {
        this.daysInEmergency++;
        // Befindet sich bereits im Notfall-Modus -> Prüfe Re-Entry Sniper am Boden
        if (isBottomCritical) {
          nextStatus = 'RE_ENTRY_RESET';
          action = 'REINVEST_TARGET_ALLOCATION';
          targetAllocationPct = {
            SPY: 80.0,
            DFNS: 15.0,
            BTC: 5.0,
            GLD: 0.0,
            CASH: 0.0
          };
          reason = '🎯 Panik-Boden Sniper bestätigt Generationen-Tiefpunkt! Notfall-Stecker gelöst: 100% Reinvestition von Gold & Cash in 80% SPY / 15% DFNS / 5% BTC (Rebalancing-Reset).';
          this.daysInEmergency = 0;
          this.cooldownDays = this.reTriggerCooldownDays;
        } else {
          // Weiterhin im Notfall-Schutzhafen verharren
          nextStatus = 'EMERGENCY_SHIELD';
          action = isMonthlySavingsDay ? 'DCA_EMERGENCY_50_GOLD_50_CASH' : 'HOLD_EMERGENCY_HEDGE';
          targetAllocationPct = {
            SPY: 0.0,
            DFNS: 0.0,
            BTC: 0.0,
            GLD: Number(this.emergencyAllocation.gold_gld_pct || 50.0),
            CASH: Number(this.emergencyAllocation.cash_usd_pct || 50.0)
          };
          reason = isMonthlySavingsDay
            ? 'Monatliche Sparrate zu 50% in Gold und 50% in Cash allokieren (Notfall-Schutzschild aktiv).'
            : `Notfall-Schutzhafen aktiv (Tag ${this.daysInEmergency}). Kapital verbleibt zu 50% in Gold und 50% in Cash.`;
        }
      } else {
        // Frische Notfall-Aktivierung (Notfall-Stecker ziehen!)
        // Anti-Whipsaw Cooldown prüfen
        if (this.cooldownDays > 0) {
          nextStatus = 'NORMAL_HODL';
          action = isMonthlySavingsDay ? 'DCA_CORE_80_15_5' : 'HODL';
          targetAllocationPct = {
            SPY: 80.0,
            DFNS: 15.0,
            BTC: 5.0,
            GLD: 0.0,
            CASH: 0.0
          };
          reason = `Anti-Whipsaw Cooldown aktiv (${this.cooldownDays} Tage verbleibend). Fehlausstieg unterdrückt, HODL-Zustand wird gehalten.`;
        } else {
          nextStatus = 'EMERGENCY_SHIELD';
          this.daysInEmergency = 1;
          this.daysInBtcHedge = 0;
          action = 'EVACUATE_50_GOLD_50_CASH';
          targetAllocationPct = {
            SPY: 0.0,
            DFNS: 0.0,
            BTC: 0.0,
            GLD: Number(this.emergencyAllocation.gold_gld_pct || 50.0),
            CASH: Number(this.emergencyAllocation.cash_usd_pct || 50.0)
          };
          reason = '🚨 KATASTROPHEN-SCHUTZSCHILD AKTIV! Notfall-Stecker gezogen. 100% Notfall-Evakuierung aller Bestände (SPY, DFNS, BTC) in 50% Gold (GLD) und 50% Cash.';
        }
      }
    } else {
      // Katastrophen-Matrix ist INAKTIV (Markt GRÜN / Entwarnung)
      if (this.currentStatus === 'EMERGENCY_SHIELD') {
        this.daysInEmergency++;
        // Mindesthaltedauer prüfen (Anti-Whipsaw Hysterese)
        if (this.daysInEmergency < this.minHoldingPeriodDays) {
          nextStatus = 'EMERGENCY_SHIELD';
          action = isMonthlySavingsDay ? 'DCA_EMERGENCY_50_GOLD_50_CASH' : 'HOLD_EMERGENCY_HEDGE';
          targetAllocationPct = {
            SPY: 0.0,
            DFNS: 0.0,
            BTC: 0.0,
            GLD: Number(this.emergencyAllocation.gold_gld_pct || 50.0),
            CASH: Number(this.emergencyAllocation.cash_usd_pct || 50.0)
          };
          reason = `Notfall-Schutzhafen aktiv (Anti-Whipsaw-Hysterese: Tag ${this.daysInEmergency}/${this.minHoldingPeriodDays}). Vorzeitiger Re-Entry verriegelt.`;
        } else {
          // Mindesthaltedauer erfüllt -> Rebalancing-Reset
          nextStatus = 'RE_ENTRY_RESET';
          action = 'REINVEST_TARGET_ALLOCATION';
          targetAllocationPct = {
            SPY: 80.0,
            DFNS: 15.0,
            BTC: 5.0,
            GLD: 0.0,
            CASH: 0.0
          };
          reason = 'Entwarnung: Katastrophen-Schutzschild deaktiviert und Mindesthaltedauer erfüllt. Re-Entry: 100% Reinvestition von Gold & Cash in 80% SPY / 15% DFNS / 5% BTC.';
          this.daysInEmergency = 0;
          this.cooldownDays = this.reTriggerCooldownDays;
        }
      } else {
        // Regulärer Normalbetrieb (Makro GRÜN)
        const isBtcBear = crypto.regime === 'BULL_CRITICAL' || crypto.regime === 'BEAR_REGIME';

        if (this.currentStatus === 'BTC_HEDGE_CASH') {
          this.daysInBtcHedge++;
          if (isBtcBear) {
            // Weiterhin im Krypto-Bärenmarkt -> In Cash verharren
            nextStatus = 'BTC_HEDGE_CASH';
            action = isMonthlySavingsDay ? 'DCA_CORE_80_15_CASH_5' : 'HOLD_BTC_IN_CASH';
            targetAllocationPct = {
              SPY: 80.0,
              DFNS: 15.0,
              BTC: 0.0,
              GLD: 0.0,
              CASH: 5.0
            };
            reason = isMonthlySavingsDay
              ? 'Krypto-Winter / MSTR unter Trend: Monatliche 5% BTC-Sparrate temporär in USD-Cash parken (80% SPY / 15% DFNS / 5% Cash).'
              : `Krypto-Airbag aktiv (${crypto.regime}, Tag ${this.daysInBtcHedge}): 5% Bitcoin-Satellit in Cash geparkt zum Schutz vor Bärenmarkt-Drawdowns. SPY (80%) & DFNS (15%) laufen normal weiter.`;
          } else {
            // Trend dreht wieder bullisch -> Anti-Whipsaw Mindesthaltedauer in Cash prüfen
            if (this.daysInBtcHedge < this.minBtcHedgeDays) {
              nextStatus = 'BTC_HEDGE_CASH';
              action = isMonthlySavingsDay ? 'DCA_CORE_80_15_CASH_5' : 'HOLD_BTC_IN_CASH';
              targetAllocationPct = {
                SPY: 80.0,
                DFNS: 15.0,
                BTC: 0.0,
                GLD: 0.0,
                CASH: 5.0
              };
              reason = `Krypto-Airbag Hysterese aktiv (Tag ${this.daysInBtcHedge}/${this.minBtcHedgeDays}). Vorzeitiger Krypto-Re-Entry verriegelt zum Schutz vor Whipsaw.`;
            } else {
              // Mindesthaltedauer erfüllt -> Reinvestition in BTC
              nextStatus = 'NORMAL_HODL';
              this.daysInBtcHedge = 0;
              action = isMonthlySavingsDay ? 'DCA_CORE_80_15_5' : 'REINVEST_BTC_SATELLITE';
              targetAllocationPct = {
                SPY: 80.0,
                DFNS: 15.0,
                BTC: 5.0,
                GLD: 0.0,
                CASH: 0.0
              };
              reason = 'Krypto-Taktgeber wieder bullisch und Mindestverweildauer erfüllt: 5% Cash-Puffer vollständig zurück in Bitcoin reinvestieren.';
            }
          }
        } else {
          // Status war NORMAL_HODL (oder frisch nach Makro-Krise)
          if (isBtcBear) {
            nextStatus = 'BTC_HEDGE_CASH';
            this.daysInBtcHedge = 1;
            action = isMonthlySavingsDay ? 'DCA_CORE_80_15_CASH_5' : 'EVACUATE_BTC_TO_CASH';
            targetAllocationPct = {
              SPY: 80.0,
              DFNS: 15.0,
              BTC: 0.0,
              GLD: 0.0,
              CASH: 5.0
            };
            reason = isMonthlySavingsDay
              ? 'Krypto-Winter / MSTR unter Trend: Monatliche 5% BTC-Sparrate temporär in USD-Cash parken (80% SPY / 15% DFNS / 5% Cash).'
              : `Krypto-Airbag aktiv (${crypto.regime}): 5% Bitcoin-Satellit in Cash geparkt zum Schutz vor Bärenmarkt-Drawdowns. SPY (80%) & DFNS (15%) laufen normal weiter.`;
          } else {
            nextStatus = 'NORMAL_HODL';
            this.daysInBtcHedge = 0;
            action = isMonthlySavingsDay ? 'DCA_CORE_80_15_5' : 'HODL';
            targetAllocationPct = {
              SPY: 80.0,
              DFNS: 15.0,
              BTC: 5.0,
              GLD: 0.0,
              CASH: 0.0
            };
            reason = isMonthlySavingsDay
              ? 'Monatliche Sparrate stur nach Zielallokation investieren: 80% SPY, 15% DFNS, 5% BTC.'
              : 'Bullenmarkt intakt (Makro & Krypto stabil). HODL-Prinzip aktiv: Gewinner laufen lassen, kein vorzeitiges Rebalancing.';
          }
        }
      }
    }

    this.currentStatus = nextStatus;

    const result = {
      strategyId: this.id,
      date: todayStr,
      status: nextStatus,
      action,
      targetAllocationPct,
      reason,
      daysInEmergency: this.daysInEmergency,
      cooldownDays: this.cooldownDays,
      daysInBtcHedge: this.daysInBtcHedge,
      rawSignals: {
        isShieldActive,
        isBottomCritical
      }
    };

    this.lastEvaluation = result;
    return result;
  }

  /**
   * Erzeugt einen standardisierten Tages-Snapshot für Speicherung und Cloudflare D1
   */
  getSnapshot(date) {
    const todayStr = date || new Date().toISOString().split('T')[0];
    const last = this.lastEvaluation || {};

    return {
      strategy_id: this.id,
      name: this.name,
      version: this.version,
      snapshot_date: todayStr,
      status: last.status || this.currentStatus || 'NORMAL_HODL',
      action: last.action || 'HODL',
      targetAllocationPct: last.targetAllocationPct || {
        SPY: 80.0,
        DFNS: 15.0,
        BTC: 5.0,
        GLD: 0.0,
        CASH: 0.0
      },
      reason: last.reason || 'Initiale Snapshot-Berechnung.',
      updated_at: new Date().toISOString()
    };
  }
}
