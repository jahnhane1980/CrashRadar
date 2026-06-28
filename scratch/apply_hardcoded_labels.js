import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputCsv = path.join(__dirname, '..', 'data', 'ml', 'btc_historical.csv');
const outputCsv = path.join(__dirname, '..', 'data', 'ml', 'btc_labeled.csv');

// Unser Ground Truth Lexikon für Bitcoin Zyklen
const CYCLES = [
  // --- ZYKLUS 0 (Mt. Gox Aftermath) ---
  { start: '2014-09-01', end: '2014-12-31', label: 'DOWNTREND' },
  { start: '2015-01-01', end: '2015-02-28', label: 'MACRO_BOTTOM' }, // ~$150 bis $200

  // --- ZYKLUS 1 (ICO Boom & Crash) ---
  { start: '2015-03-01', end: '2017-11-15', label: 'UPTREND' },
  { start: '2017-11-16', end: '2018-01-15', label: 'MACRO_TOP' },    // ~$20k Hype
  { start: '2018-01-16', end: '2018-10-31', label: 'DOWNTREND' },    // Der langsame Tod auf $6k
  { start: '2018-11-01', end: '2019-03-31', label: 'MACRO_BOTTOM' }, // Hash-War Crash auf $3k

  // --- ZYKLUS 2 (Institutioneller Run & FTX) ---
  { start: '2019-04-01', end: '2021-10-31', label: 'UPTREND' },      // Inkl. Covid-Dip und Run auf 64k
  { start: '2021-11-01', end: '2021-12-31', label: 'MACRO_TOP' },    // ~$69k Double Top
  { start: '2022-01-01', end: '2022-10-31', label: 'DOWNTREND' },    // Luna & Celsius Crash
  { start: '2022-11-01', end: '2023-01-15', label: 'MACRO_BOTTOM' }, // FTX Kollaps auf $15k

  // --- ZYKLUS 3 (BlackRock ETF & KI-Boom) ---
  { start: '2023-01-16', end: '2025-09-14', label: 'UPTREND' },      // Der lange Aufstieg zum Peak
  { start: '2025-09-15', end: '2025-10-31', label: 'MACRO_TOP' },    // Euphorie & Peak bei 124k
  { start: '2025-11-01', end: '2099-12-31', label: 'DOWNTREND' }     // Der Bärenmarkt danach
];

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
