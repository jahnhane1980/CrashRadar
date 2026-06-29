import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { MLRegimeService } from '../services/MLRegimeService.js';
import { AnalysisRepository } from '../core/repositories/AnalysisRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'ML-Cycles-Config.json');

export function getLabelForDate(dateStr, cycles) {
  const d = new Date(dateStr);
  for (const phase of cycles) {
    if (d >= new Date(phase.start) && d <= new Date(phase.end)) {
      return phase.label;
    }
  }
  return 'UNKNOWN';
}

export async function run(mockRepo = null, mockFs = null) {
  console.log('🚀 Starte ML Retraining Pipeline für alle konfigurierten Zyklen...');
  const repo = mockRepo || new AnalysisRepository();
  const fileSystem = mockFs || fs;
  
  try {
    const configData = JSON.parse(await fileSystem.readFile(CONFIG_PATH, 'utf-8'));
    
    console.log('📥 Lade historische Kerzen aus der TiDB ab 1999...');
    // Wir ziehen ab 1999, da die QQQ Historie so weit zurückreicht
    const data = await repo.getAllRawData('1999-01-01');
    
    // 1. Trainiere BTC Modell
    if (configData.cycles.btc && data.btc && data.btc.length > 0) {
      console.log('\n--- 🧠 Starte Training: btc_regime_v1 ---');
      const btcCandles = data.btc;
      btcCandles.sort((a, b) => new Date(a.date) - new Date(b.date));
      const labeledBtc = btcCandles.map(candle => ({
        ...candle,
        label: getLabelForDate(candle.date, configData.cycles.btc)
      }));
      const labeledCount = labeledBtc.filter(d => d.label !== 'UNKNOWN').length;
      console.log(`📊 Gefunden: ${btcCandles.length} Kerzen. Davon gelabelt: ${labeledCount}.`);
      
      const mlBtc = new MLRegimeService('btc_regime_v1');
      await mlBtc.retrain(labeledBtc);
    }

    // 2. Trainiere QQQ Modell
    if (configData.cycles.qqq && data.tiingo) {
      console.log('\n--- 🧠 Starte Training: qqq_regime_v1 ---');
      const qqqCandles = data.tiingo
        .filter(d => d.symbol === 'QQQ' && d.close !== null)
        .map(d => ({ date: d.date, close: d.close }));
        
      qqqCandles.sort((a, b) => new Date(a.date) - new Date(b.date));
      const labeledQqq = qqqCandles.map(candle => ({
        ...candle,
        label: getLabelForDate(candle.date, configData.cycles.qqq)
      }));
      const labeledCount = labeledQqq.filter(d => d.label !== 'UNKNOWN').length;
      console.log(`📊 Gefunden: ${qqqCandles.length} Kerzen. Davon gelabelt: ${labeledCount}.`);
      
      const mlQqq = new MLRegimeService('qqq_regime_v1');
      await mlQqq.retrain(labeledQqq);
    }

    // 3. Trainiere PLTR Modell
    if (configData.cycles.pltr && data.tiingo) {
      console.log('\n--- 🧠 Starte Training: pltr_regime_v1 ---');
      const pltrCandles = data.tiingo
        .filter(d => d.symbol === 'PLTR' && d.close !== null)
        .map(d => ({ date: d.date, close: d.close }));
        
      pltrCandles.sort((a, b) => new Date(a.date) - new Date(b.date));
      const labeledPltr = pltrCandles.map(candle => ({
        ...candle,
        label: getLabelForDate(candle.date, configData.cycles.pltr)
      }));
      const labeledCount = labeledPltr.filter(d => d.label !== 'UNKNOWN').length;
      console.log(`📊 Gefunden: ${pltrCandles.length} Kerzen. Davon gelabelt: ${labeledCount}.`);
      
      const mlPltr = new MLRegimeService('pltr_regime_v1');
      await mlPltr.retrain(labeledPltr);
    }
    
    console.log('\n✅ ML Retraining Runner erfolgreich beendet.');
    if (!mockRepo) process.exit(0);
  } catch (err) {
    console.error('❌ Fehler beim ML Retraining:', err);
    if (!mockRepo) process.exit(1);
    throw err;
  } finally {
    if (repo && repo.close) await repo.close();
  }
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
}
