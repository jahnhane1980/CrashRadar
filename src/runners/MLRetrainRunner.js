import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { MLRegimeService } from '../services/MLRegimeService.js';
import { AnalysisRepository } from '../core/repositories/AnalysisRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'ML-Cycles-Config.json');

function getLabelForDate(dateStr, cycles) {
  const d = new Date(dateStr);
  for (const phase of cycles) {
    if (d >= new Date(phase.start) && d <= new Date(phase.end)) {
      return phase.label;
    }
  }
  return 'UNKNOWN';
}

async function run() {
  console.log('🚀 Starte ML Retraining Pipeline für alle konfigurierten Zyklen...');
  const repo = new AnalysisRepository();
  
  try {
    const configData = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
    
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
    
    console.log('\n✅ ML Retraining Runner erfolgreich beendet.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Fehler beim ML Retraining:', err);
    process.exit(1);
  } finally {
    await repo.close();
  }
}

run();
