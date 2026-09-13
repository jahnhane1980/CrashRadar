import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, '../../architecture/strategies/cache');

function loadJson(ticker) {
  const p = path.join(CACHE_DIR, `${ticker}_2014-10-01_2026-09-06.json`);
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return raw.map(x => ({
    date: typeof x.date === 'string' ? x.date.split('T')[0] : new Date(x.date).toISOString().split('T')[0],
    close: x.close || x.adjClose
  })).sort((a,b) => a.date.localeCompare(b.date));
}

const smh = loadJson('SMH');
const spy = loadJson('SPY');
const qqq = loadJson('QQQ');
const nvda = loadJson('NVDA');

// Analyze 2018 drawdown (approx 2018-09-01 to 2018-12-31)
// Analyze 2021-2022 drawdown (approx 2021-11-01 to 2022-10-31)
// Analyze current 2024-2026 pullbacks

function calcDrawdown(series, startDate, endDate) {
  const slice = series.filter(x => x.date >= startDate && x.date <= endDate);
  if (slice.length === 0) return { maxDrop: 0, peak: null, trough: null };
  let peak = slice[0].close;
  let peakDate = slice[0].date;
  let maxDrop = 0;
  let trough = slice[0].close;
  let troughDate = slice[0].date;

  for (const s of slice) {
    if (s.close > peak) {
      peak = s.close;
      peakDate = s.date;
    }
    const dd = (s.close - peak) / peak;
    if (dd < maxDrop) {
      maxDrop = dd;
      trough = s.close;
      troughDate = s.date;
    }
  }
  return { maxDrop: maxDrop * 100, peak, peakDate, trough, troughDate };
}

console.log("=========================================================================================");
console.log("   EMPIRISCHE ANALYSE: HALBLEITER- & HARDWARE-CYCLES VS. GESAMTMARKT (SPY / QQQ)");
console.log("=========================================================================================\n");

console.log("--- 1. DER HARDWARE- & CHIP-KATER 2018 (Krypto-Mining-Stop, CapEx-Pause, Fed-Zinsen) ---");
const dd2018_nvda = calcDrawdown(nvda, '2018-08-01', '2018-12-31');
const dd2018_smh  = calcDrawdown(smh,  '2018-03-01', '2018-12-31');
const dd2018_qqq  = calcDrawdown(qqq,  '2018-08-01', '2018-12-31');
const dd2018_spy  = calcDrawdown(spy,  '2018-08-01', '2018-12-31');

console.log(`NVDA: ${dd2018_nvda.maxDrop.toFixed(1)}% (Peak: $${dd2018_nvda.peak.toFixed(2)} am ${dd2018_nvda.peakDate} -> Trough: $${dd2018_nvda.trough.toFixed(2)} am ${dd2018_nvda.troughDate})`);
console.log(`SMH : ${dd2018_smh.maxDrop.toFixed(1)}% (Peak: $${dd2018_smh.peak.toFixed(2)} am ${dd2018_smh.peakDate} -> Trough: $${dd2018_smh.trough.toFixed(2)} am ${dd2018_smh.troughDate})`);
console.log(`QQQ : ${dd2018_qqq.maxDrop.toFixed(1)}% (Peak: $${dd2018_qqq.peak.toFixed(2)} am ${dd2018_qqq.peakDate} -> Trough: $${dd2018_qqq.trough.toFixed(2)} am ${dd2018_qqq.troughDate})`);
console.log(`SPY : ${dd2018_spy.maxDrop.toFixed(1)}% (Peak: $${dd2018_spy.peak.toFixed(2)} am ${dd2018_spy.peakDate} -> Trough: $${dd2018_spy.trough.toFixed(2)} am ${dd2018_spy.troughDate})`);

console.log("\n--- 2. DER GROSSE HARDWARE- & HALBLEITER-CRASH 2021-2022 (PC/Cloud Overhang, Zinswende) ---");
const dd2022_nvda = calcDrawdown(nvda, '2021-10-01', '2022-11-30');
const dd2022_smh  = calcDrawdown(smh,  '2021-11-01', '2022-11-30');
const dd2022_qqq  = calcDrawdown(qqq,  '2021-11-01', '2022-12-31');
const dd2022_spy  = calcDrawdown(spy,  '2021-11-01', '2022-10-31');

console.log(`NVDA: ${dd2022_nvda.maxDrop.toFixed(1)}% (Peak: $${dd2022_nvda.peak.toFixed(2)} am ${dd2022_nvda.peakDate} -> Trough: $${dd2022_nvda.trough.toFixed(2)} am ${dd2022_nvda.troughDate})`);
console.log(`SMH : ${dd2022_smh.maxDrop.toFixed(1)}% (Peak: $${dd2022_smh.peak.toFixed(2)} am ${dd2022_smh.peakDate} -> Trough: $${dd2022_smh.trough.toFixed(2)} am ${dd2022_smh.troughDate})`);
console.log(`QQQ : ${dd2022_qqq.maxDrop.toFixed(1)}% (Peak: $${dd2022_qqq.peak.toFixed(2)} am ${dd2022_qqq.peakDate} -> Trough: $${dd2022_qqq.trough.toFixed(2)} am ${dd2022_qqq.troughDate})`);
console.log(`SPY : ${dd2022_spy.maxDrop.toFixed(1)}% (Peak: $${dd2022_spy.peak.toFixed(2)} am ${dd2022_spy.peakDate} -> Trough: $${dd2022_spy.trough.toFixed(2)} am ${dd2022_spy.troughDate})`);

