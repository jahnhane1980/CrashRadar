import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

import { AnalysisRepository } from './src/core/repositories/AnalysisRepository.js';
import { MLPipelineRunner } from './src/runners/MLPipelineRunner.js';

// ML-Config laden
const configPath = path.join(process.cwd(), 'config', 'ML-Config.json');
if (!fs.existsSync(configPath)) {
    console.error('❌ Fehler: config/ML-Config.json nicht gefunden!');
    process.exit(1);
}
const mlConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

program
  .name('CrashRadar ML Pipeline')
  .description('Zentrale CLI zur Orchestrierung der Machine Learning ETL & Trainings-Fabrik')
  .requiredOption('-t, --ticker <string>', 'Der Ticker für das Modell (z.B. BTC, SOFI, QQQ)')
  .option('-s, --step <string>', 'Welcher Schritt soll ausgeführt werden? [features, train, all]', 'all');

program.action(async (options) => {
  const repo = new AnalysisRepository(process.env.DATABASE_URL);

  try {
    const runner = new MLPipelineRunner(options.ticker, repo, mlConfig);
    await runner.run(options.step);
  } catch (err) {
    // Fehler wird vom Runner geworfen und geloggt
    process.exit(1);
  } finally {
    await repo.close();
    process.exit(0);
  }
});

program.parse(process.argv);
