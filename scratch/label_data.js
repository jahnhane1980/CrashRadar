import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const btcCsvPath = path.join(__dirname, '..', 'data', 'ml', 'btc_historical.csv');

function analyzeLabels() {
  const fileContent = fs.readFileSync(btcCsvPath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  // Konvertiere zu Zahlen
  const data = records.map(r => ({
    date: r.date,
    close: parseFloat(r.close),
    return_pct: parseFloat(r.return_pct)
  }));

  // Hyperparameter für das Labeling (wie von dir vorgeschlagen)
  const LOOK_FORWARD_DAYS = 14; 
  const BOTTOM_THRESHOLD = 10; // +10% Rendite in den nächsten 14 Tagen

  let bottomCount = 0;
  let noiseCount = 0;

  for (let i = 0; i < data.length - LOOK_FORWARD_DAYS; i++) {
    const currentPrice = data[i].close;

    // Zukunft (die nächsten 14 Tage)
    const futurePrice = data[i + LOOK_FORWARD_DAYS].close;
    const futureReturn = ((futurePrice - currentPrice) / currentPrice) * 100;

    // Definition prüfen: Steigt der Preis in den nächsten 14 Tagen um mind. 10%?
    if (futureReturn >= BOTTOM_THRESHOLD) {
      bottomCount++;
    } else {
      noiseCount++;
    }
  }

  const total = bottomCount + noiseCount;
  
  console.log(`\n📊 Überprüfung der Definition an den BTC-Daten:`);
  console.log(`"Ein Bottom ist, wenn der Preis in den folgenden ${LOOK_FORWARD_DAYS} Tagen um mindestens ${BOTTOM_THRESHOLD}% steigt."`);
  console.log(`----------------------------------------------------`);
  console.log(`🟢 Erfüllt (BOTTOM): ${bottomCount} Tage (${((bottomCount/total)*100).toFixed(2)}%)`);
  console.log(`⚪ Nicht erfüllt:    ${noiseCount} Tage (${((noiseCount/total)*100).toFixed(2)}%)`);
  console.log(`----------------------------------------------------`);
}

analyzeLabels();
