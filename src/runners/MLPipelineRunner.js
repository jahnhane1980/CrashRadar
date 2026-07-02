import fs from 'fs';
import path from 'path';

import { DefaultFeatureBuilder } from '../ml/features/DefaultFeatureBuilder.js';
import { ModelTrainer } from '../ml/ModelTrainer.js';

export class MLPipelineRunner {
  constructor(ticker, repo, config) {
    this.ticker = ticker.toUpperCase();
    this.repo = repo;
    this.config = config;
  }

  async run(step = 'all') {
    step = step.toLowerCase();
    console.log(`\n🚀 Starte CrashRadar ML Pipeline für: ${this.ticker}`);
    console.log(`📋 Ausgewählte Phase: ${step}\n`);

    try {
      // --- PHASE 1: FEATURE ENGINEERING (ETL) ---
      if (step === 'features' || step === 'all') {
        console.log(`=== PHASE 1: Feature Engineering (ETL) ===`);
        
        let FeatureBuilderClass = DefaultFeatureBuilder;
        const customPath = path.join(process.cwd(), 'src', 'ml', 'features', `${this.ticker}FeatureBuilder.js`);
        
        if (fs.existsSync(customPath)) {
           console.log(`[MLPipelineRunner] 🔧 Spezialisierter FeatureBuilder für ${this.ticker} gefunden. Nutze diesen anstelle von Default.`);
           const module = await import(`file://${customPath}`);
           FeatureBuilderClass = module[`${this.ticker}FeatureBuilder`] || module.default || DefaultFeatureBuilder;
        } else {
           console.log(`[MLPipelineRunner] 🔧 Nutze universellen DefaultFeatureBuilder.`);
        }
        
        const builder = new FeatureBuilderClass(this.ticker, this.repo, this.config);
        await builder.build();
        console.log(`=== PHASE 1: ERFOLGREICH ABGESCHLOSSEN ===\n`);
      }

      // --- PHASE 2: MODEL TRAINING (LSTM) ---
      if (step === 'train' || step === 'all') {
        console.log(`=== PHASE 2: Model Training (LSTM) ===`);
        const trainer = new ModelTrainer(this.ticker, this.config);
        await trainer.train();
        console.log(`=== PHASE 2: ERFOLGREICH ABGESCHLOSSEN ===\n`);
      }

    } catch (err) {
      console.error(`\n❌ KRITISCHER FEHLER in der ML Pipeline: ${err.message}`);
      console.error(err.stack);
      throw err; // Werfen für Testbarkeit und Caller
    }
  }
}
