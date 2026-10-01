import 'dotenv/config';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { Logger } from './src/core/Logger.js';
import { TimeSeriesFetchRunner } from './src/runners/TimeSeriesFetchRunner.js';

const __filename = fileURLToPath(import.meta.url);

let activeRunner = null;

process.on('SIGINT', () => {
  Logger.info('[Process] Caught interrupt signal (SIGINT). Exiting gracefully...');
  if (activeRunner && typeof activeRunner.cleanup === 'function') {
    activeRunner.cleanup();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('[Process] Caught termination signal (SIGTERM). Exiting gracefully...');
  if (activeRunner && typeof activeRunner.cleanup === 'function') {
    activeRunner.cleanup();
  }
  process.exit(0);
});

export async function runCLI(argv) {
  const program = new Command();
  
  program
    .name('fetcher')
    .description('Database Fetcher Application');

  program
    .option('-t, --test', 'Run the fetcher in test mode')
    .option('-p, --profile <profile>', 'Filter data fetching tasks by profile / frequency (e.g. daily, intraday_m5, all)', 'daily')
    .option('-g, --group <name>', 'Filter data fetching tasks by group (e.g. intraday_m5)')
    .option('-c, --check-indikator', 'Legacy indicator flag (deprecated / no-op in ingestion-only mode)')
    .option('-s, --check-scenario', 'Legacy scenario flag (deprecated / no-op in ingestion-only mode)');

  program.action(async (options) => {
    try {
      if (options.checkIndikator || options.checkScenario) {
        Logger.warn('[CLI] Indicator and scenario checks have been retired in ingestion mode.');
        return;
      }

      activeRunner = new TimeSeriesFetchRunner(options);
      await activeRunner.run();
    } catch (error) {
      Logger.error('[CLI Error]', error.message || error);
      throw error;
    }
  });

  await program.parseAsync(argv);
}

// Nur ausführen, wenn die Datei direkt per "node index.js" gestartet wird
if (process.argv[1] === __filename) {
  runCLI(process.argv).then(() => {
    process.exitCode = 0;
  }).catch(() => {
    process.exitCode = 1;
  });
}
