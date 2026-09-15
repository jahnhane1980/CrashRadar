import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Logger } from '../core/Logger.js';
import { FinanceExpert } from '../services/FinanceExpert.js';
import { NtfyService } from '../services/NtfyService.js';
import { DailyPortfolioCompass } from '../analysis/DailyPortfolioCompass.js';
import { SignalStatus } from '../signals/contracts/SignalTypes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * DailyPortfolioCompassRunner
 * 
 * Taktischer Runner für den täglichen Portfolio-Kompass:
 * - Lädt die aggregierten Daten über FinanceExpert
 * - Führt die Evaluierung über DailyPortfolioCompass aus (die 3 Sensor-Hubs)
 * - Sendet auf Wunsch einen Push-Alert via Ntfy (NTFY_PORTFOLIO_COMPASS_TOPIC)
 */
export class DailyPortfolioCompassRunner {
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.dateOverride = options.date || options.dateOverride || null;
    this.sendNtfy = Boolean(options.sendNtfy || options.notify);
    this.dependencies = dependencies;

    this.ntfyTopic = process.env.NTFY_PORTFOLIO_COMPASS_TOPIC || null;
    this.ntfyService = dependencies.ntfyService || (this.ntfyTopic ? new NtfyService(this.ntfyTopic) : null);
    this.compass = dependencies.compass || new DailyPortfolioCompass();
  }

  /**
   * Formatiert das Briefing für Terminal
   */
  formatBriefing(result) {
    const { date, status, hubs } = result;
    if (!hubs) return `🧭 Stichtag: ${date || 'N/A'} | Status: ${status}`;

    const { liquidity, derivatives, goldilocks } = hubs;

    let report = [];
    report.push('================================================================================');
    report.push(`🧭 CRASHRADAR TÄGLICHER PORTFOLIO-KOMPASS | Stichtag: ${date}`);
    report.push(`GESAMTSTATUS: ${status}`);
    report.push('================================================================================');
    if (liquidity) {
      report.push(`1. 💧 Liquidität:    ${liquidity.status} | Regime: ${liquidity.regime} | Slack: $${liquidity.liquidSlackBillion?.toFixed(1) || '0'}B | TTC: ${liquidity.ttcDays !== null ? liquidity.ttcDays + 'd' : 'Puffer'}`);
      report.push(`   👉 ${liquidity.message}`);
    }
    if (derivatives) {
      const opexName = derivatives.isQuadrupleWitching ? 'Hexensabbat' : 'OpEx';
      report.push(`2. ⚡ Derivate:      ${derivatives.status} | Regime: ${derivatives.regime} | OpEx: ${derivatives.daysToOpEx ?? 'N/A'}d (${opexName})`);
      report.push(`   👉 ${derivatives.message}`);
    }
    if (goldilocks) {
      report.push(`3. 🥣 Goldilocks:    ${goldilocks.status} | Regime: ${goldilocks.regime} | Score: ${goldiScore(goldilocks.score)}`);
      report.push(`   👉 ${goldilocks.message}`);
    }
    report.push('================================================================================');
    return report.join('\n');
  }

  /**
   * Formatiert eine kompakte Nachricht für Ntfy Push
   */
  formatNtfyMessage(result) {
    const { date, status, hubs } = result;
    const { liquidity, derivatives, goldilocks } = hubs || {};

    let lines = [];
    lines.push(`## 🧭 CrashRadar Kompass (${status})`);
    lines.push(`**Stichtag: ${date}**`);
    lines.push('');
    if (liquidity) {
      lines.push(`- **Liquidität (${liquidity.status}):** ${liquidity.regime} (TTC: ${liquidity.ttcDays ?? 'Puffer'}) – _${liquidity.message}_`);
    }
    if (derivatives) {
      const opexName = derivatives.isQuadrupleWitching ? 'Hexensabbat' : 'OpEx';
      lines.push(`- **Derivate (${derivatives.status}):** ${derivatives.regime} (${derivatives.daysToOpEx}d bis ${opexName}) – _${derivatives.message}_`);
    }
    if (goldilocks) {
      lines.push(`- **Goldilocks (${goldilocks.status}):** ${goldilocks.regime} – _${goldilocks.message}_`);
    }
    return lines.join('\n');
  }

  async run() {
    try {
      Logger.info('[DailyPortfolioCompass] Starte Kompass-Evaluierung...');

      let timeline = this.dependencies.timeline;
      if (!timeline) {
        const expert = this.dependencies.expert || new FinanceExpert();
        Logger.info('[DailyPortfolioCompass] Lade aggregierte Timeline via FinanceExpert (ab 2018)...');
        timeline = await expert.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });
      }

      if (!Array.isArray(timeline) || timeline.length === 0) {
        throw new Error('FinanceExpert lieferte keine Daten für die Timeline.');
      }

      const result = this.compass.evaluate(timeline, {
        dateOverride: this.dateOverride
      });

      if (this.sendNtfy) {
        if (!this.ntfyTopic) {
          Logger.warn('[DailyPortfolioCompass] NTFY_PORTFOLIO_COMPASS_TOPIC nicht gesetzt. Kein Push-Alert möglich.');
        } else {
          Logger.info(`[DailyPortfolioCompass] Sende Push-Alert an Ntfy Topic '${this.ntfyTopic}'...`);
          const ntfyMsg = this.formatNtfyMessage(result);
          
          let priority = 'default';
          let tags = 'compass,world_map';
          if (result.status === SignalStatus.CRITICAL) {
            priority = 'urgent';
            tags = 'rotating_light,warning,stop_sign';
          } else if (result.status === SignalStatus.WARNING) {
            priority = 'high';
            tags = 'warning,hourglass_flowing_sand';
          }

          const safeTitle = `CrashRadar Kompass: ${result.status} (${result.date || ''})`.trim();
          await this.ntfyService.send(safeTitle, ntfyMsg, priority, tags);
        }
      } else {
        Logger.info('[DailyPortfolioCompass] Lokaler Modus: Ntfy-Versand übersprungen (aktivierbar mit --notify oder --send-ntfy).');
      }

      Logger.info('[DailyPortfolioCompass] Evaluierung erfolgreich abgeschlossen.');
      return result;
    } catch (error) {
      Logger.error('[DailyPortfolioCompass] Fehler beim Kompass-Lauf:', error.message);
      throw error;
    }
  }
}

function goldiScore(score) {
  return score !== undefined && score !== null ? String(score) : 'N/A';
}

// Direkte CLI-Ausführung
if (process.argv[1] && (process.argv[1].endsWith('DailyPortfolioCompassRunner.js') || fileURLToPath(import.meta.url) === process.argv[1])) {
  const args = process.argv.slice(2);
  let dateOverride = null;
  let sendNtfy = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      dateOverride = args[i + 1];
      i++;
    } else if (args[i].startsWith('--date=')) {
      dateOverride = args[i].split('=')[1];
    } else if (args[i] === '--notify' || args[i] === '--send-ntfy') {
      sendNtfy = true;
    }
  }

  const runner = new DailyPortfolioCompassRunner({
    date: dateOverride,
    sendNtfy
  });

  runner.run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
