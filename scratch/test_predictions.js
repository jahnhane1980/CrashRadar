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

async function testPrediction(targetDateLabel, targetDateStr) {
  console.log(`\n🔎 Teste Inferenz für: ${targetDateLabel} (${targetDateStr})`);
  
  // Lade Daten und Stats
  const fileContent = fs.readFileSync(inputCsv, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });
  const stats = JSON.parse(fs.readFileSync(path.join(modelDir, 'stats.json'), 'utf-8'));

  // Finde den Ziel-Tag in den Daten
  const targetIndex = records.findIndex(r => r.date === targetDateStr);
  if (targetIndex < TIME_STEPS) {
    console.error('Datum nicht gefunden oder nicht genug Historie vorhanden.');
    return;
  }

  // Extrahiere exakt die 14 Tage BIS zum Zieldatum
  const rawSequence = records.slice(targetIndex - TIME_STEPS + 1, targetIndex + 1);
  const normalizedSeq = normalizeSingleSequence(rawSequence, stats);

  // Lade Modell und Gewichte
  const model = buildModel();
  const weightsJson = JSON.parse(fs.readFileSync(path.join(modelDir, 'weights.json'), 'utf-8'));
  const weights = weightsJson.map(w => tf.tensor(w));
  model.setWeights(weights);

  // Vorhersage
  const inputTensor = tf.tensor3d([normalizedSeq]);
  const prediction = model.predict(inputTensor);
  const probabilities = Array.from(prediction.dataSync());

  // Ausgabe formatieren
  console.log(`Echte (Historische) Phase an diesem Tag: ${records[targetIndex].phase}`);
  console.log(`🤖 Vorhersage des LSTMs basierend auf den ${TIME_STEPS} Tagen davor:`);
  LABELS.forEach((label, idx) => {
    const prob = (probabilities[idx] * 100).toFixed(2);
    console.log(`  - ${label.padEnd(14)}: ${prob.padStart(6)}%`);
  });
}

async function runTests() {
  console.log('🚀 Starte Modell-Probelauf (Inferenz-Test)...\n');
  
  // Test 1: Mitten im FTX Crash (Kapitulation)
  await testPrediction('FTX Crash Boden', '2022-11-20');
  
  // Test 2: Das 69k Double Top
  await testPrediction('All-Time-High (Nov 2021)', '2021-11-10');

  // Test 3: Ein "normaler" Bullen-Tag 2024
  await testPrediction('Mitten im ETF Bullenmarkt', '2024-02-15');

  // Test 4: Der absolute Peak des Bullruns 2025!
  await testPrediction('Das 2025 Makro Top', '2025-10-06');
}

runTests().catch(console.error);
