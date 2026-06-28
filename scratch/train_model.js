import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import * as tf from '@tensorflow/tfjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputCsv = path.join(__dirname, '..', 'data', 'ml', 'btc_labeled.csv');
const modelDir = path.join(__dirname, '..', 'data', 'ml', 'models', 'btc_regime_v1');

// Hyperparameter
const TIME_STEPS = 14; // Das LSTM blickt 14 Tage in die Vergangenheit
const EPOCHS = 20;
const BATCH_SIZE = 32;
const LABELS = ['MACRO_TOP', 'MACRO_BOTTOM', 'UPTREND', 'DOWNTREND'];

let globalStats = {};

function normalize(data) {
  // Sehr simples Normalisieren: Z-Score (Mean=0, Std=1)
  const features = ['return_pct', 'rsi_14', 'macd_hist'];
  
  for (const f of features) {
    const values = data.map(d => parseFloat(d[f]));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
    globalStats[f] = { mean, std };
  }

  return data.map(row => {
    return [
      (parseFloat(row.return_pct) - globalStats['return_pct'].mean) / (globalStats['return_pct'].std || 1),
      (parseFloat(row.rsi_14) - globalStats['rsi_14'].mean) / (globalStats['rsi_14'].std || 1),
      (parseFloat(row.macd_hist) - globalStats['macd_hist'].mean) / (globalStats['macd_hist'].std || 1)
    ];
  });
}

function getOneHot(label) {
  const index = LABELS.indexOf(label);
  const oneHot = [0, 0, 0, 0];
  if (index !== -1) oneHot[index] = 1;
  return oneHot;
}

async function trainModel() {
  console.log('🔄 Lese Trainingsdaten ein...');
  const fileContent = fs.readFileSync(inputCsv, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  console.log('🔄 Normalisiere Features...');
  const normalizedFeatures = normalize(records);
  const labels = records.map(r => getOneHot(r.phase));

  // Sequenzen erstellen (LSTM erwartet [batch_size, time_steps, features])
  const X = [];
  const y = [];

  for (let i = TIME_STEPS; i < normalizedFeatures.length; i++) {
    const sequence = normalizedFeatures.slice(i - TIME_STEPS, i);
    X.push(sequence);
    y.push(labels[i]); // Vorhersage für den aktuellen Tag
  }

  // Splitten: In-Sample (80%) vs Out-of-Sample (20%) - Streng chronologisch!
  const splitIdx = Math.floor(X.length * 0.8);
  
  const xTrain = tf.tensor3d(X.slice(0, splitIdx));
  const yTrain = tf.tensor2d(y.slice(0, splitIdx));
  
  const xVal = tf.tensor3d(X.slice(splitIdx));
  const yVal = tf.tensor2d(y.slice(splitIdx));

  console.log(`✅ Daten vorbereitet. Training: ${splitIdx} Sequenzen, Validierung: ${X.length - splitIdx} Sequenzen.`);

  // LSTM Modell bauen
  const model = tf.sequential();
  model.add(tf.layers.lstm({
    units: 32, 
    inputShape: [TIME_STEPS, 3], // 14 Tage, 3 Features
    returnSequences: false
  }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 4, activation: 'softmax' })); // 4 Klassen

  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  console.log('🧠 Starte Training (das kann einen Moment dauern)...');
  await model.fit(xTrain, yTrain, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    validationData: [xVal, yVal],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}/${EPOCHS} - loss: ${logs.loss.toFixed(4)} - acc: ${logs.acc.toFixed(4)} - val_loss: ${logs.val_loss.toFixed(4)} - val_acc: ${logs.val_acc.toFixed(4)}`);
      }
    }
  });

  console.log(`💾 Speichere Modell-Gewichte unter: ${modelDir}`);
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }
  
  // Custom Node.js Save-Adapter: Wir speichern einfach die Array-Werte der Tensoren als JSON.
  // Das umgeht alle C++ / tfjs-node Abhängigkeiten auf Windows!
  const weights = model.getWeights().map(w => w.arraySync());
  fs.writeFileSync(path.join(modelDir, 'weights.json'), JSON.stringify(weights), 'utf-8');
  
  // Auch die Normalisierungs-Stats speichern wir, da wir sie für Live-Daten brauchen
  fs.writeFileSync(path.join(modelDir, 'stats.json'), JSON.stringify(globalStats), 'utf-8');

  console.log('🎉 Training und Speicherung (Custom IO) erfolgreich abgeschlossen!');
}

trainModel().catch(console.error);
