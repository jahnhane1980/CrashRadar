import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

const secFactsPath = path.join(CACHE_DIR, 'SOUN_sec_facts.json');
const dailyPath = path.join(CACHE_DIR, 'SOUN_daily.json');

const secData = JSON.parse(fs.readFileSync(secFactsPath, 'utf8'));
const daily = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
const gaap = secData.facts['us-gaap'];

function extractDiscrete(factName) {
  const units = gaap[factName]?.units?.USD || [];
  const list = units.filter(x => x.start && x.end && ((new Date(x.end) - new Date(x.start)) / 86400000) >= 70 && ((new Date(x.end) - new Date(x.start)) / 86400000) <= 105);
  const map = new Map();
  for (const q of list) {
    const ex = map.get(q.end);
    if (!ex || (q.filed && q.filed > ex.filed)) map.set(q.end, q);
  }
  return Array.from(map.values()).sort((a,b) => a.end.localeCompare(b.end));
}

function extractInstant(factName, unitType = 'USD') {
  const units = gaap[factName]?.units?.[unitType] || [];
  const list = units.filter(x => !x.start && x.end);
  const map = new Map();
  for (const q of list) {
    const ex = map.get(q.end);
    if (!ex || (q.filed && q.filed > ex.filed)) map.set(q.end, q);
  }
  return Array.from(map.values()).sort((a,b) => a.end.localeCompare(b.end));
}

// 1. Revenue
const revs = extractDiscrete('RevenueFromContractWithCustomerIncludingAssessedTax');
// 2. Cost of Revenue
const costRevs = extractDiscrete('CostOfRevenue');
// 3. Net Income
const netIncomes = extractDiscrete('NetIncomeLoss');
// 4. Cash
const cashList = extractInstant('CashAndCashEquivalentsAtCarryingValue');
// 5. Shares
const sharesList = extractInstant('CommonStockSharesOutstanding', 'shares');

function getPrice(date) {
  const p = daily.find(x => x.date >= date);
  return p ? p.close : null;
}

console.log("=================================================================================================================================");
console.log("   SOUNDHOUND AI (SOUN): EMPIRISCHE FUNDAMENTAL- & VALUATION-STUDIE (2022 - 2026)");
console.log("=================================================================================================================================\n");

console.log("Quartalsende | Filed Date | Revenue ($M) | YoY Rev% | Gross Marg% | Net Loss ($M) | Cash ($M) | Shares Out (M) | Kurs ($)");
console.log("---------------------------------------------------------------------------------------------------------------------------------");

for (const r of revs) {
  const end = r.end;
  const cost = costRevs.find(x => x.end === end);
  const ni = netIncomes.find(x => x.end === end);
  const c = cashList.find(x => Math.abs(new Date(x.end) - new Date(end)) <= 15 * 86400000);
  const s = sharesList.find(x => Math.abs(new Date(x.end) - new Date(end)) <= 15 * 86400000);
  const price = getPrice(end);

  const prevYear = revs.find(p => {
    const diff = (new Date(end) - new Date(p.end)) / 86400000;
    return diff >= 340 && diff <= 380;
  });
  const yoy = prevYear ? (((r.val - prevYear.val) / prevYear.val) * 100).toFixed(1) + '%' : 'N/A';
  
  let gm = 'N/A';
  if (cost && r.val > 0) {
    const gp = r.val - cost.val;
    gm = ((gp / r.val) * 100).toFixed(1) + '%';
  }

  const revM = (r.val / 1e6).toFixed(2).padStart(12);
  const niM = ni ? (ni.val / 1e6).toFixed(2).padStart(13) : '          N/A';
  const cM = c ? ("$" + (c.val / 1e6).toFixed(1) + "M").padStart(9) : '      N/A';
  const sM = s ? ((s.val / 1e6).toFixed(1) + "M").padStart(14) : '           N/A';
  const pStr = price ? ("$" + price.toFixed(2)).padStart(8) : '     N/A';

  console.log(`${end}   | ${r.filed || '   N/A    '} | ${revM} | ${yoy.padStart(8)} | ${gm.padStart(11)} | ${niM} | ${cM} | ${sM} | ${pStr}`);
}

const latestPrice = daily[daily.length - 1];
console.log(`\nAktueller Börsenkurs: $${latestPrice.close.toFixed(2)} (${latestPrice.date})`);
