import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzePltr() {
  console.log('====================================================================================================');
  console.log('   PLTR HISTORISCHE ANALYSE: DEZEMBER 2024 BIS MAI 2025 (KURS & VOLUMEN)');
  console.log('====================================================================================================\n');

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Hole PLTR, SPY und QQQ
  const [pltrRows] = await conn.query(`
    SELECT record_date as date, open, high, low, close, volume 
    FROM market_data_tiingo 
    WHERE symbol = 'PLTR' AND record_date BETWEEN '2024-09-01' AND '2025-06-30' 
    ORDER BY record_date ASC
  `);

  const [spyRows] = await conn.query(`
    SELECT record_date as date, close 
    FROM market_data_tiingo 
    WHERE symbol = 'SPY' AND record_date BETWEEN '2024-12-01' AND '2025-05-31' 
    ORDER BY record_date ASC
  `);

  const [vixRows] = await conn.query(`
    SELECT record_date as date, close 
    FROM market_data_yahoo 
    WHERE symbol = '^VIX' AND record_date BETWEEN '2024-12-01' AND '2025-05-31' 
    ORDER BY record_date ASC
  `);

  await conn.end();

  const spyMap = new Map(spyRows.map(r => [r.date, r.close]));
  const vixMap = new Map(vixRows.map(r => [r.date, r.close]));

  // 50-Tage rollierender Volumendurchschnitt für PLTR
  const pltrData = [];
  for (let i = 0; i < pltrRows.length; i++) {
    const item = { ...pltrRows[i] };
    if (i >= 49) {
      const slice = pltrRows.slice(i - 49, i + 1);
      const sumVol = slice.reduce((acc, c) => acc + (c.volume || 0), 0);
      item.sma50Vol = sumVol / 50;
      item.rvol = item.sma50Vol > 0 ? item.volume / item.sma50Vol : 1;
    } else {
      item.sma50Vol = item.volume;
      item.rvol = 1;
    }
    pltrData.push(item);
  }

  const pltrMap = new Map(pltrData.map(d => [d.date, d]));

  // Filtere Zeitraum 2024-12-01 bis 2025-05-31
  const periodData = pltrData.filter(d => d.date >= '2024-12-01' && d.date <= '2025-05-31');

  // Peaks und Tiefs finden
  let pltrPeak = 0, pltrPeakDate = '';
  let pltrTrough = Infinity, pltrTroughDate = '';
  let maxVol = 0, maxVolDate = '';

  for (const d of periodData) {
    if (d.close > pltrPeak) { pltrPeak = d.close; pltrPeakDate = d.date; }
    if (d.close < pltrTrough) { pltrTrough = d.close; pltrTroughDate = d.date; }
    if (d.volume > maxVol) { maxVol = d.volume; maxVolDate = d.date; }
  }

  const maxDD = ((pltrTrough - pltrPeak) / pltrPeak) * 100;

  console.log(`Gesamt-Metriken für PLTR (Dez 2024 - Mai 2025):`);
  console.log(`  • Allzeithoch/Peak: ${pltrPeakDate} ($${pltrPeak.toFixed(2)})`);
  console.log(`  • Crash-Tief:       ${pltrTroughDate} ($${pltrTrough.toFixed(2)}) | Drawdown: ${maxDD.toFixed(1)} %`);
  console.log(`  • Maximales Volumen: ${maxVolDate} (${(maxVol / 1e6).toFixed(1)} Mio. Aktien | RVOL: ${pltrMap.get(maxVolDate).rvol.toFixed(1)}x)`);

  console.log(`\nChronologie des Kurs- und Volumenverlaufs:`);
  console.log(`| Datum      | PLTR Kurs | Tag %   | PLTR vs Peak | Vol (Mio) | RVOL (vs 50d) | SPY DD % | VIX   | Makro- / Trading-Ereignis |`);
  console.log(`|:-----------|:----------|:--------|:-------------|:----------|:--------------|:---------|:------|:--------------------------|`);

  const spyPeak = 612.93; // 2025-02-19
  let prevClose = null;

  for (let i = 0; i < periodData.length; i++) {
    const item = periodData[i];
    const d = item.date;
    const dayChg = prevClose ? ((item.close - prevClose) / prevClose) * 100 : 0;
    const vsPeak = ((item.close - pltrPeak) / pltrPeak) * 100;
    const volMio = (item.volume / 1e6).toFixed(1);
    const rvol = item.rvol.toFixed(1);
    const sPrice = spyMap.get(d) || 0;
    const sDD = sPrice > 0 ? ((sPrice - spyPeak) / spyPeak) * 100 : 0;
    const vix = vixMap.get(d) || 0;

    let event = '';
    if (d === '2024-12-02') event = '🚀 Jahresend-Rallye Start';
    else if (d === '2024-12-24') event = 'Melt-Up Phase';
    else if (d === '2025-01-15') event = 'Starke Konsolidierung vor Earnings';
    else if (d === '2025-02-04') event = '💥 Q4-Earnings Explosion';
    else if (d === pltrPeakDate) event = '🏆 PLTR ALLZEITHOCH (PEAK)';
    else if (d === '2025-02-19') event = '📌 S&P 500 Peak ($612.93)';
    else if (d === '2025-03-03') event = 'Capacity Radar: WARNING (Slack sinkt)';
    else if (d === '2025-03-10') event = '🚨 KATASTROPHEN-MATRIX ALARM (SPY < SMA200)';
    else if (d === '2025-03-12') event = '⚡ IMMINENT_DRAIN: Tax-Day Refill Welle';
    else if (d === '2025-03-20') event = 'Deleveraging Druck';
    else if (d === '2025-04-01') event = 'Capacity Radar: 85.4/100 (Roter Alarm)';
    else if (d === '2025-04-04') event = '⚡ VIX schießt auf 45, Panik-Abverkauf';
    else if (d === '2025-04-07') event = '🩸 Letztes Ausbluten';
    else if (d === pltrTroughDate) event = '🔥 PLTR CRASH-BODEN / TIEF!';
    else if (d === '2025-04-08') event = '🏁 SPY BODEN (-19.0%) & VIX 52.3 Peak!';
    else if (d === '2025-04-09') event = '🚀 Gewaltiges V-Shape Reversal';
    else if (d === '2025-04-15') event = 'Tax-Day: TGA Refill abgeschlossen';
    else if (d === '2025-04-30') event = 'Rückeroberung alter Hochs';
    else if (d === '2025-05-15') event = 'Erholung komplettiert';

    // Zeige markante Tage oder Tage mit extremem RVOL (> 1.5x) oder großen Schwankungen
    const isSpecial = event !== '' || item.rvol >= 1.7 || Math.abs(dayChg) >= 5.0 || d.endsWith('-01') || d.endsWith('-15');

    if (isSpecial) {
      console.log(`| ${d} | $${item.close.toFixed(2).padEnd(6)} | ${(dayChg >= 0 ? '+' : '') + dayChg.toFixed(1).padStart(5)} % | ${(vsPeak >= 0 ? '+' : '') + vsPeak.toFixed(1).padStart(6)} %   | ${volMio.padStart(6)}M | ${rvol.padStart(5)}x       | ${sDD.toFixed(1).padStart(5)} %  | ${vix.toFixed(1).padStart(4)}  | ${event} |`);
    }

    prevClose = item.close;
  }

  // Rebound-Analyse vom Tief bis Mitte Mai
  const troughItem = pltrMap.get(pltrTroughDate);
  const may15Item = pltrMap.get('2025-05-15');
  if (troughItem && may15Item) {
    const pltrRebound = ((may15Item.close - troughItem.close) / troughItem.close) * 100;
    console.log(`\nRebound-Leistung von PLTR:`);
    console.log(`  • Tiefstkurs am ${pltrTroughDate}: $${troughItem.close.toFixed(2)}`);
    console.log(`  • Kurs am 15.05.2025:            $${may15Item.close.toFixed(2)}`);
    console.log(`  • Kursanstieg nach dem Tief:      +${pltrRebound.toFixed(1)} %!`);
  }
}

analyzePltr().catch(console.error);
