import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs';

// Die 6 Dow-Theorie Labels bleiben als feste Architekturkonstante erhalten
const LABELS = [
  'CYCLE_BOTTOM', 
  'BULL_MARKET', 
  'BULL_CORRECTION', 
  'CYCLE_TOP', 
  'BEAR_MARKET', 
  'BEAR_RALLY'
];

export class ModelTrainer {
  constructor(ticker, config) {
    this.ticker = ticker;
    this.config = config;
    
    // Hyperparameter mit Fallbacks
    const tc = (this.config.tickers && this.config.tickers[this.ticker]) || {};
    const dc = this.config.default;
    
    this.version = tc.version || dc.version;
    this.epochs = tc.epochs || dc.epochs;
    this.batchSize = tc.batchSize || dc.batchSize;
    this.timeSteps = tc.timeSteps || dc.timeSteps;
    this.patience = tc.earlyStoppingPatience || dc.earlyStoppingPatience;
    
    const snapshotDir = this.config.global.snapshotDir || 'data/ml/snapshots';
    this.inputCsv = path.join(process.cwd(), snapshotDir, `${this.ticker.toLowerCase()}_${this.version}.csv`);
    
    const modelDir = this.config.global.modelDir || 'data/ml/models';
    this.outDir = path.join(process.cwd(), modelDir, `${this.ticker.toLowerCase()}_regime_${this.version}`);
    
    this.globalStats = {};
  }

  _getOneHot(label) {
    const index = LABELS.indexOf(label);
    const oneHot = Array(LABELS.length).fill(0);
    if (index !== -1) oneHot[index] = 1;
    return oneHot;
  }

  _normalize(records, featureCols) {
    for (const f of featureCols) {
      const values = records.map(d => parseFloat(d[f]));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      this.globalStats[f] = { mean, std: std === 0 ? 1 : std };
    }

    return records.map(row => {
      return featureCols.map(f => {
        return (parseFloat(row[f]) - this.globalStats[f].mean) / this.globalStats[f].std;
      });
    });
  }

  async train() {
    console.log(`[ModelTrainer] Starte Training für ${this.ticker} (v${this.version})`);
    
    if (!fs.existsSync(this.inputCsv)) {
      throw new Error(`Datensatz nicht gefunden: ${this.inputCsv}. Bitte erst Feature-Pipeline laufen lassen.`);
    }

    // 1. Daten laden und parsen
    const lines = fs.readFileSync(this.inputCsv, 'utf-8').split('\n').filter(l => l.trim() !== '');
    const headers = lines[0].split(',');
    
    // Die Features sind alles zwischen "Date" (Index 0) und "Label" (Index length-1)
    const featureCols = headers.slice(1, headers.length - 1);
    const numFeatures = featureCols.length;
    console.log(`[ModelTrainer] Erkannte Features: ${featureCols.join(', ')}`);

    const records = [];
    for(let i=1; i<lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length !== headers.length) continue;
      
      const row = {};
      for(let j=1; j<headers.length-1; j++) {
        row[headers[j]] = parts[j];
      }
      row.Label = parts[headers.length - 1].trim();
      records.push(row);
    }

    const validRecords = records.filter(r => r.Label !== 'UNKNOWN');
    console.log(`[ModelTrainer] Lade ${validRecords.length} gültige Datensätze.`);

    // 2. Normalisieren & Sequenzen bilden
    const normalizedFeatures = this._normalize(validRecords, featureCols);
    const labels = validRecords.map(r => this._getOneHot(r.Label));

    const X = [];
    const y = [];

    for (let i = this.timeSteps; i < normalizedFeatures.length; i++) {
      const sequence = normalizedFeatures.slice(i - this.timeSteps, i);
      X.push(sequence);
      y.push(labels[i]);
    }

    // 80% Train, 20% Val
    const splitIdx = Math.floor(X.length * 0.8);
    const xTrain = tf.tensor3d(X.slice(0, splitIdx));
    const yTrain = tf.tensor2d(y.slice(0, splitIdx));
    const xVal = tf.tensor3d(X.slice(splitIdx));
    const yVal = tf.tensor2d(y.slice(splitIdx));

    console.log(`[ModelTrainer] Train/Val Split: ${splitIdx} / ${X.length - splitIdx} Sequenzen.`);

    // 3. Class Weights dynamisch berechnen
    const classCounts = Array(LABELS.length).fill(0);
    for (const r of validRecords) {
       const idx = LABELS.indexOf(r.Label);
       if (idx !== -1) classCounts[idx]++;
    }
    
    const classWeight = {};
    for(let i=0; i<LABELS.length; i++) {
       if (classCounts[i] > 0) {
          classWeight[i] = validRecords.length / (LABELS.length * classCounts[i]);
       } else {
          classWeight[i] = 1.0;
       }
    }
    console.log(`[ModelTrainer] Dynamische Class Weights generiert.`);

    // 4. Modell-Architektur aufbauen
    const model = tf.sequential();
    model.add(tf.layers.lstm({
      units: 64, 
      inputShape: [this.timeSteps, numFeatures],
      returnSequences: false
    }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: LABELS.length, activation: 'softmax' })); 

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // 5. Training mit Custom Early Stopping Callback
    let bestValLoss = Infinity;
    let patienceCounter = 0;

    await model.fit(xTrain, yTrain, {
      epochs: this.epochs,
      batchSize: this.batchSize,
      validationData: [xVal, yVal],
      classWeight: classWeight,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`[ModelTrainer] Epoch ${epoch + 1}/${this.epochs} - loss: ${logs.loss.toFixed(4)} - val_loss: ${logs.val_loss.toFixed(4)}`);
          
          if (logs.val_loss < bestValLoss) {
             bestValLoss = logs.val_loss;
             patienceCounter = 0;
          } else {
             patienceCounter++;
          }
          
          if (patienceCounter >= this.patience) {
             console.log(`[ModelTrainer] 🛑 Early Stopping bei Epoche ${epoch + 1} (keine Verbesserung seit ${this.patience} Epochen).`);
             model.stopTraining = true;
          }
        }
      }
    });

    // 6. Speichern
    if (!fs.existsSync(this.outDir)) {
      fs.mkdirSync(this.outDir, { recursive: true });
    }
    
    // Custom Node.js Save-Adapter (vermeidet C++ Bindungsfehler auf Windows)
    const weights = model.getWeights().map(w => w.arraySync());
    fs.writeFileSync(path.join(this.outDir, 'weights.json'), JSON.stringify(weights), 'utf-8');
    fs.writeFileSync(path.join(this.outDir, 'stats.json'), JSON.stringify(this.globalStats), 'utf-8');

    console.log(`[ModelTrainer] 🎉 Training abgeschlossen! Modell gespeichert unter: ${this.outDir}`);
  }
}
