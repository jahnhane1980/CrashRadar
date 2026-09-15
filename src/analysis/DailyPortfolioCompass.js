import { SignalComponent } from '../signals/contracts/SignalComponent.js';
import { SignalStatus } from '../signals/contracts/SignalTypes.js';
import { DerivativesSensorHub } from '../signals/hubs/DerivativesSensorHub.js';
import { LiquiditySensorHub } from '../signals/hubs/LiquiditySensorHub.js';
import { GoldilocksSensorHub } from '../signals/hubs/GoldilocksSensorHub.js';

/**
 * DailyPortfolioCompass
 * 
 * Verschlankter Taktischer Portfolio-Kompass:
 * - Wertet exklusiv die drei spezialisierten Sensor-Hubs aus:
 *   1. LiquiditySensorHub (Geldmarkt- & Treasury-Liquidität, Slack, TTC)
 *   2. DerivativesSensorHub (OpEx-Zyklus, Hexensabbat, Gamma & Vol-Crush)
 *   3. GoldilocksSensorHub (Makro-Klima, Inflation, Zinsen & Soft-Landing)
 * - Gibt die emittierten Signale der drei Hubs direkt und transparent in der Konsole aus.
 */
export class DailyPortfolioCompass extends SignalComponent {
  constructor(config = {}, dependencies = {}) {
    super();
    this.config = config;
    this.derivHub = dependencies.derivHub || new DerivativesSensorHub(config.derivConfig || {});
    this.liqHub = dependencies.liqHub || new LiquiditySensorHub(config.liqConfig || {});
    this.goldiHub = dependencies.goldiHub || new GoldilocksSensorHub(config.goldiConfig || {});
  }

  getId() {
    return 'DAILY_PORTFOLIO_COMPASS';
  }

  getName() {
    return 'Täglicher Taktischer Portfolio-Kompass';
  }

  getComponentType() {
    return 'ANALYSIS';
  }

  /**
   * Haupt-Evaluierung des Kompasses
   * @param {Array} timeline - Historische Timeline aus FinanceExpert
   * @param {Object} context - Optionaler Kontext (dateOverride)
   * @returns {Object}
   */
  evaluate(timeline, context = {}) {
    if (!Array.isArray(timeline) || timeline.length < 21) {
      return {
        date: null,
        status: SignalStatus.UNKNOWN,
        message: 'Zu wenig Daten für Kompass-Auswertung (< 21 Tage)',
        hubs: {
          liquidity: null,
          derivatives: null,
          goldilocks: null
        }
      };
    }

    const n = timeline.length;
    let targetIdx = n - 1;

    if (context.dateOverride) {
      const foundIdx = timeline.findIndex(t => t.date >= context.dateOverride);
      if (foundIdx !== -1) targetIdx = foundIdx;
    }

    const slice = timeline.slice(0, targetIdx + 1);
    if (slice.length < 21) {
      return {
        date: null,
        status: SignalStatus.UNKNOWN,
        message: 'Historie für den Ziel-Stichtag zu kurz (< 21 Tage)',
        hubs: {
          liquidity: null,
          derivatives: null,
          goldilocks: null
        }
      };
    }

    const day = timeline[targetIdx];
    const dateStr = day.date;

    // 1. Die drei Sensor-Hubs auswerten
    const liq = this.liqHub.evaluate(slice);
    const deriv = this.derivHub.evaluate(slice);
    const goldi = this.goldiHub.evaluate(slice);

    // 2. Gesamt-Status ermitteln (höchste Kritikalität gewinnt)
    let status = SignalStatus.OK;
    if (liq.status === SignalStatus.CRITICAL || deriv.status === SignalStatus.CRITICAL || goldi.status === SignalStatus.CRITICAL) {
      status = SignalStatus.CRITICAL;
    } else if (liq.status === SignalStatus.WARNING || deriv.status === SignalStatus.WARNING || goldi.status === SignalStatus.WARNING) {
      status = SignalStatus.WARNING;
    } else if (liq.status === SignalStatus.UNKNOWN && deriv.status === SignalStatus.UNKNOWN && goldi.status === SignalStatus.UNKNOWN) {
      status = SignalStatus.UNKNOWN;
    }

    // 3. Konsolen-Ausgabe der Roh-Signale aller 3 Hubs
    console.log('\n================================================================================');
    console.log(`🧭 SENSOR-HUB AUSWERTUNG | Stichtag: ${dateStr}`);
    console.log('================================================================================');
    
    console.log('1. 💧 LIQUIDITY-SENSOR-HUB:');
    console.log(`   • Status:  ${liq.status}`);
    console.log(`   • Regime:  ${liq.regime}`);
    const slackStr = liq.liquidSlackBillion !== undefined && liq.liquidSlackBillion !== null ? `$${liq.liquidSlackBillion.toFixed(1)}B` : 'N/A';
    const ttcStr = liq.ttcDays !== null && liq.ttcDays !== undefined ? `${liq.ttcDays} Tage` : 'Puffer';
    console.log(`   • Slack:   ${slackStr} | TTC: ${ttcStr}`);
    console.log(`   • Message: ${liq.message}`);
    console.log('--------------------------------------------------------------------------------');

    console.log('2. ⚡ DERIVATIVES-SENSOR-HUB:');
    console.log(`   • Status:  ${deriv.status}`);
    console.log(`   • Regime:  ${deriv.regime}`);
    const opexType = deriv.isQuadrupleWitching ? 'Hexensabbat (Quadruple Witching)' : 'Monats-OpEx';
    console.log(`   • Zyklus:  ${deriv.daysToOpEx ?? 'N/A'} Tage bis ${opexType}`);
    console.log(`   • Message: ${deriv.message}`);
    console.log('--------------------------------------------------------------------------------');

    console.log('3. 🥣 GOLDILOCKS-SENSOR-HUB:');
    console.log(`   • Status:  ${goldi.status}`);
    console.log(`   • Regime:  ${goldi.regime}`);
    console.log(`   • Score:   ${goldi.score ?? 'N/A'}`);
    console.log(`   • Message: ${goldi.message}`);
    console.log('================================================================================\n');

    return {
      date: dateStr,
      status,
      hubs: {
        liquidity: liq,
        derivatives: deriv,
        goldilocks: goldi
      }
    };
  }
}
