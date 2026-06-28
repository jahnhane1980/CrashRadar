import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import * as tf from '@tensorflow/tfjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputCsv = path.join(__dirname, '..', 'data', 'ml', 'btc_labeled.csv');
const modelDir = path.join(__dirname, '..', 'data', 'ml', 'models', 'btc_regime_v1');

const TIME_STEPS = 14;
const LABELS = ['MACRO_TOP', 'MACRO_BOTTOM', 'UPTREND', 'DOWNTREND'];

function buildModel() {
  const model = tf.sequential();
  model.add(tf.layers.lstm({
    units: 32, 
    inputShape: [TIME_STEPS, 3],
    returnSequences: false
  }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 4, activation: 'softmax' }));
  return model;
}

function normalizeSingleSequence(sequence, stats) {
  return sequence.map(row => [
    (parseFloat(row.return_pct) - stats['return_pct'].mean) / (stats['return_pct'].std || 1),
    (parseFloat(row.rsi_14) - stats['rsi_14'].mean) / (stats['rsi_14'].std || 1),
    (parseFloat(row.macd_hist) - stats['macd_hist'].mean) / (stats['macd_hist'].std || 1)
  ]);
}

async function simulateLive() {
  console.log('🚀 Lade Daten und Modell für Live-Simulation ab 15.09.2025...\n');
  
  const fileContent = fs.readFileSync(inputCsv, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });
  const stats = JSON.parse(fs.readFileSync(path.join(modelDir, 'stats.json'), 'utf-8'));

  const model = buildModel();
  const weightsJson = JSON.parse(fs.readFileSync(path.join(modelDir, 'weights.json'), 'utf-8'));
  const weights = weightsJson.map(w => tf.tensor(w));
  model.setWeights(weights);

  const startIndex = records.findIndex(r => r.date === '2025-09-15');
  
  if (startIndex === -1) {
    console.error('Startdatum nicht gefunden!');
    return;
  }

  console.log(`📅 Starte tägliche Simulation. Suche nach erstem massiven DOWNTREND-Signal (>50%)...`);
  console.log('---------------------------------------------------------------------------------');

  for (let i = startIndex; i < records.length; i++) {
    const today = records[i].date;
    const price = parseFloat(records[i].close).toFixed(2);
    
    // Nimm die 14 Tage BIS HEUTE
    const rawSequence = records.slice(i - TIME_STEPS + 1, i + 1);
    const normalizedSeq = normalizeSingleSequence(rawSequence, stats);

    const inputTensor = tf.tensor3d([normalizedSeq]);
    const prediction = model.predict(inputTensor);
    const probabilities = Array.from(prediction.dataSync());
    
    inputTensor.dispose();
    prediction.dispose();

    const topProb = probabilities[0] * 100;
    const downProb = probabilities[3] * 100;

    console.log(`[${today}] BTC: $${price.padStart(9)} | TOP Gefahr: ${topProb.toFixed(1).padStart(5)}% | DOWNTREND: ${downProb.toFixed(1).padStart(5)}%`);

    // Wir stoppen bei Ende November 2025, um nicht zu viele Logs zu spammen
    if (today === '2025-11-30') {
      console.log('---------------------------------------------------------------------------------');
      console.log('🛑 Simulation für diesen Zeitraum beendet (Ende November 2025 erreicht).');
      break;
    }
  }
}

simulateLive().catch(console.error);
