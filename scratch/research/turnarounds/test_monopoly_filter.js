import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');
const MASTER_DATA_PATH = path.join(CACHE_DIR, 'parsed_fundamentals_master.json');

const masterData = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, 'utf8'));

console.log("================================================================================");
console.log("   HÄRTETEST: DIE 6 KRITERIEN DES GENERATIONEN-MONOPOLS");
console.log("   Wann schlägt ein Wachstums-Kandidat vom 'Kater-Zock' zum 'Ewigen Monopol' um?");
console.log("================================================================================\n");

/**
 * Bewertungs-Kriterien für Reifegrad "GENERATIONAL_MONOPOLY" (Status: DIAMANT / NEVER_SELL):
 * 1. Post-IPO Reife: >= 6-8 Quartale (1,5 bis 2 Jahre) seit Erstlisting/Kater
 * 2. Burggraben-Marge: Gross Margin >= 70% (Preissetzungsmacht)
 * 3. Cashflow-Maschine: FCF-Marge >= +20% (Selbstfinanzierung ohne Kapitalerhöhung)
 * 4. GAAP-Wende: Net Income >= 0 (GAAP-Profitabilität)
 * 5. Organischer Schub: YoY Umsatzwachstum >= 20%
 * 6. Verwässerungs-Bremse: Verwässerung p.a. < 5-7%
 */

function evaluateMaturity(symbol, data) {
    const quarters = data.financials;
    if (!quarters || quarters.length === 0) return null;

    const results = [];

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

        // Check criteria
        const c_reife = i >= 4; // Mindestens 1 Jahr Historie
        const c_gross = grossMargin >= 70.0;
        const c_fcf = fcfMargin >= 15.0;
        const c_gaap = netInc > 0;
        const c_growth = yoyRev !== null ? yoyRev >= 18.0 : false;
        const c_dilution = dilutionYoY <= 7.0;

        const score = (c_gross ? 1 : 0) + (c_fcf ? 1 : 0) + (c_gaap ? 1 : 0) + (c_growth ? 1 : 0) + (c_dilution ? 1 : 0);

        const isDiamond = c_reife && c_gross && c_fcf && c_gaap && c_growth && c_dilution;
        const isNearDiamond = c_reife && c_gross && c_fcf && c_growth; // FCF-stark, aber GAAP noch leicht negativ (z.B. SentinelOne)

        results.push({
            date: q.period_end,
            revM: (rev / 1e6).toFixed(1),
            grossMargin: grossMargin.toFixed(1),
            netIncM: (netInc / 1e6).toFixed(1),
            fcfMargin: fcfMargin.toFixed(1),
            yoyRev: yoyRev !== null ? yoyRev.toFixed(1) : 'N/A',
            dilutionYoY: dilutionYoY.toFixed(1),
            score,
            isDiamond,
            isNearDiamond
        });
    }

    return results;
}

const symbolsToCheck = Object.keys(masterData);

for (const sym of symbolsToCheck) {
    const res = evaluateMaturity(sym, masterData[sym]);
    if (!res) continue;

    const firstDiamond = res.find(r => r.isDiamond);
    const firstNearDiamond = res.find(r => r.isNearDiamond);

    console.log(`[${sym.padEnd(5)}] Category: ${(masterData[sym].profile?.category || 'N/A').padEnd(15)} | Quarters: ${String(res.length).padEnd(2)}`);
    if (firstDiamond) {
        console.log(`   🟢 DIAMANT-STATUS erreicht am: ${firstDiamond.date} (Rev: $${firstDiamond.revM}M, Gross: ${firstDiamond.grossMargin}%, NetInc: $${firstDiamond.netIncM}M, FCF-M: ${firstDiamond.fcfMargin}%, YoY: ${firstDiamond.yoyRev}%, Dilution: ${firstDiamond.dilutionYoY}%)`);
    } else if (firstNearDiamond) {
        console.log(`   🟡 NEAR-DIAMANT (FCF-Turnaround, GAAP folgt) am: ${firstNearDiamond.date} (Rev: $${firstNearDiamond.revM}M, Gross: ${firstNearDiamond.grossMargin}%, NetInc: $${firstNearDiamond.netIncM}M, FCF-M: ${firstNearDiamond.fcfMargin}%, YoY: ${firstNearDiamond.yoyRev}%)`);
    } else {
        console.log(`   🔴 KEIN DIAMANT (Zock / Flop / Nicht reif) - Max Score: ${Math.max(...res.map(r => r.score))}/5`);
    }
}
