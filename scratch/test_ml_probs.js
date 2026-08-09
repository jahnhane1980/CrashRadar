import 'dotenv/config';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { MLRegimeService } from '../src/services/MLRegimeService.js';

async function testProbs() {
  const expert = new FinanceExpert(process.env.DATABASE_URL);
  const groupedData = await expert.getDailyGroupedData('2015-01-01');

  const getCandles = (data, assetName, volName) => data.map(d => ({
    date: d.date,
    close: d.assets[assetName],
    volume: d.assets[volName] || 0,
    high: d.assets[`${assetName}_High`] || d.assets[assetName],
    low: d.assets[`${assetName}_Low`] || d.assets[assetName]
  })).filter(c => c.close !== null && c.close !== undefined);

  const btcCandles = getCandles(groupedData, 'BTC', 'BTC_Volume');
  const service = new MLRegimeService('btc_regime_v2');
  await service.loadModel();
  
  const features = service.buildFeatures(btcCandles);
  const normalized = service.normalize(features, false);
  const sequence = normalized.slice(-service.sequenceLength);
  
  const tf = await import('@tensorflow/tfjs');
  const tensor = tf.tensor3d([sequence]);
  const prediction = service.model.predict(tensor);
  const scores = Array.from(await prediction.data());

  console.log("BTC Probabilities Distribution:");
  service.labels.forEach((label, idx) => {
    console.log(`  ${label}: ${(scores[idx] * 100).toFixed(2)}%`);
  });

  await expert.close();
}

testProbs().catch(console.error);
