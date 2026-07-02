import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tf from '@tensorflow/tfjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelDir = path.join(__dirname, '..', 'data', 'ml', 'models', 'btc_regime_v2');
const csvPath = path.join(__dirname, 'btc_ml_dataset_final.csv');

const TIME_STEPS = 14;
const LABELS = ['CYCLE_BOTTOM', 'BULL_MARKET', 'BULL_CORRECTION', 'CYCLE_TOP', 'BEAR_MARKET', 'BEAR_RALLY'];

async function run() {
    // 1. Daten einlesen
    const csvLines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    const data = [];
    for(let i=1; i<csvLines.length; i++) {
        const p = csvLines[i].split(',');
        data.push({
            date: p[0],
            Close: parseFloat(p[1]),
            Volume: parseFloat(p[2]),
            OBV: parseFloat(p[3]),
            ATR_14: parseFloat(p[4]),
            RSI_14: parseFloat(p[5]),
            MACD_Hist: parseFloat(p[6]),
            Label: p[7]
        });
    }

    // 2. Stats laden
    const stats = JSON.parse(fs.readFileSync(path.join(modelDir, 'stats.json'), 'utf-8'));

    function normalizeRow(row) {
        return [
            (row.Close - stats.Close.mean) / stats.Close.std,
            (row.Volume - stats.Volume.mean) / stats.Volume.std,
            (row.OBV - stats.OBV.mean) / stats.OBV.std,
            (row.ATR_14 - stats.ATR_14.mean) / stats.ATR_14.std,
            (row.RSI_14 - stats.RSI_14.mean) / stats.RSI_14.std,
            (row.MACD_Hist - stats.MACD_Hist.mean) / stats.MACD_Hist.std,
        ];
    }

    // 3. Modell Architektur bauen und Gewichte laden
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 64, inputShape: [TIME_STEPS, 6], returnSequences: false }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: LABELS.length, activation: 'softmax' }));

    const weightsArrays = JSON.parse(fs.readFileSync(path.join(modelDir, 'weights.json'), 'utf-8'));
    const weightsTensors = weightsArrays.map(arr => tf.tensor(arr));
    model.setWeights(weightsTensors);

    // 4. Test-Szenarien
    const testDates = [
        // SCHWIERIGE PHASEN (Chop / Sideways)
        '2024-05-01', // Zähe Seitwärts/Abwärtsphase nach dem 73k-Top (Post-Halving Chop)
        '2024-08-05', // "Yen Carry Trade Crash" - extremer Panik-Wick auf 49k
        
        // TREND-WECHSEL (gerade gekippt)
        '2021-05-19', // Der berüchtigte China-Mining-Ban Crash (Bullenmarkt crasht plötzlich um 50%)
        
        // AKTUELLE DATEN (2025 / 2026)
        '2025-06-15', // Mitte 2025 Stichprobe
        '2026-01-10', // Anfang 2026
        '2026-04-15', // Letzte große Bewegung vor dem aktuellen Sommer
        '2026-07-01'  // GESTERN: Mitten im aktuellen 2026 Bärenmarkt
    ];

    console.log("=== V2 MODELL INFERENZ TEST ===\n");

    for (const targetDate of testDates) {
        const targetIndex = data.findIndex(d => d.date === targetDate);
        if (targetIndex < TIME_STEPS) {
            console.log(`Datum ${targetDate} nicht gefunden oder zu wenig Historie!`);
            continue;
        }

        // Window extrahieren (14 Tage)
        const window = data.slice(targetIndex - TIME_STEPS + 1, targetIndex + 1);
        const groundTruth = window[TIME_STEPS - 1].Label;
        const currentClose = window[TIME_STEPS - 1].Close;

        // Normalisieren und als Tensor formen
        const normalizedWindow = window.map(normalizeRow);
        const inputTensor = tf.tensor3d([normalizedWindow]);

        // Vorhersage
        const prediction = model.predict(inputTensor);
        const probs = prediction.arraySync()[0];
        
        // Bestes Label finden
        const maxProbIndex = probs.indexOf(Math.max(...probs));
        const predictedLabel = LABELS[maxProbIndex];
        const confidence = (probs[maxProbIndex] * 100).toFixed(1);

        console.log(`Datum: ${targetDate} | Close: $${currentClose}`);
        console.log(`Ground Truth (Lehrer) : ${groundTruth}`);
        console.log(`Prediction (Schüler)  : ${predictedLabel} (${confidence}% Konfidenz)`);
        
        // Zweithöchste Wahrscheinlichkeit zeigen
        let sortedProbs = probs.map((p, i) => ({label: LABELS[i], prob: p})).sort((a,b) => b.prob - a.prob);
        console.log(`Alt. Prediction       : ${sortedProbs[1].label} (${(sortedProbs[1].prob * 100).toFixed(1)}%)`);
        
        const match = groundTruth === predictedLabel ? '✅ MATCH' : '❌ FAIL';
        console.log(`Ergebnis              : ${match}\n----------------------------------`);
    }
}

run().catch(console.error);
