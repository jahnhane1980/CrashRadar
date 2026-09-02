import 'dotenv/config';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { Logger } from './src/core/Logger.js';
import { IndicatorAnalysisRunner } from './src/runners/IndicatorAnalysisRunner.js';
import { MacroScorecardRunner } from './src/runners/MacroScorecardRunner.js';
import { TimeSeriesFetchRunner } from './src/runners/TimeSeriesFetchRunner.js';

const __filename = fileURLToPath(import.meta.url);

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
    .option('-s, --check-scenario', 'Run targeted macro scenario fetch, evaluation and alerting')
    .option('-p, --profile <profile>', 'Filter data fetching tasks by profile / frequency (e.g. daily, intraday_m5, all)', 'daily');

  program.action(async (options) => {
    try {
      if (options.checkIndikator) {
        activeRunner = new IndicatorAnalysisRunner(options);
      } else if (options.checkScenario) {
        activeRunner = new MacroScorecardRunner(options);
      } else {
        activeRunner = new TimeSeriesFetchRunner(options);
      }

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

