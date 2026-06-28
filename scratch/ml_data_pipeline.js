import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

import { RSI, MACD } from 'technicalindicators';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mlDir = path.join(__dirname, '..', 'data', 'ml');

if (!fs.existsSync(mlDir)) {
  fs.mkdirSync(mlDir, { recursive: true });
}

const btcCsvPath = path.join(mlDir, 'btc_historical.csv');

async function fetchAndPrepareData() {
  console.log('🔄 Lade historische BTC-Daten (ab 2014) über Yahoo Finance...');
  const queryOptions = { period1: '2014-09-17', interval: '1d' };
  
  const chartData = await yahooFinance.chart('BTC-USD', queryOptions);
  const rawData = chartData.quotes;
  
  if (!rawData || rawData.length === 0) {
    console.error('❌ Keine Daten erhalten!');
    process.exit(1);
  }

  console.log(`✅ ${rawData.length} Datensätze empfangen. Berechne stationäre Features...`);

  // Extrahiere Arrays für die Indikatoren
  const closes = rawData.map(d => d.close);
  
  // Berechne RSI (14)
  const rsiInput = { values: closes, period: 14 };
  const rsiResults = RSI.calculate(rsiInput);
  
  // Berechne MACD (12, 26, 9)
  const macdInput = {
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  };
  const macdResults = MACD.calculate(macdInput);

  // Da Indikatoren einen Vorlauf (Lag) brauchen, fehlen die ersten X Werte.
  // RSI(14) liefert N-14 Werte. MACD(26+9) liefert noch weniger.
  // Wir nullen die ersten Rows einfach aus oder schneiden sie ab.
  const rsiPadding = rawData.length - rsiResults.length;
  const macdPadding = rawData.length - macdResults.length;

  let csvContent = 'date,close,volume,return_pct,rsi_14,macd_hist\n';
  let validRows = 0;

  for (let i = 1; i < rawData.length; i++) {
    const today = rawData[i];
    const yesterday = rawData[i - 1];
    
    // Feature 1: Stationärer Return (in Prozent)
    const returnPct = ((today.close - yesterday.close) / yesterday.close) * 100;
    
    // Feature 2: RSI
    const rsi = i >= rsiPadding ? rsiResults[i - rsiPadding] : '';
    
    // Feature 3: MACD Histogram
    const macd = i >= macdPadding ? macdResults[i - macdPadding].histogram : '';

    // Wir schreiben nur Rows ins CSV, bei denen wir volle Indikatoren haben
    if (rsi !== '' && macd !== '' && macd !== undefined) {
      const dateStr = today.date.toISOString().split('T')[0];
      csvContent += `${dateStr},${today.close.toFixed(2)},${today.volume},${returnPct.toFixed(4)},${rsi.toFixed(2)},${macd.toFixed(4)}\n`;
      validRows++;
    }
  }

  fs.writeFileSync(btcCsvPath, csvContent, 'utf-8');
  console.log(`🎉 Erfolgreich ${validRows} stationäre Datensätze unter ${btcCsvPath} gespeichert.`);
}

fetchAndPrepareData().catch(console.error);
