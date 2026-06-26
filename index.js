import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { StandardRunner } from './src/runners/StandardRunner.js';
import { TestRunner } from './src/runners/TestRunner.js';
import { FinanceExpert } from './src/services/FinanceExpert.js';
import { IndicatorEngine } from './src/analysis/IndicatorEngine.js';
import { NtfyService } from './src/services/NtfyService.js';
import { Storage } from './src/core/Storage.js';
import { RequestManager } from './src/core/RequestManager.js';
import { Fetcher } from './src/services/Fetcher.js';
import { MaturityWallBuilder } from './src/services/MaturityWallBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let activeRunner = null;

process.on('SIGINT', () => {
  console.log('\n[Process] Caught interrupt signal (SIGINT). Exiting gracefully...');
  if (activeRunner) activeRunner.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Process] Caught termination signal (SIGTERM). Exiting gracefully...');
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
        console.log('[Analysis] Lade historische Daten aus lokaler Datenbank...');
        const dbUrl = options.test ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL) : process.env.DATABASE_URL;
        const expert = new FinanceExpert(dbUrl);
        const groupedData = await expert.getDailyGroupedData('2015-01-01');
        
        const engine = new IndicatorEngine();
        
        // 1. Ausgabe im Terminal (mit Farben)
        engine.run(groupedData);

        // 2. Ntfy Alerting (nur Warnungen & Kritisch)
        if (process.env.NTFY_TOPIC) {
          const alertHistoryPath = path.resolve(__dirname, 'config/alert_history.json');
          let alertHistory = {};
          if (fs.existsSync(alertHistoryPath)) {
            try {
              alertHistory = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));
            } catch (e) {
              console.warn("[Alerting] Konnte alert_history.json nicht parsen, starte neu.");
            }
          }

          const alerts = engine.getAlerts(groupedData, alertHistory);
          if (alerts) {
            console.log('\n[Alerting] Sende Ntfy Push-Alarm...');
            const ntfy = new NtfyService(process.env.NTFY_TOPIC);
            await ntfy.send('CrashRadar Alarm!', alerts.message, alerts.priority, 'warning');
            
            // History speichern (Debouncing greift)
            fs.writeFileSync(alertHistoryPath, JSON.stringify(alerts.updatedHistory, null, 2), 'utf8');
          } else {
            console.log('\n[Alerting] Keine Warnungen. Überspringe Ntfy Push (alles im grünen Bereich oder bereits benachrichtigt).');
          }
        } else {
          console.log('\n[Alerting] NTFY_TOPIC nicht gesetzt. Überspringe Ntfy Push.');
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
      const fetcher = new Fetcher(config, storage, requestManager);
      const maturityWallBuilder = new MaturityWallBuilder(dbUrl);

      const runnerArgs = { config, storage, fetcher, maturityWallBuilder };
      activeRunner = isTest ? new TestRunner(runnerArgs) : new StandardRunner(runnerArgs);
      
      await activeRunner.run();
    } catch (error) {
      console.error(error);
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
