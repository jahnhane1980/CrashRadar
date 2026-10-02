import 'dotenv/config';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { Logger } from './src/core/Logger.js';
import { TimeSeriesFetchRunner } from './src/runners/TimeSeriesFetchRunner.js';
import { bootstrapAdapters } from './src/core/adapters/bootstrap.js';

bootstrapAdapters();

const __filename = fileURLToPath(import.meta.url);

let activeRunner = null;
let activeStorage = null;

export const sigintHandler = async () => {
  Logger.info('[Process] Caught interrupt signal (SIGINT). Exiting gracefully...');
  try {
    const storage = activeStorage || activeRunner?.storage;
    if (storage && typeof storage.releaseLock === 'function') {
      try {
        await storage.releaseLock('m5_sync_lock');
      } catch (err) {
        Logger.error('[Process] Error during SIGINT lock release:', err.message || err);
      }
    }
    if (activeRunner && typeof activeRunner.cleanup === 'function') {
      await activeRunner.cleanup();
    }
  } catch (err) {
    Logger.error('[Process] Error during SIGINT cleanup:', err.message || err);
  }
  process.exit(0);
};

export const sigtermHandler = async () => {
  Logger.info('[Process] Caught termination signal (SIGTERM). Exiting gracefully...');
  try {
    const storage = activeStorage || activeRunner?.storage;
    if (storage && typeof storage.releaseLock === 'function') {
      try {
        await storage.releaseLock('m5_sync_lock');
      } catch (err) {
        Logger.error('[Process] Error during SIGTERM lock release:', err.message || err);
      }
    }
    if (activeRunner && typeof activeRunner.cleanup === 'function') {
      await activeRunner.cleanup();
    }
  } catch (err) {
    Logger.error('[Process] Error during SIGTERM cleanup:', err.message || err);
  }
  process.exit(0);
};

process.on('SIGINT', sigintHandler);
process.on('SIGTERM', sigtermHandler);

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
      activeStorage = activeRunner.storage;
      await activeRunner.run();
    } catch (error) {
      Logger.error('[CLI Error]', error.message || error);
      throw error;
    }
  });

  await program.parseAsync(argv);
}

export function getActiveRunner() {
  return activeRunner;
}

export function setActiveRunner(runner) {
  activeRunner = runner;
}

export function getActiveStorage() {
  return activeStorage;
}

export function setActiveStorage(storage) {
  activeStorage = storage;
}

// Nur ausführen, wenn die Datei direkt per "node index.js" gestartet wird
if (process.argv[1] === __filename) {
  runCLI(process.argv).then(() => {
    process.exitCode = 0;
  }).catch(() => {
    process.exitCode = 1;
  });
}
