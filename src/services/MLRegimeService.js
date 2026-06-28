import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tf from '@tensorflow/tfjs';
import { RSI, MACD } from 'technicalindicators';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MLRegimeService {
  constructor(modelName = 'btc_regime_v1') {
    this.modelName = modelName;
    this.modelDir = path.join(__dirname, '..', '..', 'data', 'ml', 'models', this.modelName);
    this.model = null;
    this.stats = null;
    this.labels = ['MACRO_TOP', 'MACRO_BOTTOM', 'UPTREND', 'DOWNTREND'];
    this.sequenceLength = 14;
    this.epochs = 20;
    this.batchSize = 32;
  }

  async loadModel() {
    if (this.model) return;
    
    try {
      const statsPath = path.join(this.modelDir, 'stats.json');
      const weightsPath = path.join(this.modelDir, 'weights.json');
      
      this.stats = JSON.parse(await fs.readFile(statsPath, 'utf8'));
      const weightsArrays = JSON.parse(await fs.readFile(weightsPath, 'utf8'));

      // LSTM Modell identisch zur Trainingsarchitektur bauen
      this.model = tf.sequential();
      this.model.add(tf.layers.lstm({ units: 32, inputShape: [this.sequenceLength, 3], returnSequences: false }));
      this.model.add(tf.layers.dropout({ rate: 0.2 }));
      this.model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
      this.model.add(tf.layers.dense({ units: 4, activation: 'softmax' }));

      // Gewichte setzen (Custom IO umgeht tfjs-node Windows-Bugs)
      const weights = weightsArrays.map(arr => tf.tensor(arr));
      this.model.setWeights(weights);
      console.log(`[MLRegimeService] LSTM Modell (Custom IO) erfolgreich in den RAM geladen.`);
    } catch (error) {
      console.error(`[MLRegimeService] Fehler beim Laden des Modells:`, error.message);
      throw error;
    }
  }

  buildFeatures(candles) {
    const closes = candles.map(c => Number(c.close));
    const returns = [0]; // Erster Tag 0%
    for(let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i-1]) / closes[i-1]);
    }

    const rsi = RSI.calculate({ values: closes, period: 14 });
    const macd = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });

    const result = [];
    for(let i = 0; i < candles.length; i++) {
        // RSI startet ab Index 14
        const rsiVal = i >= 14 ? rsi[i - 14] : 50; 
        // MACD Histogramm startet ca. ab Index 25
        const macdIdx = i - 25; 
        const macdVal = macdIdx >= 0 && macd[macdIdx] ? macd[macdIdx].histogram || 0 : 0;
        
        result.push({
            date: candles[i].date,
            close: closes[i],
            return_pct: returns[i],
            rsi_14: rsiVal,
            macd_hist: macdVal,
            label: candles[i].label || 'UNKNOWN'
        });
    }
    return result;
  }

  normalize(featuresArray, buildStats = false) {
    const features = ['return_pct', 'rsi_14', 'macd_hist'];
    
    if (buildStats) {
      this.stats = {};
      for (const f of features) {
        const values = featuresArray.map(d => parseFloat(d[f]));
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
        this.stats[f] = { mean, std };
      }
    }

    return featuresArray.map(row => {
      return [
        (parseFloat(row.return_pct) - this.stats['return_pct'].mean) / (this.stats['return_pct'].std || 1),
        (parseFloat(row.rsi_14) - this.stats['rsi_14'].mean) / (this.stats['rsi_14'].std || 1),
        (parseFloat(row.macd_hist) - this.stats['macd_hist'].mean) / (this.stats['macd_hist'].std || 1)
      ];
    });
  }

  async predict(candles) {
    await this.loadModel();

    // Wir brauchen mindestens 50 Kerzen als Input, damit die RSI/MACD Indikatoren sich einschwingen (warmup)
    const features = this.buildFeatures(candles);
    const normalized = this.normalize(features, false);
    
    const sequence = normalized.slice(-this.sequenceLength);
    if (sequence.length < this.sequenceLength) {
      throw new Error(`[MLRegimeService] Zu wenige Datenpunkte nach Normalisierung.`);
    }

    const tensor = tf.tensor3d([sequence]);
    const prediction = this.model.predict(tensor);
    const scores = await prediction.data();
    
    const result = {};
    for (let i = 0; i < this.labels.length; i++) {
        result[this.labels[i]] = scores[i];
    }
    
    const topLabelIndex = scores.indexOf(Math.max(...scores));
    const topLabel = this.labels[topLabelIndex];
    
    return {
      phase: topLabel,
      confidence: scores[topLabelIndex],
      rawScores: result
    };
  }

  getOneHot(label) {
    const index = this.labels.indexOf(label);
    const oneHot = [0, 0, 0, 0];
    if (index !== -1) oneHot[index] = 1;
    return oneHot;
  }

  async retrain(candles) {
    console.log(`[MLRegimeService] Bereite Daten für Retraining vor (${candles.length} Kerzen)...`);
    
    const featuresArray = this.buildFeatures(candles);
    // Wir schneiden die ersten 35 Tage ab, da RSI und MACD hier noch ungenau sind (Warmup-Phase)
    const validFeatures = featuresArray.slice(35); 
    
    console.log(`[MLRegimeService] Normalisiere Features...`);
    const normalized = this.normalize(validFeatures, true);
    const labels = validFeatures.map(r => this.getOneHot(r.label));

    const X = [];
    const y = [];
    for (let i = this.sequenceLength; i < normalized.length; i++) {
      X.push(normalized.slice(i - this.sequenceLength, i));
      y.push(labels[i]);
    }

    // Chronologischer Split 80/20 (Data Leakage verhindern)
    const splitIdx = Math.floor(X.length * 0.8);
    const xTrain = tf.tensor3d(X.slice(0, splitIdx));
    const yTrain = tf.tensor2d(y.slice(0, splitIdx));
    const xVal = tf.tensor3d(X.slice(splitIdx));
    const yVal = tf.tensor2d(y.slice(splitIdx));

    this.model = tf.sequential();
    this.model.add(tf.layers.lstm({ units: 32, inputShape: [this.sequenceLength, 3], returnSequences: false }));
    this.model.add(tf.layers.dropout({ rate: 0.2 }));
    this.model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: 4, activation: 'softmax' }));

    this.model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    console.log('🧠 Starte TF.js Training...');
    await this.model.fit(xTrain, yTrain, {
      epochs: this.epochs,
      batchSize: this.batchSize,
      validationData: [xVal, yVal],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}/${this.epochs} - loss: ${logs.loss.toFixed(4)} - val_loss: ${logs.val_loss.toFixed(4)}`);
        }
      }
    });

    console.log(`💾 Speichere Modell-Gewichte in ${this.modelDir}...`);
    if (!fsSync.existsSync(this.modelDir)) {
      await fs.mkdir(this.modelDir, { recursive: true });
    }
    
    const weights = this.model.getWeights().map(w => w.arraySync());
    await fs.writeFile(path.join(this.modelDir, 'weights.json'), JSON.stringify(weights), 'utf-8');
    await fs.writeFile(path.join(this.modelDir, 'stats.json'), JSON.stringify(this.stats), 'utf-8');
    
    console.log(`🎉 Retraining für ${this.modelName} erfolgreich abgeschlossen!`);
  }
}
