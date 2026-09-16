import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase Setup
const projectId = process.env.SUPABASE_PROJECT_ID;
const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseUrl = `https://${projectId}.supabase.co`;
const supabase = createClient(supabaseUrl, apiKey);

const targetDir = path.resolve(process.cwd(), 'data/archive/intraday_test');
const csvFilePath = path.join(targetDir, 'SPY_M5_August_2024_Crash.csv');

async function fetchIntradayDataIfNeeded() {
  if (fs.existsSync(csvFilePath)) {
    console.log(`[Daten-Check] Datei existiert bereits: ${csvFilePath}`);
    console.log(`-> Download wird übersprungen.`);
    return;
  }

  console.log("[Download] Lade M5-Daten von Supabase herunter (Aug 1 - Aug 10, 2024)...");
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const SPY_TICKER_ID = 13;
  const startTimestamp = Math.floor(new Date('2024-08-01T00:00:00Z').getTime() / 1000);
  const endTimestamp = Math.floor(new Date('2024-08-10T00:00:00Z').getTime() / 1000);

  const { data, error } = await supabase
    .from('market_m5_candles')
    .select('timestamp, open, high, low, close, volume, vwap, trades')
    .eq('ticker', SPY_TICKER_ID)
    .gte('timestamp', startTimestamp)
    .lte('timestamp', endTimestamp)
    .order('timestamp', { ascending: true })
    .limit(10000);

  if (error) throw new Error("Supabase Fehler: " + error.message);
  if (!data || data.length === 0) throw new Error("Keine Daten für Aug 2024 gefunden.");

  let csvContent = 'timestamp,datetime,open,high,low,close,volume,vwap,trades\n';
  for (const row of data) {
    const dt = new Date(row.timestamp * 1000).toISOString();
    csvContent += `${row.timestamp},${dt},${row.open||''},${row.high||''},${row.low||''},${row.close||''},${row.volume||''},${row.vwap||''},${row.trades||''}\n`;
  }
  fs.writeFileSync(csvFilePath, csvContent);
  console.log(`[Download] ${data.length} Kerzen erfolgreich gespeichert in ${csvFilePath}`);
}

function runExecutionLogic() {
  console.log("\n--- Starte Signal-vs-Execution Auswertung (Slippage-Test) ---");
  
  const csvData = fs.readFileSync(csvFilePath, 'utf8').split('\n').filter(l => l.trim().length > 0);
  const rows = csvData.slice(1).map(line => {
    const p = line.split(',');
    return { dt: p[1], open: parseFloat(p[2]), high: parseFloat(p[3]), low: parseFloat(p[4]), close: parseFloat(p[5]) };
  });

  const fridayCandles = rows.filter(r => r.dt.startsWith('2024-08-02'));
  const mondayCandles = rows.filter(r => r.dt.startsWith('2024-08-05'));
  
  if (fridayCandles.length === 0 || mondayCandles.length === 0) {
      console.log("Fehler: Keine Daten für 02.08. oder 05.08. gefunden.");
      return;
  }

  const fridayClose = fridayCandles[fridayCandles.length - 1].close;
  const mondayOpen = mondayCandles[0].open;
  const gapSlippage = ((mondayOpen - fridayClose) / fridayClose) * 100;

  console.log(`Makro-Crash-Signal ausgelöst am Freitag (02.08.2024) zum Daily Close.`);
  console.log(`Ausführungs-Tag: Black Monday (05.08.2024) - Yen Carry Trade Crash\n`);
  
  console.log(`[Das Problem: Die Overnight-Lücke (Gaps)]`);
  console.log(`Freitag Schlusskurs: $${fridayClose.toFixed(2)}`);
  console.log(`Montag Eröffnungskurs: $${mondayOpen.toFixed(2)}`);
  console.log(`-> Unvermeidbare Slippage durch Gap-Down: ${gapSlippage.toFixed(2)}%`);
  
  console.log(`\nFazit: Wenn ein Makro-Signal erst zum Daily Close berechnet wird und der Verkauf zur nächsten Eröffnung stattfindet, erleidet man extremen "Friction Loss". Dies bestätigt die Theorie, dass das Signal nicht blind auf derselben (Daily) Timeframe ausgeführt werden darf, sondern fraktal (z.B. Intraday vor dem Close oder bei Intraday-Gegenbewegungen) gehandelt werden muss!`);
}

async function run() {
  await fetchIntradayDataIfNeeded();
  runExecutionLogic();
}

run().catch(console.error);
