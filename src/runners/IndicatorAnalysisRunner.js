import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../core/Logger.js';
import { FinanceExpert } from '../services/FinanceExpert.js';
import { MLRegimeService } from '../services/MLRegimeService.js';
import { MlRegimeRadarMacroIndicator } from '../analysis/indicators/MlRegimeRadarMacroIndicator.js';
import { IndicatorEngine } from '../analysis/IndicatorEngine.js';
import { NtfyService } from '../services/NtfyService.js';
import { ScenarioChecklistService } from '../services/ScenarioChecklistService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class IndicatorAnalysisRunner {
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.isTest = Boolean(options.test);
    this.dependencies = dependencies;
    this.expert = null;
  }

  async run() {
    try {
      Logger.info('[Analysis] Lade historische Daten aus lokaler Datenbank...');
      const dbUrl = this.isTest ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL) : process.env.DATABASE_URL;
      
      if (!dbUrl && !this.dependencies.expert) {
        throw new Error("Missing DATABASE_URL in environment.");
      }

      this.expert = this.dependencies.expert || new FinanceExpert(dbUrl);
      const groupedData = await this.expert.getDailyGroupedData('2015-01-01');

      // --- ML Regime Integration ---
      const getCandles = (data, assetName, volName) => data.map(d => ({
        date: d.date,
        close: d.assets?.[assetName],
        volume: d.assets?.[volName] || 0,
        high: d.assets?.[`${assetName}_High`] || d.assets?.[assetName],
        low: d.assets?.[`${assetName}_Low`] || d.assets?.[assetName]
      })).filter(c => c.close !== null && c.close !== undefined);

      const runPredict = async (modelName, assetName, volName, targetField) => {
        try {
          const candles = getCandles(groupedData, assetName, volName);
          if (candles.length >= 50) {
            const mlService = this.dependencies.mlServiceBuilder ? this.dependencies.mlServiceBuilder(modelName) : new MLRegimeService(modelName);
            const mlPrediction = await mlService.predict(candles);
            if (groupedData && groupedData.length > 0) {
              groupedData[groupedData.length - 1][targetField] = mlPrediction;
            }
            Logger.info(`[ML-Regime] ${assetName} Prognose: ${mlPrediction.phase} (${(mlPrediction.confidence * 100).toFixed(1)}%)`);
          } else {
            Logger.warn(`[ML-Regime] Zu wenige Kerzen für ${assetName} (${candles.length} < 50). Prognose übersprungen.`);
          }
        } catch (e) {
          Logger.error(`[ML-Regime] Fehler bei der Prognose für ${assetName} (${modelName}):`, e.message);
        }
      };

      await runPredict('btc_regime_v2', 'BTC', 'BTC_Volume', 'mlRegimeBtc');
      await runPredict('spy_regime_v1', 'SPY', 'SPY_Volume', 'mlRegimeSpy');
      await runPredict('qqq_regime_v1', 'QQQ', 'QQQ_Volume', 'mlRegimeQqq');

      try {
        if (groupedData && groupedData.length > 0) {
          const macroIndicator = this.dependencies.macroIndicator || new MlRegimeRadarMacroIndicator();
          const macroResult = macroIndicator.evaluate(groupedData);
          groupedData[groupedData.length - 1].mlRegimeMacro = {
            riskPct: parseFloat(macroResult.value) || 0,
            regime: macroResult.status === 'CRITICAL' ? 'ACUTE_CRASH_RISK' : (macroResult.status === 'WARNING' ? 'ELEVATED_RISK' : 'NORMAL'),
            status: macroResult.status,
            message: macroResult.message
          };
          Logger.info(`[ML-Regime] Makro Crash-Risiko: ${macroResult.value} (${macroResult.status})`);
        }
      } catch (e) {
        Logger.error(`[ML-Regime] Fehler bei der Makro-ML-Prognose:`, e.message);
      }
      // -----------------------------

      const notifPath = path.resolve(process.cwd(), 'config/Notification-Config.json');
      let notificationConfig = { topics: {}, indicators: {} };
      if (fs.existsSync(notifPath)) {
        notificationConfig = JSON.parse(fs.readFileSync(notifPath, 'utf8'));
      }

      const cyclePath = path.resolve(process.cwd(), 'config/Cycle-Base-Config.json');
      let cycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21', dangerWindowStartDays: 970 } };
      if (fs.existsSync(cyclePath)) {
        cycleConfig = JSON.parse(fs.readFileSync(cyclePath, 'utf8'));
      }

      const pipelineConfigPath = path.resolve(process.cwd(), 'config/Indicator-Pipeline-Config.json');
      let indicatorPipelineConfig = null;
      if (fs.existsSync(pipelineConfigPath)) {
        try {
          indicatorPipelineConfig = JSON.parse(fs.readFileSync(pipelineConfigPath, 'utf8'));
        } catch (e) {
          Logger.warn(`[Config] Konnte Indicator-Pipeline-Config.json nicht parsen: ${e.message}`);
        }
      }

      const engine = this.dependencies.indicatorEngine || new IndicatorEngine(notificationConfig, cycleConfig, indicatorPipelineConfig);

      // 1. Ausgabe im Terminal (mit Farben)
      engine.run(groupedData);

      // 2. Ntfy Alerting (Warnungen & Kritisch sowie Daily Status)
      const ntfyTopic = process.env.NTFY_TOPIC || this.dependencies.ntfyTopic;
      if (ntfyTopic) {
        const alertHistoryPath = path.resolve(__dirname, '../../config/alert_history.json');
        let alertHistory = {};
        if (fs.existsSync(alertHistoryPath)) {
          try {
            alertHistory = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));
          } catch (e) {
            Logger.warn('[Alerting] Konnte alert_history.json nicht parsen, starte neu.');
          }
        }

        const ntfy = this.dependencies.ntfyService || new NtfyService(ntfyTopic);
        const alertResult = engine.getAlerts(groupedData, alertHistory);

        if (alertResult && alertResult.notifications) {
          Logger.info(`[Alerting] Sende ${alertResult.notifications.length} spezifische Ntfy Push-Alarme...`);
          for (const notif of alertResult.notifications) {
            await ntfy.send(notif.title, notif.message, notif.priority, notif.tags);
          }

          // History speichern (Debouncing greift)
          fs.writeFileSync(alertHistoryPath, JSON.stringify(alertResult.updatedHistory, null, 2), 'utf8');
        } else {
          Logger.info('[Alerting] Keine akuten Warnungen (alles im grünen Bereich oder bereits benachrichtigt).');
        }

        Logger.info('[Alerting] Sende Daily Status Report...');
        const daily = engine.getDailyStatusReport(groupedData);
        if (daily) {
          await ntfy.send(daily.title, daily.message, daily.priority, daily.tags);
        }

        // --- Makro-Szenario & Rallye-Checkliste ---
        const scenarioService = this.dependencies.scenarioService || new ScenarioChecklistService();
        const latestDay = groupedData[groupedData.length - 1];
        const latestDateStr = latestDay ? latestDay.date : new Date().toISOString().split('T')[0];
        const activeEvent = scenarioService.getEventForDate(latestDateStr);
        const alreadyReported = activeEvent && alertHistory.scenarioEvents && alertHistory.scenarioEvents[activeEvent.id] === latestDateStr;

        if (!alreadyReported) {
          const scenarioResult = scenarioService.evaluate(latestDateStr, groupedData);
          if (scenarioResult && scenarioResult.shouldNotify) {
            Logger.info(`[Alerting] Sende Makro-Szenario Scorecard für ${latestDateStr}...`);
            await ntfy.send(scenarioResult.title, scenarioResult.message, scenarioResult.priority, scenarioResult.tags);

            if (activeEvent) {
              alertHistory.scenarioEvents = alertHistory.scenarioEvents || {};
              alertHistory.scenarioEvents[activeEvent.id] = latestDateStr;
              fs.writeFileSync(alertHistoryPath, JSON.stringify(alertHistory, null, 2), 'utf8');
            }
          }
        } else {
          Logger.info(`[Alerting] Makro-Szenario Event '${activeEvent.id}' für ${latestDateStr} bereits gemeldet. Überspringe.`);
        }

        if (Logger.hasIssues()) {
          Logger.info('[Alerting] Sende System-Health Report (Fehler/Warnungen)...');
          await ntfy.send('CrashRadar System-Health Report', Logger.getSummary(), 'high', 'warning');
        }
      } else {
        Logger.info('[Alerting] NTFY_TOPIC nicht gesetzt. Überspringe Ntfy Push.');
      }
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.expert) {
      await this.expert.close();
      this.expert = null;
    }
  }
}
