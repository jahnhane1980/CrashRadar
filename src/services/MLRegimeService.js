import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tf from '@tensorflow/tfjs';
import { RSI, MACD } from 'technicalindicators';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MLRegimeService {
  constructor(modelName = 'btc_regime_v2') {
    this.modelName = modelName;
    this.modelDir = path.join(__dirname, '..', '..', 'data', 'ml', 'models', this.modelName);
    this.model = null;
    this.stats = null;
    this.labels = ['CYCLE_BOTTOM', 'BULL_MARKET', 'BULL_CORRECTION', 'CYCLE_TOP', 'BEAR_MARKET', 'BEAR_RALLY'];
    this.sequenceLength = 14;
    this.epochs = 30;
    this.batchSize = 32;
  }

  async loadModel() {
    if (this.model) return;
    
    try {
      const statsPath = path.join(this.modelDir, 'stats.json');
      const weightsPath = path.join(this.modelDir, 'weights.json');
      
      this.stats = JSON.parse(await fs.readFile(statsPath, 'utf8'));
      const weightsArrays = JSON.parse(await fs.readFile(weightsPath, 'utf8'));

      // LSTM Modell identisch zur V2-Trainingsarchitektur bauen
      this.model = tf.sequential();
      this.model.add(tf.layers.lstm({ units: 64, inputShape: [this.sequenceLength, 6], returnSequences: false }));
      this.model.add(tf.layers.dropout({ rate: 0.3 }));
      this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
      this.model.add(tf.layers.dense({ units: 6, activation: 'softmax' }));

      // Gewichte setzen
      const weights = weightsArrays.map(arr => tf.tensor(arr));
      this.model.setWeights(weights);
      console.log(`[MLRegimeService] LSTM Modell (V2) erfolgreich in den RAM geladen.`);
    } catch (error) {
      console.error(`[MLRegimeService] Fehler beim Laden des Modells:`, error.message);
      throw error;
    }
  }

  buildFeatures(candles) {
    const closes = candles.map(c => Number(c.close));
    let obv = 0;
    let prevClose = null;
    const features = [];
    
    // 1. Basis-Features berechnen (OBV, True Range)
    for(const row of candles) {
       const date = row.date;
       const close = Number(row.close);
       const volume = Number(row.volume);
       const high = Number(row.high);
       const low = Number(row.low);
       
       if (prevClose !== null) {
         if (close > prevClose) obv += volume;
         else if (close < prevClose) obv -= volume;
       }
       
       let tr = high - low;
       if (prevClose !== null) {
         tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
       }
       
       features.push({ date, close, volume, obv, tr, label: row.label || 'UNKNOWN' });
       prevClose = close;
    }

    // 2. Indikatoren berechnen
    const rsiOutput = RSI.calculate({ values: closes, period: 14 });
    const macdOutput = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
    
    const rsiPadded = Array(closes.length - rsiOutput.length).fill(null).concat(rsiOutput);
    const macdPadded = Array(closes.length - macdOutput.length).fill(null).concat(macdOutput);

    // 3. Finales Array bauen
    const result = [];
    for(let i = 0; i < features.length; i++) {
        const f = features[i];
        
        let atr = null;
        if (i >= 13) {
           let sum = 0;
           for(let j=i-13; j<=i; j++) sum += features[j].tr;
           atr = sum / 14;
        }

        const rsi = rsiPadded[i];
        const macd = macdPadded[i] ? macdPadded[i].histogram : null;
        
        result.push({
            date: f.date,
            Close: f.close,
            Volume: f.volume,
            OBV: f.obv,
            ATR_14: atr !== null ? atr : 0,
            RSI_14: rsi !== null ? rsi : 50,
            MACD_Hist: macd !== null && macd !== undefined ? macd : 0,
            label: f.label
        });
    }
    return result;
  }

  normalize(featuresArray, buildStats = false) {
    const features = ['Close', 'Volume', 'OBV', 'ATR_14', 'RSI_14', 'MACD_Hist'];
    
    if (buildStats) {
      this.stats = {};
      for (const f of features) {
        const values = featuresArray.map(d => parseFloat(d[f]));
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
        this.stats[f] = { mean, std: std === 0 ? 1 : std };
      }
    }

    return featuresArray.map(row => {
      return [
        (parseFloat(row.Close) - this.stats['Close'].mean) / this.stats['Close'].std,
        (parseFloat(row.Volume) - this.stats['Volume'].mean) / this.stats['Volume'].std,
        (parseFloat(row.OBV) - this.stats['OBV'].mean) / this.stats['OBV'].std,
        (parseFloat(row.ATR_14) - this.stats['ATR_14'].mean) / this.stats['ATR_14'].std,
        (parseFloat(row.RSI_14) - this.stats['RSI_14'].mean) / this.stats['RSI_14'].std,
        (parseFloat(row.MACD_Hist) - this.stats['MACD_Hist'].mean) / this.stats['MACD_Hist'].std
      ];
    });
  }

  async predict(candles) {
    await this.loadModel();

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
    const oneHot = Array(this.labels.length).fill(0);
    if (index !== -1) oneHot[index] = 1;
    return oneHot;
  }

  async retrain(candles) {
    console.log(`[MLRegimeService] Retraining über Service (V2) ist deaktiviert. Bitte scratch/train_btc_model_v2.js nutzen!`);
    // Die Retrain-Funktion im Service wird bei V2 aktuell nicht genutzt, da wir das externe Skript mit Class Weights haben.
    // Wir könnten es implementieren, aber um Fehler zu vermeiden, belassen wir das Training beim dedizierten Skript.
  }
}
