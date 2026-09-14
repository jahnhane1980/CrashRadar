import { SignalComponent } from '../contracts/SignalComponent.js';
import { SignalStatus } from '../contracts/SignalTypes.js';
import { LiquiditySensorHub } from './LiquiditySensorHub.js';
import { GlobalLiquiditySensorHub } from './GlobalLiquiditySensorHub.js';
import { GeopoliticalCostSensorHub } from './GeopoliticalCostSensorHub.js';
import { FiscalCalendarService } from '../../services/FiscalCalendarService.js';

export const MacroLiquidityRegime = Object.freeze({
  EXPANSION: 'EXPANSION',
  CONTAINED_SQUEEZE: 'CONTAINED_SQUEEZE',
  GEOPOLITICAL_COST_SHOCK: 'GEOPOLITICAL_COST_SHOCK',
  STAGFLATION_LIQUIDITY_TRAP: 'STAGFLATION_LIQUIDITY_TRAP',
  CRITICAL_COLLISION: 'CRITICAL_COLLISION',
  UNKNOWN: 'UNKNOWN'
});

/**
 * MacroLiquiditySensorHub (Master Composite Hub)
 * 
 * Führt die 3 Säulen der modernen Makro-Mechanik zusammen:
 * 1. US Geldmarkt & Treasury Capacity (LiquiditySensorHub - unverändert!)
 * 2. Globale Notenbank- & Cross-Border Ströme (GlobalLiquiditySensorHub)
 * 3. Geopolitische Rohstoff- & Frachtkosten (GeopoliticalCostSensorHub)
 * 4. Fiskalischer Kalender & Shutdown-Fristen (FiscalCalendarService)
 */
export class MacroLiquiditySensorHub extends SignalComponent {
  constructor(config = {}, dependencies = {}) {
    super();
    this.usLiquidityHub = dependencies.usLiquidityHub || new LiquiditySensorHub(config.usLiquidityConfig || {});
    this.globalLiquidityHub = dependencies.globalLiquidityHub || new GlobalLiquiditySensorHub(config.globalLiquidityConfig || {});
    this.geopoliticalCostHub = dependencies.geopoliticalCostHub || new GeopoliticalCostSensorHub(config.costConfig || {});
    this.fiscalCalendarService = dependencies.fiscalCalendarService || new FiscalCalendarService(config.fiscalCalendarPath || null);
  }

  getId() {
    return 'MACRO_LIQUIDITY_SENSOR_HUB';
  }

  getName() {
    return 'Ganzheitlicher Makro-Liquiditäts- & Geopolitik-Master-Hub';
  }

  getComponentType() {
    return 'HUB';
  }

  evaluate(timeline, context = {}) {
    if (!Array.isArray(timeline) || timeline.length < 30) {
      return {
        status: SignalStatus.UNKNOWN,
        regime: MacroLiquidityRegime.UNKNOWN,
        compositeScore: null,
        message: 'Zu wenig Daten für Master-Hub Auswertung',
        diagnostics: {}
      };
    }

    const currentDay = timeline[timeline.length - 1];
    const currentDateStr = currentDay.date;

    // 1. Sub-Hubs evaluieren
    const usResult = this.usLiquidityHub.evaluate(timeline);
    const globalResult = this.globalLiquidityHub.evaluate(timeline, context);
    const costResult = this.geopoliticalCostHub.evaluate(timeline, context);
    const fiscalStatus = this.fiscalCalendarService.getFiscalStatus(currentDateStr);

    // 2. Extrahiere Sub-Scores
    const usStress = usResult.diagnostics?.dualMacroStress ?? 50;
    const globalStress = globalResult.globalStressScore ?? 30;
    const costStress = costResult.stagflationPressureScore ?? 20;

    // 3. Composite Stress Score (Gewichtung: 40% US, 30% Global, 30% Rohstoff/Transport)
    const compositeScore = Math.round(0.40 * usStress + 0.30 * globalStress + 0.30 * costStress);

    // 4. Regime-Klassifizierung
    let regime = MacroLiquidityRegime.EXPANSION;
    let status = SignalStatus.OK;
    let collisionRisk = 'Keine akute Kollision';

    const isCostHigh = costResult.status === SignalStatus.CRITICAL || costResult.status === SignalStatus.WARNING;
    const isLiquidityDraining = usResult.status === SignalStatus.CRITICAL || usResult.status === SignalStatus.WARNING || globalResult.status === SignalStatus.CRITICAL;

    if (usResult.status === SignalStatus.CRITICAL && isCostHigh) {
      regime = MacroLiquidityRegime.CRITICAL_COLLISION;
      status = SignalStatus.CRITICAL;
      collisionRisk = 'SYSTEM-CRASH KOLLISION: Harter Liquiditäts-Abzug trifft geopolitischen Öl-Schock!';
    } else if (isCostHigh && isLiquidityDraining) {
      regime = MacroLiquidityRegime.STAGFLATION_LIQUIDITY_TRAP;
      status = SignalStatus.CRITICAL;
      collisionRisk = 'STAGFLATIONS-FALLE: Öl-Preisschock blockiert Notenbank-Lockerung bei schrumpfender Liquidität';
    } else if (isCostHigh && !isLiquidityDraining) {
      regime = MacroLiquidityRegime.GEOPOLITICAL_COST_SHOCK;
      status = SignalStatus.WARNING;
      collisionRisk = 'Isolierter Rohstoff-Druck bei noch intakter Liquidität';
    } else if (!isCostHigh && isLiquidityDraining) {
      regime = fiscalStatus.preElectionShieldActive ? MacroLiquidityRegime.CONTAINED_SQUEEZE : MacroLiquidityRegime.CONTAINED_SQUEEZE;
      status = SignalStatus.WARNING;
      collisionRisk = fiscalStatus.isExtendedByContinuingResolution
        ? `Shutdown vertagt auf ${fiscalStatus.effectiveDeadline}. Puffer aktiv bis QRA (${fiscalStatus.nextMilestone?.date || 'November'}).`
        : 'Schrumpfende Geldmarktpuffer.';
    }

    let message = `Makro-Umfeld: ${regime} (Score: ${compositeScore}/100). ${collisionRisk}`;

    return {
      status,
      regime,
      compositeScore,
      collisionRisk,
      fiscalStatus,
      message,
      diagnostics: {
        compositeScore,
        usLiquidity: usResult,
        globalLiquidity: globalResult,
        geopoliticalCost: costResult,
        fiscalStatus
      }
    };
  }
}
