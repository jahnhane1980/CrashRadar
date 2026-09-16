import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');
const STRAT_CACHE = path.resolve(__dirname, '../../data/cache/strategies');

const sofiDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'SOFI_daily.json'), 'utf8'));
const spyDaily = JSON.parse(fs.readFileSync(path.join(STRAT_CACHE, 'SPY_2014-10-01_2026-09-06.json'), 'utf8'));

// Format spyDaily: could have 'date' and 'close'
const spyRows = spyDaily.map(x => ({
  date: typeof x.date === 'string' ? x.date.split('T')[0] : new Date(x.date).toISOString().split('T')[0],
  close: x.close || x.adjClose
}));

const spyMap = new Map(spyRows.map(x => [x.date, x.close]));

// Calculate daily returns for both
const merged = [];

for (let i = 1; i < sofiDaily.length; i++) {
  const prev = sofiDaily[i - 1];
  const curr = sofiDaily[i];
  const prevDate = curr.date;
  const spyPrev = spyMap.get(prev.date);
  const spyCurr = spyMap.get(curr.date);
  if (spyPrev && spyCurr && prev.close > 0 && spyPrev > 0) {
    const sofiRet = (curr.close - prev.close) / prev.close;
    const spyRet = (spyCurr - spyPrev) / spyPrev;
    merged.push({ date: curr.date, sofiRet, spyRet, sofiClose: curr.close, spyClose: spyCurr });
  }
}

// Calculate Beta over last 1 year and full sample
function calcBeta(data) {
  const n = data.length;
  const meanSofi = data.reduce((a, b) => a + b.sofiRet, 0) / n;
  const meanSpy = data.reduce((a, b) => a + b.spyRet, 0) / n;
  
  let cov = 0;
  let varSpy = 0;
  for (const d of data) {
    cov += (d.sofiRet - meanSofi) * (d.spyRet - meanSpy);
    varSpy += Math.pow(d.spyRet - meanSpy, 2);
  }
  return cov / varSpy;
}

const last252 = merged.slice(-252);
const beta1Y = calcBeta(last252);
const betaAll = calcBeta(merged);

console.log("=========================================================================================");
console.log("   SOFI TECHNOLOGIES: EMPIRISCHE BETA- & DRAWDOWN-SIMULATION (SPY KASKADE)");
console.log("=========================================================================================\n");

console.log(`Datenpunkte: ${merged.length} Tage`);
console.log(`Historisches Gesamt-Beta SOFI vs. SPY: ${betaAll.toFixed(2)}`);
console.log(`1-Jahres-Beta SOFI vs. SPY:             ${beta1Y.toFixed(2)}`);

const latestSofi = sofiDaily[sofiDaily.length - 1];
console.log(`\nAktueller SOFI-Kurs: $${latestSofi.close.toFixed(2)} (${latestSofi.date})`);

console.log("\n--- SIMULATION: SPY-KASKADE WENN NVIDIA TOPPT & SICH HALBIERT ---");
console.log("NVDA Gewicht im SPY: ca. 7.1%, im QQQ: ca. 8.6%");
console.log("NVDA Halving (-50%) -> SPY direkter Impuls: ca. -3.6% (QQQ: -4.3%)");
console.log("Mit Kaskaden (CTA-De-Grossing, Risk-Parity, Vol-Targeting): SPY Drawdown -8% bis -15%\n");

const scenarios = [
  { spyDrop: -0.05, desc: "Leichte Tech-Korrektur (-5% SPY)" },
  { spyDrop: -0.08, desc: "Moderat-Kaskadischer Selloff (-8% SPY)" },
  { spyDrop: -0.10, desc: "Klassische Markt-Korrektur (-10% SPY)" },
  { spyDrop: -0.12, desc: "Schwere NVDA-induzierte Kaskade (-12% SPY)" },
  { spyDrop: -0.15, desc: "Tiefer Q4-Liquiditätssturm (-15% SPY)" }
];

console.log("Szenario                                | SPY Drop | SOFI Drop (Beta 2.2x) | SOFI Kurs ($)");
console.log("-----------------------------------------------------------------------------------------");
for (const s of scenarios) {
  const sofiDrop = s.spyDrop * beta1Y;
  const targetPrice = latestSofi.close * (1 + sofiDrop);
  console.log(`${s.desc.padEnd(39)} | ${(s.spyDrop*100).toFixed(1).padStart(7)}% | ${(sofiDrop*100).toFixed(1).padStart(20)}% | $${targetPrice.toFixed(2).padStart(7)}`);
}
