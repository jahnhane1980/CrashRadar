import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../core/Logger.js';
import { NtfyService } from './NtfyService.js';
import { PortfolioStrategyInterface } from '../strategies/PortfolioStrategyInterface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_HISTORY_PATH = path.resolve(__dirname, '../../config/alert_history.json');

/**
 * StrategyNotificationService
 * 
 * Provider-agnostischer Benachrichtigungs-Dienst für Portfoliostrategien:
 * 
 * ARCHITEKTUR-PRINZIP:
 * 1. Trennung von Fachlogik & Transport: Die Strategie berechnet nur Zahlen & Status.
 * 2. Entkoppelte Konfiguration: Keine hardcodierten Topics oder Secrets im Code.
 *    Die Strategie definiert im Manifest (config/strategies/<id>.json) den Namen
 *    der Umgebungsvariable (z.B. env_topic_key: "NTFY_PORTFOLIO_GOLD_SPY").
 * 3. Intelligentes State-Tracking (Anti-Spam via alert_history.json):
 *    - Prio 1 (State-Change): Sofort-Alarm bei Status-Wechsel (z.B. NORMAL -> EMERGENCY_HEDGE).
 *    - Prio 2 (Monats-Sparplan): Geplante Order-Anweisung am 1. des Monats.
 *    - Prio 3 (Status unverändert): Kein täglicher Chat-Spam, absolute Ruhe auf dem Smartphone.
 */
export class StrategyNotificationService {
  constructor(config = {}, dependencies = {}) {
    this.historyPath = config.historyPath || DEFAULT_HISTORY_PATH;
    this.ntfyServiceBuilder = dependencies.ntfyServiceBuilder || ((topic) => new NtfyService(topic));
  }

