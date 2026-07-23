import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs';
import { Logger } from '../core/Logger.js';

const LABELS = [
  'CYCLE_BOTTOM', 
  'BULL_MARKET', 
  'BULL_CORRECTION', 
  'CYCLE_TOP', 
  'BEAR_MARKET', 
  'BEAR_RALLY',
  'BASE'
];

export class ModelEvaluator {
    constructor(ticker, version, config) {
        this.ticker = ticker;
        this.version = version;
        this.config = config;
        
        const tc = (this.config.tickers && this.config.tickers[this.ticker]) || {};
        const dc = this.config.default;
        this.timeSteps = tc.timeSteps || dc.timeSteps;
        
        const snapshotDir = this.config.global.snapshotDir || 'data/ml/snapshots';
        this.inputCsv = path.join(process.cwd(), snapshotDir, `${this.ticker.toLowerCase()}_${this.version}.csv`);
        
        const modelDir = this.config.global.modelDir || 'data/ml/models';
        this.modelDir = path.join(process.cwd(), modelDir, `${this.ticker.toLowerCase()}_regime_${this.version}`);
    }

    _getOneHot(label) {
        const index = LABELS.indexOf(label);
        const oneHot = Array(LABELS.length).fill(0);
        if (index !== -1) oneHot[index] = 1;
        return oneHot;
    }

    _normalize(records, featureCols, stats) {
        return records.map(row => {
            return featureCols.map(f => {
                return (parseFloat(row[f]) - stats[f].mean) / stats[f].std;
            });
        });
    }

    async evaluate() {
        Logger.info(`\n=== Evaluating ${this.ticker} (v${this.version}) ===`);
        
        if (!fs.existsSync(this.modelDir)) {
            Logger.info(`[ModelEvaluator] Modell-Ordner nicht gefunden: ${this.modelDir}`);
            return null;
        }

        const statsPath = path.join(this.modelDir, 'stats.json');
        const weightsPath = path.join(this.modelDir, 'weights.json');
        
        if (!fs.existsSync(statsPath) || !fs.existsSync(weightsPath)) {
            Logger.info(`[ModelEvaluator] Modell-Dateien (stats/weights) fehlen in ${this.modelDir}`);
            return null;
        }

        const globalStats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        const weightsJson = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));

        // Daten laden
        const lines = fs.readFileSync(this.inputCsv, 'utf-8').split('\n').filter(l => l.trim() !== '');
        const headers = lines[0].split(',');
        const featureCols = headers.slice(1, headers.length - 1);
        const numFeatures = featureCols.length;

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
        
        // Sequenzen bilden (wie beim Training)
        const normalizedFeatures = this._normalize(validRecords, featureCols, globalStats);
        
        const X = [];
        const yTrue = [];
        
        for (let i = this.timeSteps; i < normalizedFeatures.length; i++) {
            X.push(normalizedFeatures.slice(i - this.timeSteps, i));
            yTrue.push(validRecords[i].Label);
        }

        // Test Split (letzte 20%)
        const splitIdx = Math.floor(X.length * 0.8);
        const xTest = tf.tensor3d(X.slice(splitIdx));
        const testLabels = yTrue.slice(splitIdx);
        
        // Modell Architektur aufbauen (muss exakt der in ModelTrainer entsprechen)
        const model = tf.sequential();
        model.add(tf.layers.lstm({
            units: 64, 
            inputShape: [this.timeSteps, numFeatures],
            returnSequences: false
        }));
        model.add(tf.layers.dropout({ rate: 0.3 }));
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        model.add(tf.layers.dense({ units: LABELS.length, activation: 'softmax' })); 
        
        // Gewichte setzen
        const weightTensors = weightsJson.map(w => tf.tensor(w));
        model.setWeights(weightTensors);

        // Vorhersage
        const predictionsTensor = model.predict(xTest);
        const predictions = await predictionsTensor.array();
        
        // Auswerten
        let correct = 0;
        const confusion = {};
        for(const l of LABELS) { confusion[l] = { predictedCount: 0, actualCount: 0, correctlyPredicted: 0 }; }

        for (let i = 0; i < predictions.length; i++) {
            const predProbs = predictions[i];
            const maxIdx = predProbs.indexOf(Math.max(...predProbs));
            const predLabel = LABELS[maxIdx];
            const actualLabel = testLabels[i];

            if (confusion[actualLabel]) confusion[actualLabel].actualCount++;
            if (confusion[predLabel]) confusion[predLabel].predictedCount++;

            if (predLabel === actualLabel) {
                correct++;
                if (confusion[actualLabel]) confusion[actualLabel].correctlyPredicted++;
            }
        }

        const accuracy = (correct / predictions.length) * 100;
        Logger.info(`Accuracy auf Test-Set (letzte 20%): ${accuracy.toFixed(2)}%`);
        Logger.info(`Test-Set Größe: ${predictions.length} Sequenzen\n`);
        
        Logger.info("Confusion Matrix / Label Performance:");
        for (const l of LABELS) {
            const act = confusion[l].actualCount;
            const pred = confusion[l].predictedCount;
            const corr = confusion[l].correctlyPredicted;
            if (act > 0 || pred > 0) {
                Logger.info(`- ${l.padEnd(16)}: Actual: ${act.toString().padStart(3)}, Predicted: ${pred.toString().padStart(3)}, Correct: ${corr.toString().padStart(3)} (${act > 0 ? ((corr/act)*100).toFixed(1) : 0}%)`);
            }
        }
        
        return { accuracy, confusion };
    }
}
