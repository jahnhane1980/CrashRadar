import 'dotenv/config';
import { program } from 'commander';
import { StandardRunner } from './src/runners/StandardRunner.js';
import { TestRunner } from './src/runners/TestRunner.js';
import { FinanceExpert } from './src/services/FinanceExpert.js';
import { IndicatorEngine } from './src/analysis/IndicatorEngine.js';
import { NtfyService } from './src/services/NtfyService.js';

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

program
  .name('fetcher')
  .description('Database Fetcher Application');

program
  .option('-t, --test', 'Run the fetcher in test mode')
  .option('-c, --check-indikator', 'Run the macro financial indicator analysis')
  .action(async (options) => {
    try {
      if (options.checkIndikator) {
        console.log('[Analysis] Lade historische Daten aus lokaler Datenbank...');
        const dbUrl = options.test ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL) : process.env.DATABASE_URL;
        const expert = new FinanceExpert(dbUrl);
        const groupedData = await expert.getDailyGroupedData('2015-01-01');
        
        const engine = new IndicatorEngine();
        
        // 1. Ausgabe im Terminal (mit Farben)
        engine.run(groupedData);

        // 2. Ntfy Alerting (ohne Farben)
        if (process.env.NTFY_TOPIC) {
          console.log('\n[Alerting] Sende Ntfy Alert...');
          const ntfy = new NtfyService(process.env.NTFY_TOPIC);
          const cleanReport = engine.generateReport(groupedData, true);
          await ntfy.send('Makro-Finanz Analyse', cleanReport);
        } else {
          console.log('\n[Alerting] NTFY_TOPIC nicht gesetzt. Überspringe Ntfy Push.');
        }

        await expert.close();
        process.exit(0);
      }

      if (options.test) {
        activeRunner = new TestRunner();
      } else {
        activeRunner = new StandardRunner();
      }
      await activeRunner.run();
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });

program.parse(process.argv);
