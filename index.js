import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { Logger } from './src/core/Logger.js';
import { StandardRunner } from './src/runners/StandardRunner.js';
import { TestRunner } from './src/runners/TestRunner.js';
import { MacroScorecardRunner } from './src/runners/MacroScorecardRunner.js';
import { IndicatorAnalysisRunner } from './src/runners/IndicatorAnalysisRunner.js';
import { Storage } from './src/core/Storage.js';
import { RequestManager } from './src/core/RequestManager.js';
import { Fetcher } from './src/services/Fetcher.js';
import { MaturityWallBuilder } from './src/services/MaturityWallBuilder.js';
import { ErrorRegistry } from './src/core/ErrorRegistry.js';
import { NtfyService } from './src/services/NtfyService.js';

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
    .option('-c, --check-indikator', 'Run the macro financial indicator analysis')
    .option('-s, --check-scenario', 'Run targeted macro scenario fetch, evaluation and alerting');

  program.action(async (options) => {
    try {
      if (options.checkIndikator) {
        activeRunner = new IndicatorAnalysisRunner(options);
        await activeRunner.run();
        return;
      }

      if (options.checkScenario) {
        activeRunner = new MacroScorecardRunner(options);
        await activeRunner.run();
        return;
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

