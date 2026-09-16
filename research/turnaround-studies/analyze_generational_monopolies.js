import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(REPO_ROOT, 'data/cache/turnarounds');
const MASTER_DATA_PATH = path.join(CACHE_DIR, 'parsed_fundamentals_master.json');

const masterData = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, 'utf8'));

const testSymbols = ['PLTR', 'NOW', 'AMZN', 'GOOGL', 'S', 'SOFI', 'FSLY', 'TDOC', 'PTON'];

console.log("================================================================================");
console.log("   EMPIRISCHE ANALYSE: GENERATIONEN-MONOPOLE VS. FLOP-KATER");
console.log("   Suche nach dem fundamentalen Wendepunkt (Inflection Point)");
console.log("================================================================================\n");

for (const sym of testSymbols) {
    const data = masterData[sym];
    if (!data || !data.financials || data.financials.length === 0) {
        console.log(`[${sym}] Keine Fundamentaldaten gefunden.`);
        continue;
    }

    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`TICKER: ${sym} (${data.profile?.category || 'N/A'} - Moat: ${data.profile?.moat || 'N/A'})`);
    console.log(`Total Quarters: ${data.financials.length}`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Period End | Rev ($M) | Gross% | NetInc ($M) | OCF ($M) | FCF ($M) | Shares (M) | Rule40`);

    for (const q of data.financials) {
        const revM = (q.revenue / 1e6).toFixed(1);
        const grossPct = q.gross_margin_pct ? q.gross_margin_pct.toFixed(1) + '%' : 'N/A';
        const netIncM = (q.net_income / 1e6).toFixed(1);
        const ocfM = (q.operating_cash_flow / 1e6).toFixed(1);
        const fcfM = (q.fcf / 1e6).toFixed(1);
        const sharesM = q.diluted_shares ? (q.diluted_shares / 1e6).toFixed(1) : 'N/A';
        
        let rule40 = 'N/A';
        if (q.yoy_rev_growth_pct !== null && q.revenue > 0) {
            const fcfMargin = (q.fcf / q.revenue) * 100;
            rule40 = (q.yoy_rev_growth_pct + fcfMargin).toFixed(1);
        }

        console.log(`${q.period_end} | ${revM.padStart(8)} | ${grossPct.padStart(6)} | ${netIncM.padStart(11)} | ${ocfM.padStart(8)} | ${fcfM.padStart(8)} | ${sharesM.padStart(10)} | ${rule40.padStart(6)}`);
    }
}
