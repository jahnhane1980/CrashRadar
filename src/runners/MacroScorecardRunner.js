import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../core/Logger.js';
import { Storage } from '../core/Storage.js';
import { RequestManager } from '../core/RequestManager.js';
import { TimeSeriesFetcher } from '../services/TimeSeriesFetcher.js';
import { ErrorRegistry } from '../core/ErrorRegistry.js';
import { FinanceExpert } from '../services/FinanceExpert.js';
import { NtfyService } from '../services/NtfyService.js';
import { ScenarioChecklistService } from '../services/ScenarioChecklistService.js';
import { TestRunner } from './TestRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MacroScorecardRunner {
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.isTest = Boolean(options.test);
    this.dependencies = dependencies;
    this.storage = null;
    this.expert = null;
  }

  async run() {
    try {
      Logger.info('[MacroScorecard] Starte Smart-Makro-Scorecard Check...');
      const scenarioService = this.dependencies.scenarioService || new ScenarioChecklistService();
      const todayStr = this.options.dateOverride || new Date().toISOString().split('T')[0];
      const todayEvent = scenarioService.getEventForDate(todayStr);

      if (!todayEvent) {
        Logger.info(`[MacroScorecard] Kein Makro-Event für heute (${todayStr}) im aktiven Szenario geplant. Vorgang beendet.`);
        return;
      }

      const alertHistoryPath = path.resolve(__dirname, '../../config/alert_history.json');
      let alertHistory = {};
      if (fs.existsSync(alertHistoryPath)) {
        try {
          alertHistory = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));
        } catch (e) {
          Logger.warn('[MacroScorecard] Konnte alert_history.json nicht parsen.');
        }
      }

      if (alertHistory.scenarioEvents && alertHistory.scenarioEvents[todayEvent.id] === todayStr) {
        Logger.info(`[MacroScorecard] Event '${todayEvent.title}' (${todayEvent.id}) wurde heute (${todayStr}) bereits gemeldet. Vorgang beendet.`);
        return;
      }

      const taskIds = scenarioService.getRequiredTaskIdsForEvent(todayEvent);
      Logger.info(`[MacroScorecard] Event '${todayEvent.title}' erkannt. Benötigte Tasks: [${taskIds.join(', ') || 'Keine'}]`);

      const dbUrl = this.isTest ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL) : process.env.DATABASE_URL;
      if (!dbUrl && !this.dependencies.expert) {
        throw new Error("Missing DATABASE_URL in environment.");
      }

      if (taskIds.length > 0) {
        if (this.dependencies.fetcher) {
          Logger.info(`[MacroScorecard] Führe gezielten Fetch für [${taskIds.join(', ')}] aus...`);
          await this.dependencies.fetcher.runTasksByIds(taskIds);
        } else {
          const configPath = path.resolve(__dirname, '../../config/Database-Fetcher-Config.json');
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (this.isTest) TestRunner.applyTestConfigOverrides(config);

            this.storage = this.dependencies.storage || new Storage({ databaseUrl: dbUrl });
            const requestManager = this.dependencies.requestManager || new RequestManager(config);
            const errorRegistry = this.dependencies.errorRegistry || new ErrorRegistry();
            const fetcher = new TimeSeriesFetcher(config, this.storage, requestManager, errorRegistry);

            try {
              Logger.info(`[MacroScorecard] Führe gezielten Fetch für [${taskIds.join(', ')}] aus...`);
              await fetcher.runTasksByIds(taskIds);
            } finally {
              if (this.storage) {
                await this.storage.close();
                this.storage = null;
              }
            }
          }
        }
      }

      this.expert = this.dependencies.expert || new FinanceExpert(dbUrl);
      const groupedData = await this.expert.getDailyGroupedData('2015-01-01');
      const scenarioResult = scenarioService.evaluate(todayStr, groupedData);

      if (scenarioResult && scenarioResult.shouldNotify) {
        if (process.env.NTFY_TOPIC) {
          const ntfy = this.dependencies.ntfyService || new NtfyService(process.env.NTFY_TOPIC);
          Logger.info(`[MacroScorecard] Sende Makro-Szenario Scorecard für ${todayStr}...`);
          await ntfy.send(scenarioResult.title, scenarioResult.message, scenarioResult.priority, scenarioResult.tags);

          alertHistory.scenarioEvents = alertHistory.scenarioEvents || {};
          alertHistory.scenarioEvents[todayEvent.id] = todayStr;
          fs.writeFileSync(alertHistoryPath, JSON.stringify(alertHistory, null, 2), 'utf8');
          Logger.info(`[MacroScorecard] Alert-History für ${todayEvent.id} aktualisiert.`);
        } else {
          Logger.info('[MacroScorecard] NTFY_TOPIC nicht gesetzt. Scorecard-Nachricht:\n' + scenarioResult.message);
        }
      } else if (scenarioResult && scenarioResult.isPending) {
        Logger.info(`[MacroScorecard] Daten für Event '${todayEvent.title}' (Ziel: ${todayEvent.targetObservationDate}) noch nicht bei FRED publiziert. Warte auf nächstes Zeitfenster.`);
      } else {
        Logger.info(`[MacroScorecard] Keine Benachrichtigung erforderlich für ${todayStr}.`);
      }
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.storage) {
      await this.storage.close();
      this.storage = null;
    }
    if (this.expert) {
      await this.expert.close();
      this.expert = null;
    }
  }
}
