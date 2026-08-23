import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { Logger } from './src/core/Logger.js';
import { StandardRunner } from './src/runners/StandardRunner.js';
import { TestRunner } from './src/runners/TestRunner.js';
import { FinanceExpert } from './src/services/FinanceExpert.js';
import { IndicatorEngine } from './src/analysis/IndicatorEngine.js';
import { MLRegimeService } from './src/services/MLRegimeService.js';
import { MlRegimeRadarMacroIndicator } from './src/analysis/indicators/MlRegimeRadarMacroIndicator.js';
import { NtfyService } from './src/services/NtfyService.js';
import { Storage } from './src/core/Storage.js';
import { RequestManager } from './src/core/RequestManager.js';
import { Fetcher } from './src/services/Fetcher.js';
import { MaturityWallBuilder } from './src/services/MaturityWallBuilder.js';
import { ErrorRegistry } from './src/core/ErrorRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let activeRunner = null;

process.on('SIGINT', () => {
  Logger.info('[Process] Caught interrupt signal (SIGINT). Exiting gracefully...');
  if (activeRunner) activeRunner.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('[Process] Caught termination signal (SIGTERM). Exiting gracefully...');
  if (activeRunner) activeRunner.cleanup();
  process.exit(0);
});

export async function runCLI(argv) {
  const program = new Command();
  
  program
    .name('fetcher')
    .description('Database Fetcher Application');

  program
    .option('-t, --test', 'Run the fetcher in test mode')
    .option('-c, --check-indikator', 'Run the macro financial indicator analysis');

  program.action(async (options) => {
    try {
      if (options.checkIndikator) {
        Logger.info('[Analysis] Lade historische Daten aus lokaler Datenbank...');
        const dbUrl = options.test ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL) : process.env.DATABASE_URL;
        const expert = new FinanceExpert(dbUrl);
        const groupedData = await expert.getDailyGroupedData('2015-01-01');
        
        // --- ML Regime Integration ---
        const getCandles = (data, assetName, volName) => data.map(d => ({
          date: d.date,
          close: d.assets[assetName],
          volume: d.assets[volName] || 0,
          high: d.assets[`${assetName}_High`] || d.assets[assetName],
          low: d.assets[`${assetName}_Low`] || d.assets[assetName]
        })).filter(c => c.close !== null && c.close !== undefined);

        const runPredict = async (modelName, assetName, volName, targetField) => {
          try {
            const candles = getCandles(groupedData, assetName, volName);
            if (candles.length >= 50) {
              const mlPrediction = await new MLRegimeService(modelName).predict(candles);
              groupedData[groupedData.length - 1][targetField] = mlPrediction;
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
            const macroIndicator = new MlRegimeRadarMacroIndicator();
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

        const engine = new IndicatorEngine(notificationConfig, cycleConfig);
        
        // 1. Ausgabe im Terminal (mit Farben)
        engine.run(groupedData);

        // 2. Ntfy Alerting (Warnungen & Kritisch sowie Daily Status)
        if (process.env.NTFY_TOPIC) {
          const alertHistoryPath = path.resolve(__dirname, 'config/alert_history.json');
          let alertHistory = {};
          if (fs.existsSync(alertHistoryPath)) {
            try {
              alertHistory = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));
            } catch (e) {
              Logger.warn('[Alerting] Konnte alert_history.json nicht parsen, starte neu.');
            }
          }

          const ntfy = new NtfyService(process.env.NTFY_TOPIC);
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

          if (Logger.hasIssues()) {
             Logger.info('[Alerting] Sende System-Health Report (Fehler/Warnungen)...');
             await ntfy.send('CrashRadar System-Health Report', Logger.getSummary(), 'high', 'warning');
          }
        } else {
          Logger.info('[Alerting] NTFY_TOPIC nicht gesetzt. Überspringe Ntfy Push.');
        }

        await expert.close();
        return; // Statt process.exit(0) für bessere Testbarkeit
      }

      const isTest = options.test;
      const dbUrl = isTest ? TestRunner.getDatabaseUrl() : process.env.DATABASE_URL;
      
      if (!dbUrl) throw new Error("Missing DATABASE_URL in environment.");

      const configPath = path.resolve(__dirname, 'config/Database-Fetcher-Config.json');
      if (!fs.existsSync(configPath)) {
        throw new Error(`Critical Config not found at ${configPath}. Exiting.`);
      }
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      if (isTest) {
        TestRunner.applyTestConfigOverrides(config);
      }

      const storage = new Storage({ databaseUrl: dbUrl });
      const requestManager = new RequestManager(config);
      
      const errorRegistry = new ErrorRegistry();
      const ntfyService = process.env.NTFY_TOPIC ? new NtfyService(process.env.NTFY_TOPIC) : null;
      
      const fetcher = new Fetcher(config, storage, requestManager, errorRegistry);
      const maturityWallBuilder = new MaturityWallBuilder(dbUrl);

      const runnerArgs = { config, storage, fetcher, maturityWallBuilder, errorRegistry, ntfyService };
      activeRunner = isTest ? new TestRunner(runnerArgs) : new StandardRunner(runnerArgs);
      
      await activeRunner.run();
    } catch (error) {
      Logger.error('[CLI Error]', error.message || error);
      throw error; // Statt process.exit(1) werfen wir den Fehler weiter
    }
  });

  await program.parseAsync(argv);
}

// Nur ausführen, wenn die Datei direkt per "node index.js" gestartet wird
if (process.argv[1] === __filename) {
  runCLI(process.argv).then(() => {
    process.exit(0);
  }).catch((err) => {
    process.exit(1);
  });
}

