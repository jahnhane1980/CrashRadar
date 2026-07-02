import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tf from '@tensorflow/tfjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputCsv = path.join(__dirname, 'btc_ml_dataset_final.csv');
const modelDir = path.join(__dirname, '..', 'data', 'ml', 'models', 'btc_regime_v2');

// Hyperparameter
const TIME_STEPS = 14; 
const EPOCHS = 30;
const BATCH_SIZE = 32;

// Die exakten 6 Dow-Theorie Labels aus RegimeLabeler.js
const LABELS = [
  'CYCLE_BOTTOM', 
  'BULL_MARKET', 
  'BULL_CORRECTION', 
  'CYCLE_TOP', 
  'BEAR_MARKET', 
  'BEAR_RALLY'
];

let globalStats = {};

function normalize(data) {
  // Wir normalisieren: Close, Volume, OBV, ATR_14, RSI_14, MACD_Hist (Z-Score)
  const features = ['Close', 'Volume', 'OBV', 'ATR_14', 'RSI_14', 'MACD_Hist'];
  
  for (const f of features) {
    const values = data.map(d => parseFloat(d[f]));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
    globalStats[f] = { mean, std: std === 0 ? 1 : std };
  }

  return data.map(row => {
    return [
      (parseFloat(row['Close']) - globalStats['Close'].mean) / globalStats['Close'].std,
      (parseFloat(row['Volume']) - globalStats['Volume'].mean) / globalStats['Volume'].std,
      (parseFloat(row['OBV']) - globalStats['OBV'].mean) / globalStats['OBV'].std,
      (parseFloat(row['ATR_14']) - globalStats['ATR_14'].mean) / globalStats['ATR_14'].std,
      (parseFloat(row['RSI_14']) - globalStats['RSI_14'].mean) / globalStats['RSI_14'].std,
      (parseFloat(row['MACD_Hist']) - globalStats['MACD_Hist'].mean) / globalStats['MACD_Hist'].std
    ];
  });
}

function getOneHot(label) {
  const index = LABELS.indexOf(label);
  const oneHot = Array(LABELS.length).fill(0);
  if (index !== -1) oneHot[index] = 1;
  return oneHot;
}

async function trainModel() {
  console.log('🔄 Lese Trainingsdaten ein...');
  const fileContent = fs.readFileSync(inputCsv, 'utf-8').split('\n').filter(l => l.trim() !== '');
  const headers = fileContent[0].split(',');
  
  const records = [];
  for(let i=1; i<fileContent.length; i++) {
      const parts = fileContent[i].split(',');
      if (parts.length < 8) continue;
      // Date,Close,Volume,OBV,ATR_14,RSI_14,MACD_Hist,Label
      records.push({
          Close: parts[1],
          Volume: parts[2],
          OBV: parts[3],
          ATR_14: parts[4],
          RSI_14: parts[5],
          MACD_Hist: parts[6],
          Label: parts[7]
      });
  }

  // Filtere UNKNOWN Labels heraus
  const validRecords = records.filter(r => r.Label !== 'UNKNOWN');

  console.log('🔄 Normalisiere Features...');
  const normalizedFeatures = normalize(validRecords);
  const labels = validRecords.map(r => getOneHot(r.Label));

  const X = [];
  const y = [];

  for (let i = TIME_STEPS; i < normalizedFeatures.length; i++) {
    const sequence = normalizedFeatures.slice(i - TIME_STEPS, i);
    X.push(sequence);
    y.push(labels[i]);
  }

  // 80% Train, 20% Val
  const splitIdx = Math.floor(X.length * 0.8);
  
  const xTrain = tf.tensor3d(X.slice(0, splitIdx));
  const yTrain = tf.tensor2d(y.slice(0, splitIdx));
  
  const xVal = tf.tensor3d(X.slice(splitIdx));
  const yVal = tf.tensor2d(y.slice(splitIdx));

  console.log(`✅ Daten vorbereitet. Training: ${splitIdx} Sequenzen, Validierung: ${X.length - splitIdx} Sequenzen.`);

  const model = tf.sequential();
  model.add(tf.layers.lstm({
    units: 64, 
    inputShape: [TIME_STEPS, 6], // 14 Tage, 6 Features (Close, Vol, OBV, ATR, RSI, MACD)
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

  // Class Weights berechnen (um Imbalance zu beheben)
  const classCounts = Array(LABELS.length).fill(0);
  for (const r of validRecords) {
     const idx = LABELS.indexOf(r.Label);
     if (idx !== -1) classCounts[idx]++;
  }
  const totalRecords = validRecords.length;
  const classWeight = {};
  for(let i=0; i<LABELS.length; i++) {
     if (classCounts[i] > 0) {
        // Standard scikit-learn Formel: n_samples / (n_classes * np.bincount(y))
        classWeight[i] = totalRecords / (LABELS.length * classCounts[i]);
     } else {
        classWeight[i] = 1.0;
     }
  }
  console.log('⚖️ Berechnete Class Weights:', classWeight);

  console.log('🧠 Starte Training für btc_regime_v2 (mit Early Stopping & Class Weights)...');
  
  let bestValLoss = Infinity;
  let patienceCounter = 0;
  const PATIENCE = 5;

  await model.fit(xTrain, yTrain, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    validationData: [xVal, yVal],
    classWeight: classWeight, // <--- HIER übergeben wir die Gewichte!
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}/${EPOCHS} - loss: ${logs.loss.toFixed(4)} - acc: ${logs.acc.toFixed(4)} - val_loss: ${logs.val_loss.toFixed(4)} - val_acc: ${logs.val_acc.toFixed(4)}`);
        
        // Manual Early Stopping
        if (logs.val_loss < bestValLoss) {
           bestValLoss = logs.val_loss;
           patienceCounter = 0;
        } else {
           patienceCounter++;
        }
        
        if (patienceCounter >= PATIENCE) {
           console.log(`\n🛑 Early Stopping ausgelöst bei Epoche ${epoch + 1} (val_loss hat sich ${PATIENCE} Epochen nicht verbessert).`);
           model.stopTraining = true;
        }
      }
    }
  });

  console.log(`\n💾 Speichere Modell-Gewichte (Custom IO) unter: ${modelDir}`);
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }
  
  // Custom Node.js Save-Adapter: (Umgeht tfjs-node Windows-Bugs)
  const weights = model.getWeights().map(w => w.arraySync());
  fs.writeFileSync(path.join(modelDir, 'weights.json'), JSON.stringify(weights), 'utf-8');
  
  // Speichere die Normalisierungs-Stats!
  fs.writeFileSync(path.join(modelDir, 'stats.json'), JSON.stringify(globalStats), 'utf-8');

  console.log('🎉 V2 Training erfolgreich abgeschlossen!');
}

trainModel().catch(console.error);
