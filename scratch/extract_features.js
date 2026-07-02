import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import { RSI, MACD } from 'technicalindicators';

async function run() {
  console.log("Starte ML Feature Pipeline für btc_regime_v2...");

  // 1. Lade unsere perfekten Dow-Theory Labels
  const csvPath = path.join(process.cwd(), 'scratch', 'btc_regimes_output.csv');
  if (!fs.existsSync(csvPath)) {
      console.error("Fehler: btc_regimes_output.csv nicht gefunden! Bitte vorher den RegimeLabeler laufen lassen.");
      process.exit(1);
  }
  const csvLines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim() !== '');
  
  const labelsMap = {};
  for(let i=1; i<csvLines.length; i++) {
     const [date, close, label] = csvLines[i].split(',');
     labelsMap[date] = label.trim();
  }
  
  console.log(`Lade ${Object.keys(labelsMap).length} Labels aus CSV...`);

  // 2. Datenbank-Verbindung für High, Low und Volume
  const pool = mysql.createPool(process.env.DATABASE_URL);
  
  console.log("Ziehe hochauflösende OHLCV-Daten aus der Datenbank...");
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(FROM_UNIXTIME(open_time/1000), '%Y-%m-%d') as date, close, volume, high, low 
    FROM market_data_binance 
    WHERE symbol = 'BTCUSDT' AND interval_type = '1d' 
    ORDER BY open_time ASC
  `);
  
  let obv = 0;
  let prevClose = null;
  const features = [];
  const closePrices = [];
  
  // 3. Basis-Features (OBV & True Range) berechnen
  for(const row of rows) {
     const date = row.date;
     const close = Number(row.close);
     const volume = Number(row.volume);
     const high = Number(row.high);
     const low = Number(row.low);
     
     closePrices.push(close);

     // OBV (On-Balance Volume)
     if (prevClose !== null) {
       if (close > prevClose) obv += volume;
       else if (close < prevClose) obv -= volume;
     }
     
     // True Range (TR)
     let tr = high - low;
     if (prevClose !== null) {
       tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
     }
     
     features.push({
       date,
       close,
       volume,
       obv,
       tr
     });
     prevClose = close;
  }
  
  // 4. RSI und MACD berechnen
  console.log("Berechne RSI (14) und MACD (12, 26, 9)...");
  const rsiOutput = RSI.calculate({ values: closePrices, period: 14 });
  const macdOutput = MACD.calculate({ 
      values: closePrices, 
      fastPeriod: 12, 
      slowPeriod: 26, 
      signalPeriod: 9, 
      SimpleMAOscillator: false, 
      SimpleMASignal: false 
  });
  
  // Da Indikatoren einen Warmup haben, müssen wir sie nach rechts padden
  const rsiPadded = Array(closePrices.length - rsiOutput.length).fill(null).concat(rsiOutput);
  const macdPadded = Array(closePrices.length - macdOutput.length).fill(null).concat(macdOutput);

  // 5. Erweiterte Features (ATR) berechnen und mappen
  console.log("Berechne ATR (Average True Range) und verheirate Features mit Labels...");
  const finalDataset = [];
  
  for(let i=0; i<features.length; i++) {
     const f = features[i];
     
     // ATR-14 (Average True Range über 14 Tage)
     let atr = null;
     if (i >= 13) {
       let sum = 0;
       for(let j=i-13; j<=i; j++) sum += features[j].tr;
       atr = sum / 14;
     }
     
     const rsi = rsiPadded[i];
     const macd = macdPadded[i] ? macdPadded[i].histogram : null;
     const label = labelsMap[f.date] || 'UNKNOWN';
     
     // Nur exportieren, wenn alle Indikatoren berechnet wurden (Warmup-Phase überspringen)
     if (atr !== null && rsi !== null && macd !== null && macd !== undefined) {
         finalDataset.push(`${f.date},${f.close.toFixed(2)},${f.volume.toFixed(2)},${f.obv.toFixed(2)},${atr.toFixed(2)},${rsi.toFixed(2)},${macd.toFixed(2)},${label}`);
     }
  }
  
  const outPath = path.join(process.cwd(), 'scratch', 'btc_ml_dataset_final.csv');
  fs.writeFileSync(outPath, "Date,Close,Volume,OBV,ATR_14,RSI_14,MACD_Hist,Label\n" + finalDataset.join('\n'));
  
  console.log(`\n✅ ML Feature Pipeline erfolgreich abgeschlossen!`);
  console.log(`Exportiert nach: ${outPath}`);
  console.log(`Anzahl Datensätze (ready for LSTM): ${finalDataset.length}`);
  
  await pool.end();
}

run();