  loadAlertHistory() {
    try {
      if (fs.existsSync(this.historyPath)) {
        const raw = fs.readFileSync(this.historyPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      Logger.warn(`[StrategyNotificationService] Konnte alert_history.json nicht lesen: ${e.message}`);
    }
    return {};
  }

  saveAlertHistory(history) {
    try {
      const dir = path.dirname(this.historyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
      Logger.error(`[StrategyNotificationService] Fehler beim Speichern von alert_history.json: ${e.message}`);
    }
  }

  /**
   * Zeichnet einen horizontalen Unicode-Balken für Allokations-Quoten
   */
  static renderBar(pct, barLength = 10) {
    const filled = Math.round((pct / 100) * barLength);
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, barLength - filled));
  }

  /**
   * Formatiert einen ansprechenden Markdown-Bericht für das Smartphone
   */
  formatStrategyMessage(strategyId, strategyResult, macroSignalContext = {}, manifest = {}) {
    const status = strategyResult.status || 'NORMAL';
    const action = strategyResult.trancheAction || strategyResult.action || 'HOLD';
    const reason = strategyResult.reason || 'Keine Begründung angegeben.';
    const dateStr = strategyResult.date || new Date().toISOString().split('T')[0];
    const strategyName = manifest.name || strategyId;

    let statusEmoji = '🟢';
    let alertBanner = '';

    if (status === 'EMERGENCY_HEDGE') {
      statusEmoji = '🚨';
      alertBanner = '> ⚠️ **KATASTROPHEN-SCHUTZSCHILD AKTIVIERT!**\n> System-Trend gebrochen & Makro-Panik aktiv. Risikopositionen evakuiert.\n\n';
    } else if (status === 'PRE_MARGIN_CASH_LOCK') {
      statusEmoji = '💰';
      alertBanner = '> 🚨 **PRE-MARGIN-CALL GEWINNSICHERUNG!**\n> SPY Drawdown hat -18% erreicht. Gold glattstellen und 100% Cash halten VOR dem -20% Margin Call!\n\n';
    } else if (status === 'MARGIN_CALL_ACTIVE') {
      statusEmoji = '⚠️';
      alertBanner = '> ⚠️ **MARGIN-CALL KASKADE IM GANGE (SPY <= -20%)!**\n> Liquidierungswelle läuft. Füße stillhalten, Cash-Airbag sichert das Kapital.\n\n';
    } else if (status === 'RE_ENTRY_SNIPER') {
      statusEmoji = '🎯';
      alertBanner = '> 🎯 **GENERATIONEN-BODEN SNIPER AKTIV!**\n> Panik-Tiefpunkt bestätigt. Jetzt antizyklisch Cash in den Markt deployen!\n\n';
    }

    let msg = `## ${statusEmoji} ${strategyName}\n\n`;
    msg += `**Stichtag:** ${dateStr} | **Status:** \`${status}\`\n`;
    msg += `**Empfohlene Aktion:** \`${action}\`\n\n`;

    if (alertBanner) {
      msg += alertBanner;
    }

    // Allokations-Tabelle (falls targetAllocationPct vorhanden)
    if (strategyResult.targetAllocationPct && Object.keys(strategyResult.targetAllocationPct).length > 0) {
      msg += `### 📊 Ziel-Allokation\n`;
      for (const [asset, pct] of Object.entries(strategyResult.targetAllocationPct)) {
        const bar = StrategyNotificationService.renderBar(pct, 10);
        msg += `• **${asset.padEnd(5, ' ')}:** ${pct.toFixed(1).padStart(5, ' ')}%  \`${bar}\`\n`;
      }
      msg += '\n';
    }

    // Begründung / Handlungsanweisung
    msg += `### ℹ️ Handlungsanweisung\n${reason}\n\n`;

    // Makro-Wetter Kurzübersicht
    msg += `### 🔍 Makro-Fundament & Sensorik\n`;
    const km = macroSignalContext.katastrophenMatrix;
    const gs = macroSignalContext.goldSniper;
    const tc = macroSignalContext.treasuryCapacity;

    if (km) {
      const kmIcon = km.isShieldActive ? '🔴' : (km.status === 'WARNING' ? '🟡' : '🟢');
      const spyPriceStr = km.spyPrice ? `$${km.spyPrice.toFixed(2)}` : '-';
      const spyDdStr = km.spyDrawdownPct != null ? `${km.spyDrawdownPct.toFixed(1)}%` : '-';
      msg += `• **SPY Benchmark:** ${spyPriceStr} (DD: ${spyDdStr})\n`;
      msg += `• **Katastrophen-Matrix:** ${kmIcon} \`${km.status}\` (${km.signal || 'NONE'})\n`;
    }

    if (gs) {
      const gsIcon = gs.isCashLockActive ? '💰' : (gs.isGoldHedgeActive ? '🥇' : '🟢');
      msg += `• **Gold-Sniper:** ${gsIcon} \`${gs.state}\` (${gs.signal || 'NONE'})\n`;
    }

    if (tc) {
      const tcIcon = tc.status === 'CRITICAL' ? '🔴' : (tc.status === 'WARNING' ? '🟡' : '🟢');
      const tcScore = tc.value || (tc.details?.score != null ? `${tc.details.score}/100` : '-');
      msg += `• **Liquiditäts-Radar:** ${tcIcon} Score ${tcScore}\n`;
    }

    return msg.trim();
  }

  /**
   * Prüft und versendet Benachrichtigungen für alle ausgeführten Strategien.
   * @param {Object} evalResult - Rückgabe von PortfolioStrategyEngine.evaluateAll()
   * @param {Object} [options={}] - z.B. { forceSend: true }
   * @returns {Promise<Array>} Liste der versendeten Alerts
   */
  async dispatchStrategyAlerts(evalResult, options = {}) {
    const { strategyResults = {}, macroSignalContext = {} } = evalResult;
    const todayStr = evalResult.date || new Date().toISOString().split('T')[0];
    const forceSend = Boolean(options.forceSend);

    const alertHistory = this.loadAlertHistory();
    if (!alertHistory.strategyStates) {
      alertHistory.strategyStates = {};
    }

    const dispatchedAlerts = [];

    for (const [strategyId, result] of Object.entries(strategyResults)) {
      if (!result || result.status === 'ERROR') continue;

      let manifest = {};
      try {
        manifest = PortfolioStrategyInterface.loadManifest(strategyId);
      } catch (e) {
        // Fallback falls kein Manifest vorliegt
        manifest = { id: strategyId, name: strategyId };
      }

      const notifConfig = manifest.notifications || {};
      if (notifConfig.enabled === false) {
        Logger.info(`[StrategyNotificationService] Benachrichtigungen für '${strategyId}' deaktiviert.`);
        continue;
      }

      const channels = notifConfig.channels || [];
      if (channels.length === 0) {
        continue;
      }

      const prevState = alertHistory.strategyStates[strategyId] || null;
      const currentStatus = result.status;
      const isStateChange = !prevState || (prevState.lastStatus !== currentStatus);

      // Monatsprüfung (z.B. am 1. des Monats)
      const isMonthlySavingsDay = notifConfig.triggers?.monthly_savings_day !== undefined
        ? new Date(todayStr).getDate() === Number(notifConfig.triggers.monthly_savings_day)
        : false;
      const monthlyAlreadySent = prevState && prevState.lastMonthlyAlertDate === todayStr;
      const shouldSendMonthly = isMonthlySavingsDay && !monthlyAlreadySent;

      // Entscheidung ob Benachrichtigung erfolgen soll
      const shouldSend = forceSend || isStateChange || shouldSendMonthly;

      if (!shouldSend) {
        Logger.info(`[StrategyNotificationService] [${strategyId}] Status unverändert (${currentStatus}) & kein Stichtag. Smartphone-Ruhe gewahrt.`);
        continue;
      }

      const formattedMessage = this.formatStrategyMessage(strategyId, result, macroSignalContext, manifest);

      for (const channel of channels) {
        if (channel.provider === 'ntfy') {
          const envTopicKey = channel.env_topic_key || 'NTFY_PORTFOLIO_TOPIC';
          const topic = process.env[envTopicKey];

          if (!topic) {
            Logger.warn(`[StrategyNotificationService] [${strategyId}] Kein Ntfy-Topic unter '${envTopicKey}' in .env gefunden. Alert übersprungen.`);
            continue;
          }

          const ntfyService = this.ntfyServiceBuilder(topic);
          const priority = (currentStatus === 'EMERGENCY_HEDGE' || currentStatus === 'PRE_MARGIN_CASH_LOCK' || currentStatus === 'RE_ENTRY_SNIPER')
            ? 'high'
            : (channel.priority || 'default');
          const tags = channel.tags || ['chart_with_upwards_trend'];
          const title = `${channel.title || strategyId}: ${result.trancheAction || result.action || currentStatus}`;

          try {
            await ntfyService.send(title, formattedMessage, priority, tags);
            dispatchedAlerts.push({
              strategyId,
              provider: 'ntfy',
              topic,
              status: currentStatus,
              action: result.trancheAction || result.action
            });
            Logger.info(`[StrategyNotificationService] ✅ [${strategyId}] Alert erfolgreich an Ntfy Topic '${topic}' gesendet.`);
          } catch (sendErr) {
            Logger.error(`[StrategyNotificationService] Fehler beim Senden an Ntfy für '${strategyId}':`, sendErr.message);
          }
        }
      }

      // State History aktualisieren
      alertHistory.strategyStates[strategyId] = {
        lastStatus: currentStatus,
        lastAction: result.trancheAction || result.action || 'HOLD',
        lastAlertDate: todayStr,
        lastMonthlyAlertDate: shouldSendMonthly ? todayStr : (prevState?.lastMonthlyAlertDate || null),
        lastTargetAllocation: result.targetAllocationPct || null,
        updatedAt: new Date().toISOString()
      };
    }

    this.saveAlertHistory(alertHistory);
    return dispatchedAlerts;
  }
}
