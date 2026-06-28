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
  console.log('🚀 Starte ML Retraining Pipeline...');
  const repo = new AnalysisRepository();
  
  try {
    const mlService = new MLRegimeService();
    
    console.log('📥 Lade historische Kerzen aus der TiDB (market_data_binance)...');
    // Wir ziehen ab 2014, da das der Beginn unserer Cycles-Config ist
    const data = await repo.getAllRawData('2014-01-01');
    const btcCandles = data.btc;
    
    if (!btcCandles || btcCandles.length === 0) {
        throw new Error('Keine BTC Daten in der Datenbank gefunden!');
    }
    
    // Zwingend chronologisch sortieren (Alt -> Neu) für sauberes LSTM Sequencing
    btcCandles.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log('🏷️  Mappe Ground-Truth Zyklen auf die Daten...');
    const configData = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
    
    const labeledData = btcCandles.map(candle => {
        return {
            ...candle,
            label: getLabelForDate(candle.date, configData.cycles)
        };
    });
    
    const labeledCount = labeledData.filter(d => d.label !== 'UNKNOWN').length;
    console.log(`📊 Gefunden: ${btcCandles.length} Kerzen. Davon gelabelt: ${labeledCount}.`);
    
    await mlService.retrain(labeledData);
    
    console.log('✅ ML Retraining Runner beendet.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Fehler beim ML Retraining:', err);
    process.exit(1);
  } finally {
    await repo.close();
  }
}

run();
