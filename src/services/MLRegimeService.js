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
      // Lade Gewichte
      const weightsArrays = JSON.parse(await fs.readFile(weightsPath, 'utf8'));
      const featureCount = Object.keys(this.stats).length;

      // Ermittle Anzahl der Klassen dynamisch anhand des letzten Weight-Tensors (Bias des Softmax-Layers)
      const numClasses = weightsArrays[weightsArrays.length - 1].length;
      
      if (numClasses === 7) {
        this.labels = ['CYCLE_BOTTOM', 'BULL_MARKET', 'BULL_CORRECTION', 'CYCLE_TOP', 'BEAR_MARKET', 'BEAR_RALLY', 'BASE'];
      } else {
        this.labels = ['CYCLE_BOTTOM', 'BULL_MARKET', 'BULL_CORRECTION', 'CYCLE_TOP', 'BEAR_MARKET', 'BEAR_RALLY'];
      }

      // LSTM Modell identisch zur V2-Trainingsarchitektur bauen
      this.model = tf.sequential();
      this.model.add(tf.layers.lstm({ units: 64, inputShape: [this.sequenceLength, featureCount], returnSequences: false }));
      this.model.add(tf.layers.dropout({ rate: 0.3 }));
      this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
      this.model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));

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
    let daysBelowSma200 = 0;

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
        
        let distSma200 = 0;
        let sma200Slope = 0;
        if (i >= 199) {
            let sum = 0;
            for(let j=i-199; j<=i; j++) sum += features[j].close;
            const sma200 = sum / 200;
            distSma200 = (f.close / sma200) - 1;

            if (f.close < sma200) {
                daysBelowSma200++;
            } else {
                daysBelowSma200 = 0;
            }

            if (i >= 209) {
                let sum10 = 0;
                for (let j = i - 209; j <= i - 10; j++) sum10 += features[j].close;
                const sma200_10 = sum10 / 200;
                sma200Slope = (sma200 / sma200_10) - 1;
            }
        }

        let volZScore = 0;
        if (i >= 49) {
            let sumVol = 0;
            for(let j=i-49; j<=i; j++) sumVol += features[j].volume;
            const sma50Vol = sumVol / 50;
            let varSum = 0;
            for(let j=i-49; j<=i; j++) varSum += Math.pow(features[j].volume - sma50Vol, 2);
            const stdDev = Math.sqrt(varSum / 50);
            volZScore = stdDev === 0 ? 0 : (f.volume - sma50Vol) / stdDev;
        }

        let dist52wHigh = 0;
        let dist52wLow = 0;
        if (i >= 251) {
            let maxHigh = -Infinity;
            let minLow = Infinity;
            for(let j=i-251; j<=i; j++) {
                if(Number(candles[j].high) > maxHigh) maxHigh = Number(candles[j].high);
                if(Number(candles[j].low) < minLow) minLow = Number(candles[j].low);
            }
            dist52wHigh = (f.close / maxHigh) - 1;
            dist52wLow = (f.close / minLow) - 1;
        }

        let logReturnEma3 = 0;
        if (i >= 1) {
            let logReturn = Math.log(f.close / features[i-1].close);
            if (i === 1) {
                features[i].logReturnEma3 = logReturn;
                logReturnEma3 = logReturn;
            } else {
                logReturnEma3 = (logReturn * 0.5) + (features[i-1].logReturnEma3 * 0.5);
                features[i].logReturnEma3 = logReturnEma3;
            }
        }

        result.push({
            date: f.date,
            Close: f.close,
            Volume: f.volume,
            OBV: f.obv,
            ATR_14: atr !== null ? atr : 0,
            RSI_14: rsi !== null ? rsi : 50,
            MACD_Hist: macd !== null && macd !== undefined ? macd : 0,
            Dist_SMA200: distSma200,
            SMA200_Slope: sma200Slope,
            Days_Below_SMA200: daysBelowSma200,
            Volume_Z_Score: volZScore,
            Dist_52W_High: dist52wHigh,
            Dist_52W_Low: dist52wLow,
            Log_Return_EMA3: logReturnEma3,
            label: f.label
        });
    }
    return result;
  }

  normalize(featuresArray, buildStats = false) {
    if (buildStats && featuresArray.length > 0) {
      this.stats = {};
      const features = Object.keys(featuresArray[0]).filter(k => k !== 'date' && k !== 'label');
      for (const f of features) {
        const values = featuresArray.map(d => parseFloat(d[f]) || 0);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
        this.stats[f] = { mean, std: std === 0 ? 1 : std };
      }
    }

    if (!this.stats) return [];

    const features = Object.keys(this.stats);

    return featuresArray.map(row => {
      return features.map(f => {
         return ((parseFloat(row[f]) || 0) - this.stats[f].mean) / this.stats[f].std;
      });
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
