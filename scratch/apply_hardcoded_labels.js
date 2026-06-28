import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputCsv = path.join(__dirname, '..', 'data', 'ml', 'btc_historical.csv');
const outputCsv = path.join(__dirname, '..', 'data', 'ml', 'btc_labeled.csv');

const configPath = path.join(__dirname, '..', 'config', 'ML-Cycles-Config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const CYCLES = config.cycles;
function getLabelForDate(dateStr) {
  const d = new Date(dateStr);
  for (const phase of CYCLES) {
    if (d >= new Date(phase.start) && d <= new Date(phase.end)) {
      return phase.label;
    }
  }
  return 'UNKNOWN'; // Sollte bei lückenloser Definition nicht passieren
}

function applyLabels() {
  console.log('🔄 Lese ungelabelte Features ein...');
  const fileContent = fs.readFileSync(inputCsv, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });
  
  let csvContent = 'date,close,volume,return_pct,rsi_14,macd_hist,phase\n';
  const stats = { MACRO_TOP: 0, MACRO_BOTTOM: 0, UPTREND: 0, DOWNTREND: 0, UNKNOWN: 0 };

  for (const row of records) {
    const label = getLabelForDate(row.date);
    stats[label] = (stats[label] || 0) + 1;
    
    csvContent += `${row.date},${row.close},${row.volume},${row.return_pct},${row.rsi_14},${row.macd_hist},${label}\n`;
  }

  fs.writeFileSync(outputCsv, csvContent, 'utf-8');
  
  console.log('✅ Labeling erfolgreich abgeschlossen! Datei gespeichert unter: data/ml/btc_labeled.csv');
  console.log('\n📊 Verteilung der Marktphasen (Ground Truth):');
  console.log(`---------------------------------------------`);
  const total = records.length;
  for (const [phase, count] of Object.entries(stats)) {
    console.log(`${phase.padEnd(14)}: ${String(count).padStart(4)} Tage (${((count/total)*100).toFixed(1)}%)`);
  }
}

applyLabels();
