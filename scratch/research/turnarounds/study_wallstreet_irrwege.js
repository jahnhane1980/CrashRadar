import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');
const MASTER_DATA = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'parsed_fundamentals_master.json'), 'utf8'));

console.log("================================================================================");
console.log("   IRRWEG DER WALL STREET VS. REALE UNTERNEHMENS-KERN-DATEN WÄHREND DES CRASHS");
console.log("================================================================================\n");

// 1. META during 2022 crash ($384 -> $88)
const metaQuotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'META_daily.json'), 'utf8'));
const metaFin = MASTER_DATA['META'].financials.filter(q => q.period_end >= '2021-09-30' && q.period_end <= '2023-03-31');

console.log("--------------------------------------------------------------------------------");
console.log("FALLSTUDIE 1: META (Crash 2022 von $384 auf $88 = -77%)");
console.log("Period End | Rev ($B) | YoY Rev% | Gross% | NetInc ($B) | FCF ($B) | Cash ($B) | Debt ($B)");
for (const q of metaFin) {
    console.log(`${q.period_end} | ${(q.revenue/1e9).toFixed(2).padStart(8)} | ${q.yoy_rev_growth_pct ? q.yoy_rev_growth_pct.toFixed(1) + '%' : 'N/A'} | ${q.gross_margin_pct?.toFixed(1) + '%'} | ${(q.net_income/1e9).toFixed(2).padStart(11)} | ${(q.fcf/1e9).toFixed(2).padStart(8)} | ${(q.total_cash/1e9).toFixed(2).padStart(9)} | ${(q.total_debt/1e9).toFixed(2).padStart(8)}`);
}

// 2. NOW during 2025/2026 crash ($234 -> $83 = -64.5%)
const nowFin = MASTER_DATA['NOW'].financials.filter(q => q.period_end >= '2024-09-30');
console.log("\n--------------------------------------------------------------------------------");
console.log("FALLSTUDIE 2: SERVICENOW (Crash 2025/2026 von $234 auf $83 = -64.5%)");
console.log("Period End | Rev ($M) | YoY Rev% | Gross% | NetInc ($M) | FCF ($M) | Cash ($M) | Debt ($M)");
for (const q of nowFin) {
    console.log(`${q.period_end} | ${(q.revenue/1e6).toFixed(1).padStart(8)} | ${q.yoy_rev_growth_pct ? q.yoy_rev_growth_pct.toFixed(1) + '%' : 'N/A'} | ${q.gross_margin_pct?.toFixed(1) + '%'} | ${(q.net_income/1e6).toFixed(1).padStart(11)} | ${(q.fcf/1e6).toFixed(1).padStart(8)} | ${(q.total_cash/1e6).toFixed(1).padStart(9)} | ${(q.total_debt/1e6).toFixed(1).padStart(8)}`);
}

// 3. NFLX during 2022 crash ($700 -> $162 = -76.8%)
const nflxFin = MASTER_DATA['NFLX'].financials.filter(q => q.period_end >= '2021-09-30' && q.period_end <= '2023-03-31');
console.log("\n--------------------------------------------------------------------------------");
console.log("FALLSTUDIE 3: NETFLIX (Crash 2021/2022 von $700 auf $162 = -76.8%)");
console.log("Period End | Rev ($M) | YoY Rev% | Gross% | NetInc ($M) | FCF ($M) | Cash ($M) | Debt ($M)");
for (const q of nflxFin) {
    console.log(`${q.period_end} | ${(q.revenue/1e6).toFixed(1).padStart(8)} | ${q.yoy_rev_growth_pct ? q.yoy_rev_growth_pct.toFixed(1) + '%' : 'N/A'} | ${q.gross_margin_pct?.toFixed(1) + '%'} | ${(q.net_income/1e6).toFixed(1).padStart(11)} | ${(q.fcf/1e6).toFixed(1).padStart(8)} | ${(q.total_cash/1e6).toFixed(1).padStart(9)} | ${(q.total_debt/1e6).toFixed(1).padStart(8)}`);
}
