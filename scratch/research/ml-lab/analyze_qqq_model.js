import 'dotenv/config';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { MLRegimeService } from '../../../src/services/MLRegimeService.js';
import * as tf from '@tensorflow/tfjs';

async function analyzeQQQ() {
  console.log("=== QQQ ML Model Deep Dive Analysis ===");
  
  const expert = new FinanceExpert(process.env.DATABASE_URL);
  const groupedData = await expert.getDailyGroupedData('2015-01-01');

  const getCandles = (data, assetName, volName) => data.map(d => ({
    date: d.date,
    close: d.assets[assetName],
    volume: d.assets[volName] || 0,
    high: d.assets[`${assetName}_High`] || d.assets[assetName],
    low: d.assets[`${assetName}_Low`] || d.assets[assetName]
  })).filter(c => c.close !== null && c.close !== undefined);

  const qqqCandles = getCandles(groupedData, 'QQQ', 'QQQ_Volume');
  console.log(`Total QQQ Candles available: ${qqqCandles.length}`);

  const service = new MLRegimeService('qqq_regime_v1');
  await service.loadModel();
  
  const features = service.buildFeatures(qqqCandles);
  const normalized = service.normalize(features, false);

  // 1. Prediction for Today
  const latestIndex = features.length - 1;
  const latestFeature = features[latestIndex];
  const latestNormalized = normalized[latestIndex];
  
  console.log(`\n📅 Latest Date: ${latestFeature.date}`);
  console.log(`Close Price: $${latestFeature.Close}`);

  // Print raw features vs normalized z-scores
  console.log("\n📊 Feature Breakdown for Today (Raw vs Mean/Std -> Z-Score):");
  const featureNames = Object.keys(service.stats);
  featureNames.forEach((feat, idx) => {
    const rawVal = latestFeature[feat];
    const mean = service.stats[feat].mean;
    const std = service.stats[feat].std;
    const zScore = latestNormalized[idx];
    console.log(`  • ${feat.padEnd(18)}: Raw = ${typeof rawVal === 'number' ? rawVal.toFixed(4) : rawVal} (Mean: ${mean.toFixed(2)}, Std: ${std.toFixed(2)}) => Z-Score: ${zScore.toFixed(2)}`);
  });

  // Today's full probability distribution
  const sequence = normalized.slice(-service.sequenceLength);
  const tensor = tf.tensor3d([sequence]);
  const prediction = service.model.predict(tensor);
  const scores = Array.from(await prediction.data());

  console.log("\n🤖 Full Softmax Probabilities Distribution for QQQ Today:");
  const sortedProbs = service.labels.map((label, idx) => ({ label, score: scores[idx] }))
    .sort((a, b) => b.score - a.score);

  sortedProbs.forEach(item => {
    console.log(`  ${item.label.padEnd(16)}: ${(item.score * 100).toFixed(2)}%`);
  });

  // 2. Trailing 15 Days History
  console.log("\n📈 QQQ ML Regime Trend over the last 15 Trading Days:");
  for (let offset = 14; offset >= 0; offset--) {
    const subSeq = normalized.slice(-service.sequenceLength - offset, normalized.length - offset);
    if (subSeq.length === service.sequenceLength) {
      const subTensor = tf.tensor3d([subSeq]);
      const subPred = service.model.predict(subTensor);
      const subScores = Array.from(await subPred.data());
      const maxIdx = subScores.indexOf(Math.max(...subScores));
      const date = features[features.length - 1 - offset].date;
      const close = features[features.length - 1 - offset].Close;
      const bearMarketScore = (subScores[service.labels.indexOf('BEAR_MARKET')] * 100).toFixed(1);
      const bearRallyScore = (subScores[service.labels.indexOf('BEAR_RALLY')] * 100).toFixed(1);
      const totalBear = ((parseFloat(bearMarketScore) + parseFloat(bearRallyScore))).toFixed(1);
      
      console.log(`  • ${date} (Close: $${close.toFixed(2)}): ${service.labels[maxIdx].padEnd(16)} [Top: ${(subScores[maxIdx]*100).toFixed(1)}%] | BEAR_MARKET: ${bearMarketScore}% | BEAR_RALLY: ${bearRallyScore}% | Total Bär: ${totalBear}%`);
    }
  }

  await expert.close();
}

analyzeQQQ().catch(console.error);
