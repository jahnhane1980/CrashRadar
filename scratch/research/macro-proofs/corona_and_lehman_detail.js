import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

async function runDetail() {
  const gldRaw = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'scratch/trash/cache/GLD_tiingo_full.json'), 'utf-8'));
  const gldData = [];
  for (let i = 0; i < gldRaw.length; i++) {
    const item = { ...gldRaw[i] };
    if (i >= 49) {
      const slice = gldRaw.slice(i - 49, i + 1);
      const sumVol = slice.reduce((acc, c) => acc + (c.volume || 0), 0);
      item.sma50Vol = sumVol / 50;
      item.volRatio = item.sma50Vol > 0 ? item.volume / item.sma50Vol : 1;
    } else {
      item.sma50Vol = item.volume;
      item.volRatio = 1;
    }
    gldData.push(item);
  }
  const gldMap = new Map(gldData.map(d => [d.date, d]));

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // 1. CORONA 2020
  const [cRows] = await conn.query(`
    SELECT record_date as date, close, volume 
    FROM market_data_tiingo 
    WHERE symbol = 'SPY' AND record_date BETWEEN '2020-02-18' AND '2020-03-31' 
    ORDER BY record_date ASC
  `);

  console.log('================================================================================================================');
  console.log('CORONA 2020 CRASH: TAGESGENAUE CHRONOLOGIE (SPY vs. GLD vs. GLD-VOLUMEN)');
  console.log('================================================================================================================');
  console.log('Datum      | SPY Kurs | SPY DD % | GLD Kurs | GLD Tag% | GLD vs Peak | GLD Vol (Mio) | Vol Ratio | Marktphase / Notiz');
  console.log('-----------|----------|----------|----------|----------|-------------|---------------|-----------|-------------------------------------');
  
  const cSpyPeak = 338.34; // 2020-02-19
  const cGldPeak = 158.06; // 2020-03-09
  let prevGld = null;
  for (const r of cRows) {
    const g = gldMap.get(r.date);
    if (!g) continue;
    const spyDD = ((r.close - cSpyPeak) / cSpyPeak) * 100;
    const dayChg = prevGld ? ((g.close - prevGld.close) / prevGld.close) * 100 : 0;
    const vsPeak = ((g.close - cGldPeak) / cGldPeak) * 100;
    const vMio = (g.volume / 1e6).toFixed(1);
    const vR = g.volRatio.toFixed(1);

    let note = '';
    if (r.date === '2020-02-19') note = '📌 SPY Peak (Start)';
    else if (r.date === '2020-02-24') note = '🛡️ Erste Panik (-3.3%), Gold steigt +1.7%';
    else if (r.date === '2020-02-28') note = '🛡️ SPY bricht -10% (-12.8%), Gold hält (+0.4%)';
    else if (r.date === '2020-03-06') note = '🛡️ SPY -12.3%, Gold explodiert ($157.90, +5.5%)';
    else if (r.date === '2020-03-09') note = '🏆 GLD PEAK ($158.06) | SPY bei -18.9% (!) | Safe Haven Top';
    else if (r.date === '2020-03-11') note = '⚠️ SPY bricht -20% (-20.4%) ➔ Margin Calls beginnen!';
    else if (r.date === '2020-03-12') note = '⚡ Black Thursday: SPY -26.7%, Gold stürzt -3.6%';
    else if (r.date === '2020-03-13') note = '🩸 Margin Call Panik: Gold -4.2%, Vol 32.5 Mio (3.0x)';
    else if (r.date === '2020-03-16') note = '⚡ Fed Notfall 0%, SPY -29.5%, Gold -2.8% (3.2x Vol)';
    else if (r.date === '2020-03-18') note = '🩸 Panik-Gipfel: Gold -2.8%, Vol 31.6 Mio (2.8x)';
    else if (r.date === '2020-03-19') note = '🔥 GLD BODEN ($138.92)! Reversal trotz SPY -28.9%';
    else if (r.date === '2020-03-20') note = '🚀 Gold Rebound (+1.6%), SPY fällt weiter (-31.9%)';
    else if (r.date === '2020-03-23') note = '🏁 SPY BODEN ($222.95, -34.1%), Gold springt +3.6%';
    else if (r.date === '2020-03-24') note = '🚀 Fed Bazooka: Gold explodiert +5.0% auf $153.21!';

    console.log(`${r.date} | $${r.close.toFixed(2).padEnd(7)}| ${spyDD.toFixed(1).padStart(6)} % | $${g.close.toFixed(2).padEnd(7)}| ${(dayChg >= 0 ? '+' : '') + dayChg.toFixed(1).padStart(5)} %  | ${(vsPeak >= 0 ? '+' : '') + vsPeak.toFixed(1).padStart(7)} %   | ${vMio.padStart(7)} Mio    | ${vR.padStart(5)}x     | ${note}`);
    prevGld = g;
  }

  // 2. LEHMAN 2008
  const [lRows] = await conn.query(`
    SELECT record_date as date, close, volume 
    FROM market_data_tiingo 
    WHERE symbol = 'SPY' AND record_date BETWEEN '2008-09-01' AND '2008-11-30' 
    ORDER BY record_date ASC
  `);

  console.log('\n================================================================================================================');
  console.log('LEHMAN BROTHERS 2008: TAGESGENAUE CHRONOLOGIE');
  console.log('================================================================================================================');
  console.log('Datum      | SPY Kurs | SPY DD % | GLD Kurs | GLD Tag% | GLD vs Peak | GLD Vol (Mio) | Vol Ratio | Marktphase / Notiz');
  console.log('-----------|----------|----------|----------|----------|-------------|---------------|-----------|-------------------------------------');

  const lSpyPeak = 130.62; // 2008-08-11
  const lGldPeak = 89.58;  // 2008-09-29
  prevGld = null;
  for (const r of lRows) {
    const g = gldMap.get(r.date);
    if (!g) continue;
    const spyDD = ((r.close - lSpyPeak) / lSpyPeak) * 100;
    const dayChg = prevGld ? ((g.close - prevGld.close) / prevGld.close) * 100 : 0;
    const vsPeak = ((g.close - lGldPeak) / lGldPeak) * 100;
    const vMio = (g.volume / 1e6).toFixed(1);
    const vR = g.volRatio.toFixed(1);

    let note = '';
    if (r.date === '2008-09-15') note = '📌 Lehman Brothers meldet Insolvenz an';
    else if (r.date === '2008-09-17') note = '🛡️ Panik-Flucht in Gold: GLD +9.0% an 1 Tag!';
    else if (r.date === '2008-09-18') note = '🛡️ Safe-Haven-Explosion: GLD +5.4% auf $89.27';
    else if (r.date === '2008-09-29') note = '🏆 GLD PEAK ($88.82) | SPY -15.1% | TARP-Veto im Kongress';
    else if (r.date === '2008-10-06') note = '⚠️ SPY bricht -20% (-20.1%) ➔ Globale Margin Calls!';
    else if (r.date === '2008-10-10') note = '⚡ Black Week: SPY -31.3%, Gold wird panisch liquidiert';
    else if (r.date === '2008-10-15') note = '🩸 Margin Calls erzwingen Gold-Verkäufe ($82.72)';
    else if (r.date === '2008-10-23') note = '🩸 TED-Spread auf Rekordhoch, GLD fällt auf $70.80';
    else if (r.date === '2008-10-24') note = '🔥 Panik-Kapitulation: GLD Intraday $68.00, Vol 28.5 Mio (1.7x)';
    else if (r.date === '2008-11-12') note = '🩸 Letztes Re-Test Tief ($70.00) bei SPY -34.3%';
    else if (r.date === '2008-11-20') note = '🏁 SPY BODEN ($75.42, -42.3%), Gold hält stabil ($73.46)';
    else if (r.date === '2008-12-01') note = '🚀 Gold dreht nach oben ($76.12), Aktien schwanken';

    if (note || r.date === '2008-09-02' || r.date === '2008-10-01' || r.date === '2008-10-07' || r.date === '2008-10-16' || r.date === '2008-10-28' || r.date === '2008-11-04' || r.date === '2008-11-14') {
      console.log(`${r.date} | $${r.close.toFixed(2).padEnd(7)}| ${spyDD.toFixed(1).padStart(6)} % | $${g.close.toFixed(2).padEnd(7)}| ${(dayChg >= 0 ? '+' : '') + dayChg.toFixed(1).padStart(5)} %  | ${(vsPeak >= 0 ? '+' : '') + vsPeak.toFixed(1).padStart(7)} %   | ${vMio.padStart(7)} Mio    | ${vR.padStart(5)}x     | ${note}`);
    }
    prevGld = g;
  }

  await conn.end();
}

runDetail();
