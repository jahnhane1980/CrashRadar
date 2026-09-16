import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(REPO_ROOT, 'data/cache/turnarounds');
const MASTER_DATA_PATH = path.join(CACHE_DIR, 'parsed_fundamentals_master.json');

const masterData = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, 'utf8'));

console.log("================================================================================");
console.log("   STRENGER TEST: 3 QUARTALE IN FOLGE (NACHHALTIGER MONOPOL-BEWEIS)");
console.log("   Eliminierung von Einmal-Eintagsfliegen (wie UPST / TDOC Bubble-Spikes)");
console.log("================================================================================\n");

function evaluateStrictMaturity(symbol, data) {
    const quarters = data.financials;
    if (!quarters || quarters.length === 0) return null;

    let consecutiveDiamond = 0;
    let confirmedDate = null;
    let confirmedStats = null;

    for (let i = 0; i < quarters.length; i++) {
        const q = quarters[i];
        const prevQ4 = i >= 4 ? quarters[i - 4] : null;

        const rev = q.revenue;
        const grossMargin = q.gross_margin_pct || 0;
        const netInc = q.net_income;
        const fcf = q.fcf;
        const fcfMargin = rev > 0 ? (fcf / rev) * 100 : 0;
        const yoyRev = q.yoy_rev_growth_pct;

        let dilutionYoY = 0;
        if (prevQ4 && prevQ4.diluted_shares > 0 && q.diluted_shares > 0) {
            dilutionYoY = ((q.diluted_shares - prevQ4.diluted_shares) / prevQ4.diluted_shares) * 100;
        }

        const c_reife = i >= 4;
        const c_gross = grossMargin >= 70.0;
        const c_fcf = fcfMargin >= 15.0;
        const c_gaap = netInc > 0;
        const c_growth = yoyRev !== null ? yoyRev >= 18.0 : false;
        const c_dilution = dilutionYoY <= 7.0;

        const isDiamond = c_reife && c_gross && c_fcf && c_gaap && c_growth && c_dilution;

        if (isDiamond) {
            consecutiveDiamond++;
            if (consecutiveDiamond >= 3 && !confirmedDate) {
                confirmedDate = q.period_end;
                confirmedStats = {
                    revM: (rev / 1e6).toFixed(1),
                    grossMargin: grossMargin.toFixed(1),
                    netIncM: (netInc / 1e6).toFixed(1),
                    fcfMargin: fcfMargin.toFixed(1),
                    yoyRev: yoyRev !== null ? yoyRev.toFixed(1) : 'N/A'
                };
            }
        } else {
            consecutiveDiamond = 0; // Reset if broken
        }
    }

    return { confirmedDate, confirmedStats };
}

for (const sym of Object.keys(masterData)) {
    const res = evaluateStrictMaturity(sym, masterData[sym]);
    if (!res) continue;

    if (res.confirmedDate) {
        console.log(`🏆 [${sym.padEnd(5)}] CONFIRMED GENERATIONAL MONOPOLY am: ${res.confirmedDate} (Rev: $${res.confirmedStats.revM}M, Gross: ${res.confirmedStats.grossMargin}%, NetInc: $${res.confirmedStats.netIncM}M, FCF-M: ${res.confirmedStats.fcfMargin}%, YoY: ${res.confirmedStats.yoyRev}%)`);
    } else {
        console.log(`❌ [${sym.padEnd(5)}] Keine 3 aufeinanderfolgenden Monopol-Quartale`);
    }
}
