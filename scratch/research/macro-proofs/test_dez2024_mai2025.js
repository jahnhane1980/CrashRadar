import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

async function checkDez2024Mai2025() {
  console.log('========================================================================================');
  console.log('   HISTORISCHER CHECK: DEZEMBER 2024 BIS MAI 2025');
  console.log('========================================================================================\n');

  // Lade GLD
  const cacheDir = path.resolve(ROOT_DIR, 'scratch/trash/cache');
  const gldRaw = JSON.parse(fs.readFileSync(path.join(cacheDir, 'GLD_tiingo_full.json'), 'utf8'));
  const gldMap = new Map(gldRaw.map(d => [d.date, d]));

  // Lade SPY, QQQ, VIX
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [spyRows] = await conn.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'SPY' ORDER BY record_date ASC`);
  const [qqqRows] = await conn.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'QQQ' ORDER BY record_date ASC`);
  const [vixRows] = await conn.query(`SELECT record_date as date, close FROM market_data_yahoo WHERE symbol = '^VIX' ORDER BY record_date ASC`);
  await conn.end();

  const spyMap = new Map(spyRows.map(d => [d.date, d.close]));
  const qqqMap = new Map(qqqRows.map(d => [d.date, d.close]));
  const vixMap = new Map(vixRows.map(d => [d.date, d.close]));

  // Lade Makro-Daten
  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2024-10-01', { bypassMemoryGuard: true });
  await fe.close();
  const timelineMap = new Map(timeline.map(t => [t.date, t]));

  // Berechne SMA 200 für SPY
  const allDates = spyRows.map(r => r.date).filter(d => gldMap.has(d) && vixMap.has(d)).sort();
  const spySma200 = new Map();
  for (let i = 0; i < allDates.length; i++) {
    const d = allDates[i];
    if (i >= 199) {
      let sum = 0;
      for (let j = 0; j < 200; j++) sum += spyMap.get(allDates[i - j]);
      spySma200.set(d, sum / 200);
    }
  }

  // Net Liq Delta & Margin Debt
  const weeklyNetLiq = [];
  const netLiqDeltaMap = new Map();
  for (let i = 0; i < timeline.length; i++) {
    const day = timeline[i];
    const nl = day.macroGroups?.NetLiquidity;
    if (nl && nl.WALCL !== undefined) {
      const dObj = new Date(day.date);
      const val = nl.WALCL - (nl.TGA || 0) - (nl.RRPONTSYD || 0);
      if (dObj.getDay() === 4 || weeklyNetLiq.length === 0) {
        weeklyNetLiq.push({ date: day.date, netLiq: val });
      }
    }
  }
  for (let i = 8; i < weeklyNetLiq.length; i++) {
    const cur = weeklyNetLiq[i].netLiq;
    const past8 = weeklyNetLiq[i - 8].netLiq;
    const deltaPct = past8 !== 0 ? ((cur - past8) / Math.abs(past8)) * 100 : 0;
    netLiqDeltaMap.set(weeklyNetLiq[i].date, deltaPct);
  }

  let runningMarginMax = 0;
  const marginDebtDdMap = new Map();
  for (let i = 0; i < timeline.length; i++) {
    const md = timeline[i].macroGroups?.Leading?.MarginDebt;
    if (md) {
      if (md > runningMarginMax) runningMarginMax = md;
      const dd = ((md - runningMarginMax) / runningMarginMax) * 100;
      marginDebtDdMap.set(timeline[i].date, dd);
    }
  }

  // Filtere Zeitraum 2024-12-01 bis 2025-05-31
  const periodDays = allDates.filter(d => d >= '2024-12-01' && d <= '2025-05-31');

  // Peaks und Tiefs finden
  let spyPeak = 0, spyPeakDate = '';
  let qqqPeak = 0, qqqPeakDate = '';
  let gldPeak = 0, gldPeakDate = '';
  let spyLow = Infinity, spyLowDate = '';
  let qqqLow = Infinity, qqqLowDate = '';
  let gldLow = Infinity, gldLowDate = '';

  for (const d of periodDays) {
    const s = spyMap.get(d);
    const q = qqqMap.get(d);
    const g = gldMap.get(d)?.close;

    if (s > spyPeak) { spyPeak = s; spyPeakDate = d; }
    if (s < spyLow) { spyLow = s; spyLowDate = d; }

    if (q && q > qqqPeak) { qqqPeak = q; qqqPeakDate = d; }
    if (q && q < qqqLow) { qqqLow = q; qqqLowDate = d; }

    if (g > gldPeak) { gldPeak = g; gldPeakDate = d; }
    if (g < gldLow) { gldLow = g; gldLowDate = d; }
  }

  console.log(`Extreme im Zeitraum Dezember 2024 - Mai 2025:`);
  console.log(`  • SPY Peak: ${spyPeakDate} ($${spyPeak.toFixed(2)}) ➔ Tief: ${spyLowDate} ($${spyLow.toFixed(2)}) | Max DD: ${(((spyLow - spyPeak)/spyPeak)*100).toFixed(1)} %`);
  console.log(`  • QQQ Peak: ${qqqPeakDate} ($${qqqPeak.toFixed(2)}) ➔ Tief: ${qqqLowDate} ($${qqqLow.toFixed(2)}) | Max DD: ${(((qqqLow - qqqPeak)/qqqPeak)*100).toFixed(1)} %`);
  console.log(`  • GLD Peak: ${gldPeakDate} ($${gldPeak.toFixed(2)}) ➔ Tief: ${gldLowDate} ($${gldLow.toFixed(2)}) | Max DD: ${(((gldLow - gldPeak)/gldPeak)*100).toFixed(1)} %`);

  console.log(`\nTageschronologie und Indikatoren-Prüfung:`);
  console.log(`| Datum      | SPY Kurs | SPY DD%  | QQQ Kurs | QQQ DD%  | GLD Kurs | VIX   | SPY < SMA200? | Trigger Katastrophen-Matrix? |`);
  console.log(`|:-----------|:---------|:---------|:---------|:---------|:---------|:------|:--------------|:------------------------------|`);

  let lastNetLiq = 0, lastMarginDd = 0;
  for (const d of periodDays) {
    if (netLiqDeltaMap.has(d)) lastNetLiq = netLiqDeltaMap.get(d);
    if (marginDebtDdMap.has(d)) lastMarginDd = marginDebtDdMap.get(d);

    const s = spyMap.get(d);
    const q = qqqMap.get(d);
    const g = gldMap.get(d)?.close;
    const vix = vixMap.get(d);
    const s200 = spySma200.get(d);
    const tDay = timelineMap.get(d);
    const cfi = tDay?.macroGroups?.FinancialConditions?.ChicagoFedIndex ?? -0.5;

    const spyDD = ((s - spyPeak) / spyPeak) * 100;
    const qqqDD = qqqPeak ? ((q - qqqPeak) / qqqPeak) * 100 : 0;
    const belowSma200 = s200 ? s < s200 : false;
    const chartBreak = belowSma200 && spyDD <= -8.0;

    const reasons = [];
    if (vix >= 28.0) reasons.push(`VIX ${vix.toFixed(1)}`);
    if (cfi > -0.20) reasons.push(`CFI ${cfi.toFixed(2)}`);
    if (lastNetLiq < -5.0) reasons.push(`NetLiq ${lastNetLiq.toFixed(1)}%`);
    if (lastMarginDd <= -5.0) reasons.push(`MarginDd ${lastMarginDd.toFixed(1)}%`);

    const isTrigger = chartBreak && reasons.length > 0;

    // Nur markante Tage loggen (Montage, Extrema, Peaks, Tiefs, Trigger)
    const isSpecial = d === spyPeakDate || d === qqqPeakDate || d === spyLowDate || d === qqqLowDate || d === gldPeakDate || isTrigger || d.endsWith('-01') || d.endsWith('-15') || vix > 25 || spyDD < -5.0;

    if (isSpecial) {
      console.log(`| ${d} | $${s.toFixed(2).padEnd(6)} | ${spyDD.toFixed(1).padStart(5)} %  | $${q ? q.toFixed(2).padEnd(6) : '-'} | ${qqqDD.toFixed(1).padStart(5)} %  | $${g ? g.toFixed(2).padEnd(6) : '-'} | ${vix ? vix.toFixed(1).padStart(4) : '-'}  | ${belowSma200 ? 'JA (unter)' : 'nein'}       | ${isTrigger ? '🚨 TRIGGER: ' + reasons.join(', ') : '-'} |`);
    }
  }
}

checkDez2024Mai2025();
