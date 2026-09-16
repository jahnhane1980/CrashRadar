import dotenv from 'dotenv';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { DerivativesSensorHub } from '../src/signals/hubs/DerivativesSensorHub.js';
import { LiquiditySensorHub } from '../src/signals/hubs/LiquiditySensorHub.js';
import { GoldilocksSensorHub } from '../src/signals/hubs/GoldilocksSensorHub.js';

dotenv.config();

export class DailyMacroCompass {
  constructor() {
    this.derivHub = new DerivativesSensorHub();
    this.liqHub = new LiquiditySensorHub();
    this.goldiHub = new GoldilocksSensorHub();
  }

  generateBriefing(timeline, targetDate) {
    const idx = timeline.findIndex(t => t.date >= targetDate);
    if (idx === -1) return { error: `Datum ${targetDate} nicht in Timeline gefunden.` };

    const slice = timeline.slice(0, idx + 1);
    const day = timeline[idx];

    // Hubs auswerten
    const deriv = this.derivHub.evaluate(slice);
    const liq = this.liqHub.evaluate(slice);
    const goldi = this.goldiHub.evaluate(slice);

    // Markt-Kontext
    const spy = day.assets?.SPY;
    let sma200Sum = 0;
    let sma200Count = 0;
    for (let i = Math.max(0, idx - 199); i <= idx; i++) {
      if (timeline[i].assets?.SPY) {
        sma200Sum += timeline[i].assets.SPY;
        sma200Count++;
      }
    }
    const sma200 = sma200Sum / (sma200Count || 1);
    const isAboveSma200 = spy >= sma200;

    // Synthese: Ist die Liquidität akutes Gift oder grünes Licht?
    const isAcuteDrain = liq.catalystStatus === 'IMMINENT_DRAIN' || (liq.ttcDays !== null && liq.ttcDays < 20);
    const isSevereStress = liq.diagnostics?.dualMacroStress >= 65;

    let sentimentBadge = '🟢 GRÜNES LICHT (DIP-BUYING BEGÜNSTIGT)';
    let guidanceHeadline = 'Keine Panik! Liquidität & Zyklen geben Rückendeckung.';
    let actionAdvice = 'Rücksetzer vor dem Verfallstag können gezielt als "Buy the Dip" genutzt werden. Einstiegs-Sniper scharf stellen.';

    if (isAcuteDrain || isSevereStress) {
      sentimentBadge = '🔴 HALT STOPP! (FINGER WEG / DON\'T DO IT)';
      guidanceHeadline = 'Achtung: Akuter Liquiditäts-Abzug im Geldmarkt!';
      actionAdvice = 'Kein unüberlegtes Hineingreifen in fallende Kurse! Die Liquidität entzieht dem Markt den Boden. Warten auf Entwarnung oder Absicherung hochfahren.';
    } else if (liq.status === 'WARNING' || !isAboveSma200) {
      sentimentBadge = '🟡 WACHSAME GELASSENHEIT (DIP MIT VORSICHT)';
      guidanceHeadline = 'Markt ist nervös, aber kein System-Crash in Sicht.';
      actionAdvice = 'Rebound-Chancen vorhanden, aber mit moderater Positionsgröße und striktem Trailing-Stop agieren (Puffer-Phase im Geldmarkt).';
    }

    return {
      date: day.date,
      spyPrice: spy?.toFixed(2),
      isAboveSma200,
      sentimentBadge,
      guidanceHeadline,
      actionAdvice,
      details: {
        derivatives: {
          regime: deriv.regime,
          status: deriv.status,
          message: deriv.message,
          daysToOpex: deriv.diagnostics?.daysToNextOpex,
          isQuad: deriv.diagnostics?.isQuadWitching
        },
        liquidity: {
          regime: liq.regime,
          status: liq.status,
          slackBillion: liq.liquidSlackBillion,
          ttcDays: liq.ttcDays,
          catalyst: liq.catalystStatus,
          message: liq.message
        },
        macro: {
          regime: goldi.regime,
          status: goldi.status,
          coreCpiYoY: goldi.diagnostics?.inflation?.coreCpiYoY?.toFixed(2),
          realYield10y: goldi.diagnostics?.monetary?.realYield10y?.toFixed(2),
          oilPrice: goldi.diagnostics?.inflation?.oilPrice?.toFixed(1)
        }
      }
    };
  }
}

async function runDemo() {
  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
  const compass = new DailyMacroCompass();

  // Teste 4 prägnante Tage:
  // 1. 20.02.2020: Vor-Corona-Crash (Wo der User "Halt Stop" hören wollte)
  // 2. 20.03.2020: Corona-Boden (Wo der Einstiegs-Sniper zuschlagen sollte)
  // 3. 11.03.2026: Ein normaler Tag im März 2026
  // 4. 10.09.2026: Ein Tag im September 2026 vor dem Hexensabbat
  const testDates = ['2020-02-21', '2020-03-20', '2026-03-11', '2026-09-10'];

  for (const d of testDates) {
    const report = compass.generateBriefing(timeline, d);
    console.log('================================================================================');
    console.log(`📅 TÄGLICHER MAKRO- & LIQUIDITÄTS-KOMPASS: ${report.date}`);
    console.log(`SPY: ${report.spyPrice}$ | Trend: ${report.isAboveSma200 ? 'Über SMA200 (Bulle)' : 'Unter SMA200 (Korrektur/Bär)'}`);
    console.log(`STATUS: ${report.sentimentBadge}`);
    console.log(`KERN-BOTSCHAFT: ${report.guidanceHeadline}`);
    console.log(`HANDLUNGSEMPFEHLUNG: ${report.actionAdvice}`);
    console.log('--------------------------------------------------------------------------------');
    console.log(`• Derivate-Zyklus:   ${report.details.derivatives.regime} (${report.details.derivatives.message})`);
    console.log(`• Liquiditäts-Check: ${report.details.liquidity.regime} (Slack: $${report.details.liquidity.slackBillion}B | TTC: ${report.details.liquidity.ttcDays} Tage | ${report.details.liquidity.message})`);
    console.log(`• Zinsen & Makro:    ${report.details.macro.regime} (Realzins: ${report.details.macro.realYield10y}% | Core-CPI: ${report.details.macro.coreCpiYoY}% | Öl: ${report.details.macro.oilPrice}$)`);
    console.log('================================================================================\n');
  }

  process.exit(0);
}

runDemo().catch(err => {
  console.error(err);
  process.exit(1);
});
