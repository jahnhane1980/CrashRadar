import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const symbols = ['PLTR', 'ZM', 'TDOC', 'NVDA', 'TSLA', 'ROKU', 'SHOP', 'COIN'];
const outDir = path.resolve(__dirname, '../architecture/strategies/cache/fundamentals');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

async function fetchAndCacheFundamentals() {
    const key = process.env.POLYGONIO_API_KEY;
    if (!key) {
        throw new Error("POLYGONIO_API_KEY nicht in .env gefunden!");
    }

    console.log("================================================================================");
    console.log("   CRASHRADAR FUNDAMENTALS CACHER (Polygon.io -> scratch/architecture/strategies)");
    console.log(`   Zielordner: ${outDir}`);
    console.log("================================================================================\n");

    const masterMap = {};

    for (const sym of symbols) {
        const fileTarget = path.join(outDir, `${sym}.json`);

        let results = [];
        if (fs.existsSync(fileTarget)) {
            console.log(`[CACHE HIT] Lade vorhandene Daten für ${sym}...`);
            results = JSON.parse(fs.readFileSync(fileTarget, 'utf8'));
        } else {
            console.log(`[API FETCH] Frage Polygon.io für ${sym} ab...`);
            const url = `https://api.polygon.io/vX/reference/financials?ticker=${sym}&timeframe=quarterly&limit=30&apiKey=${key}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!json.results || json.results.length === 0) {
                console.warn(`Keine Daten für ${sym} erhalten! Status:`, json.status);
                continue;
            }

            // Raw chronological sort
            const rawQuarters = json.results.reverse();

            const quarters = [];
            for (let i = 0; i < rawQuarters.length; i++) {
                const r = rawQuarters[i];
                const is = r.financials?.income_statement || {};
                const bs = r.financials?.balance_sheet || {};
                const cf = r.financials?.cash_flow_statement || {};

                const rev = is.revenues?.value ?? null;
                const net = is.net_income_loss?.value ?? null;
                const eps = is.basic_earnings_per_share?.value ?? null;
                const grossProfit = is.gross_profit?.value ?? null;
                const opCashFlow = cf.net_cash_flow_from_operating_activities?.value ?? null;

                quarters.push({
                    fiscal_period: `${r.fiscal_year}-${r.fiscal_period}`,
                    fiscal_year: parseInt(r.fiscal_year),
                    period: r.fiscal_period,
                    filing_date: r.filing_date || r.end_date || null,
                    period_end_date: r.end_date || null,
                    revenue: rev,
                    net_income: net,
                    eps: eps,
                    gross_profit: grossProfit,
                    operating_cash_flow: opCashFlow
                });
            }

            // YoY Revenue Growth calculation
            for (let i = 0; i < quarters.length; i++) {
                const q = quarters[i];
                // Search for the quarter 1 year prior (matching same period e.g. Q1 with Q1 of prior year)
                const priorYearQuarter = quarters.find(
                    prev => prev.fiscal_year === q.fiscal_year - 1 && prev.period === q.period
                ) || (i >= 4 ? quarters[i - 4] : null);

                if (priorYearQuarter && priorYearQuarter.revenue && q.revenue) {
                    const diff = q.revenue - priorYearQuarter.revenue;
                    q.yoy_revenue_growth_pct = parseFloat(((diff / priorYearQuarter.revenue) * 100).toFixed(2));
                    q.prior_year_revenue = priorYearQuarter.revenue;
                } else {
                    q.yoy_revenue_growth_pct = null;
                    q.prior_year_revenue = null;
                }
            }

            results = quarters;
            fs.writeFileSync(fileTarget, JSON.stringify(results, null, 2));
            console.log(`[SAVED] ${results.length} Quartale für ${sym} -> ${fileTarget}`);

            // Rate-limit grace pause for Polygon free tier (5 req/min -> 12.5s)
            await new Promise(res => setTimeout(res, 12500));
        }

        masterMap[sym] = results;
    }

    // Save unified master file in scratch/architecture/strategies/fundamentals_master.json
    const masterPath = path.resolve(__dirname, '../architecture/strategies/fundamentals_master.json');
    fs.writeFileSync(masterPath, JSON.stringify(masterMap, null, 2));
    console.log(`\n================================================================================`);
    console.log(`[ERFOLG] Master-Fundamentaldaten gespeichert in:`);
    console.log(`  -> ${masterPath}`);
    console.log(`  -> Enthält: ${Object.keys(masterMap).join(', ')}`);
    console.log(`================================================================================\n`);
}

fetchAndCacheFundamentals().catch(console.error);
