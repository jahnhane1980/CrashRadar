import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const CACHE_DIR = path.resolve(__dirname, 'data_cache');
const SHARED_CACHE_DIR = path.resolve(__dirname, '../../architecture/strategies/cache');
const OUTPUT_FILE = path.join(CACHE_DIR, 'parsed_fundamentals_master.json');

const UNIVERSE = [
    { ticker: 'NOW', cik: '0001373715', category: 'MEGA_CAP', moat: 'SYSTEM_OF_RECORD' },
    { ticker: 'META', cik: '0001326801', category: 'MEGA_CAP', moat: 'PLATFORM_MONOPOLY' },
    { ticker: 'NFLX', cik: '0001065280', category: 'MEGA_CAP', moat: 'PLATFORM_MONOPOLY' },
    { ticker: 'AMZN', cik: '0001018724', category: 'MEGA_CAP', moat: 'PLATFORM_MONOPOLY' },
    { ticker: 'GOOGL', cik: '0001652044', category: 'MEGA_CAP', moat: 'PLATFORM_MONOPOLY' },
    { ticker: 'HIMS', cik: '0001773751', category: 'GROWTH', moat: 'DIRECT_TO_CONSUMER_TELEHEALTH' },
    { ticker: 'S', cik: '0001583708', category: 'GROWTH', moat: 'CYBERSECURITY_PLATFORM' },
    { ticker: 'IBRX', cik: '0001326110', category: 'GROWTH_BIOTECH', moat: 'IMMUNO_ONCOLOGY', founder_sponsor_backed: true },
    { ticker: 'NVTS', cik: '0001821769', category: 'GROWTH_SEMI', moat: 'POWER_SEMICONDUCTOR' },
    { ticker: 'SOFI', cik: '0001818874', category: 'FINTECH', moat: 'DIGITAL_BANK_LENDING' },
    { ticker: 'PLTR', cik: '0001321655', category: 'GROWTH', moat: 'ENTERPRISE_AI_OS' },
    { ticker: 'APP', cik: '0001751008', category: 'GROWTH', moat: 'ADTECH_AI_PLATFORM' },
    { ticker: 'HOOD', cik: '0001783879', category: 'FINTECH', moat: 'FINANCIAL_SUPERAPP' },
    { ticker: 'PTON', cik: '0001639825', category: 'FAILED_GROWTH', moat: 'CONNECTED_FITNESS_HYPED' },
    { ticker: 'TDOC', cik: '0001477449', category: 'FAILED_GROWTH', moat: 'TELEHEALTH_VIRTUAL_CARE' },
    { ticker: 'BYND', cik: '0001655210', category: 'FAILED_GROWTH', moat: 'PLANT_BASED_MEAT_HYPED' },
    { ticker: 'SPCE', cik: '0001706946', category: 'FAILED_GROWTH', moat: 'SPACE_TOURISM_SPAC' },
    { ticker: 'UPST', cik: '0001647639', category: 'FAILED_GROWTH', moat: 'AI_CONSUMER_LENDING' },
    { ticker: 'FSLY', cik: '0001517413', category: 'FAILED_GROWTH', moat: 'EDGE_CLOUD_CDN' },
    { ticker: 'NET', cik: '0001477333', category: 'GROWTH', moat: 'CLOUD_EDGE_SECURITY_INFRASTRUCTURE' }
];

async function fetchDailyPrices(symbol) {
    const localCache = path.join(CACHE_DIR, `${symbol}_daily.json`);
    if (fs.existsSync(localCache)) {
        return JSON.parse(fs.readFileSync(localCache, 'utf8'));
    }

    const sharedCache = path.join(SHARED_CACHE_DIR, `${symbol}_2014-10-01_2026-09-06.json`);
    if (fs.existsSync(sharedCache)) {
        const data = JSON.parse(fs.readFileSync(sharedCache, 'utf8'));
        fs.writeFileSync(localCache, JSON.stringify(data, null, 2));
        console.log(`[PRICES] ${symbol}: Shared-Cache genutzt (${data.length} Tage)`);
        return data;
    }

    console.log(`[PRICES FETCH] ${symbol}: Lade historische Kurse via Yahoo Finance...`);
    try {
        const queryOptions = { period1: '2015-01-01', period2: '2026-09-08' };
        const result = await yahooFinance.chart(symbol, queryOptions);
        const quotes = result.quotes || [];
        const formatted = quotes
            .filter(q => q.date && q.close !== null && q.volume !== null)
            .map(q => ({
                date: (typeof q.date === 'string' ? new Date(q.date) : q.date).toISOString().split('T')[0],
                open: q.open ?? q.close,
                high: q.high ?? q.close,
                low: q.low ?? q.close,
                close: q.close,
                volume: q.volume
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        fs.writeFileSync(localCache, JSON.stringify(formatted, null, 2));
        console.log(`[PRICES SAVED] ${symbol}: ${formatted.length} Tage gecacht`);
        return formatted;
    } catch (err) {
        console.error(`Fehler beim Kursabruf für ${symbol}:`, err.message);
        return [];
    }
}

async function fetchSecFacts(symbol, cik) {
    const cacheFile = path.join(CACHE_DIR, `${symbol}_sec_facts.json`);
    if (fs.existsSync(cacheFile)) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }

    console.log(`[SEC FETCH] ${symbol} (CIK ${cik})...`);
    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'CrashRadar Research research@crashradar.org',
                'Accept-Encoding': 'gzip, deflate'
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
        console.log(`[SEC SAVED] ${symbol}: ${(fs.statSync(cacheFile).size / 1024).toFixed(0)} KB`);
        await new Promise(r => setTimeout(r, 1200)); // SEC polite rate limit
        return data;
    } catch (err) {
        console.error(`Fehler bei SEC Facts für ${symbol}:`, err.message);
        return null;
    }
}

function extractMetricUnits(facts, tagNames) {
    const usGaap = facts?.facts?.['us-gaap'] || {};
    for (const tag of tagNames) {
        if (usGaap[tag]?.units) {
            const units = usGaap[tag].units;
            const key = Object.keys(units)[0];
            if (key && units[key]) {
                return units[key];
            }
        }
    }
    return [];
}

function parseFundamentalsForCompany(facts, company) {
    if (!facts) return [];

    const revUnits = extractMetricUnits(facts, [
        'RevenueFromContractWithCustomerExcludingAssessedTax',
        'SalesRevenueNet',
        'Revenues',
        'RevenueFromContractWithCustomerIncludingAssessedTax',
        'RegulatedAndUnregulatedOperatingRevenue'
    ]);

    const netUnits = extractMetricUnits(facts, ['NetIncomeLoss', 'ProfitLoss']);
    const grossUnits = extractMetricUnits(facts, ['GrossProfit']);
    const ocfUnits = extractMetricUnits(facts, ['NetCashProvidedByUsedInOperatingActivities']);
    const capexUnits = extractMetricUnits(facts, [
        'PaymentsToAcquirePropertyPlantAndEquipment',
        'PaymentsToAcquireProductiveAssets'
    ]);
    const cashUnits = extractMetricUnits(facts, [
        'CashAndCashEquivalentsAtCarryingValue',
        'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
        'Cash'
    ]);
    const secStUnits = extractMetricUnits(facts, [
        'MarketableSecuritiesCurrent',
        'AvailableForSaleSecuritiesCurrent',
        'ShortTermInvestments'
    ]);
    const debtLtUnits = extractMetricUnits(facts, [
        'LongTermDebtNoncurrent',
        'LongTermDebt',
        'ConvertibleDebtNoncurrent'
    ]);
    const debtStUnits = extractMetricUnits(facts, [
        'LongTermDebtCurrent',
        'DebtCurrent',
        'ShortTermBorrowings'
    ]);
    const defRevUnits = extractMetricUnits(facts, [
        'DeferredRevenueCurrent',
        'DeferredRevenue'
    ]);
    const sharesUnits = extractMetricUnits(facts, [
        'WeightedAverageNumberOfDilutedSharesOutstanding',
        'WeightedAverageNumberOfSharesOutstandingBasic'
    ]);

    // Filter to quarterly filings (10-Q) with valid filed dates
    const quarterlyRevs = revUnits
        .filter(u => (u.form === '10-Q' || u.form === '10-K' || u.form === '6-K') && u.filed && u.end)
        .sort((a, b) => a.end.localeCompare(b.end));

    // Deduplicate by quarter end date (take latest filed)
    const endMap = {};
    for (const r of quarterlyRevs) {
        // Calculate duration in days to identify ~3-month quarters vs full years
        let days = 90;
        if (r.start && r.end) {
            days = Math.round((new Date(r.end) - new Date(r.start)) / (1000 * 60 * 60 * 24));
        }
        if (days >= 70 && days <= 110) {
            endMap[r.end] = r;
        }
    }

    function findValueAtDate(units, endDate, isFlow = false) {
        if (!units || units.length === 0) return 0;
        const matching = units.filter(u => u.end === endDate);
        if (matching.length === 0) return 0;
        if (!isFlow) {
            return matching[matching.length - 1].val ?? 0;
        }
        // For flows, prefer 3-month durations
        for (const m of matching) {
            if (m.start) {
                const days = Math.round((new Date(m.end) - new Date(m.start)) / (1000 * 60 * 60 * 24));
                if (days >= 70 && days <= 110) return m.val ?? 0;
            }
        }
        return matching[matching.length - 1].val ?? 0;
    }

    const quarters = [];
    const sortedEnds = Object.keys(endMap).sort();

    for (let i = 0; i < sortedEnds.length; i++) {
        const endDate = sortedEnds[i];
        const revItem = endMap[endDate];
        const filedDate = revItem.filed;

        const rev = revItem.val || 0;
        const gross = findValueAtDate(grossUnits, endDate, true) || rev;
        const net = findValueAtDate(netUnits, endDate, true);
        const ocf = findValueAtDate(ocfUnits, endDate, true);
        const capex = findValueAtDate(capexUnits, endDate, true);
        const cash = findValueAtDate(cashUnits, endDate, false);
        const stSec = findValueAtDate(secStUnits, endDate, false);
        const totalCash = cash + stSec;
        const ltDebt = findValueAtDate(debtLtUnits, endDate, false);
        const stDebt = findValueAtDate(debtStUnits, endDate, false);
        const totalDebt = ltDebt + stDebt;
        const defRev = findValueAtDate(defRevUnits, endDate, false);
        const shares = findValueAtDate(sharesUnits, endDate, true);

        const fcf = ocf - capex;
        const fcfBurn = fcf < 0 ? Math.abs(fcf) : 0;
        const netCash = totalCash - totalDebt;

        // Runway calculation
        let runwayMonths = 999;
        if (fcf < 0) {
            runwayMonths = fcfBurn > 0 ? (netCash / fcfBurn) * 3 : 0;
        }

        const grossMarginPct = rev > 0 ? (gross / rev) * 100 : 0;

        quarters.push({
            ticker: company.ticker,
            period_end: endDate,
            filing_date: filedDate,
            revenue: rev,
            gross_profit: gross,
            gross_margin_pct: parseFloat(grossMarginPct.toFixed(1)),
            net_income: net,
            operating_cash_flow: ocf,
            capex: capex,
            fcf: fcf,
            fcf_burn: fcfBurn,
            total_cash: totalCash,
            total_debt: totalDebt,
            net_cash: netCash,
            runway_months: parseFloat(runwayMonths.toFixed(1)),
            deferred_revenue: defRev,
            diluted_shares: shares,
            founder_sponsor_backed: Boolean(company.founder_sponsor_backed)
        });
    }

    // Add QoQ / YoY Deltas and Deleveraging
    for (let i = 0; i < quarters.length; i++) {
        const q = quarters[i];
        if (i >= 1) {
            const prev = quarters[i - 1];
            q.deleveraging = q.total_debt <= prev.total_debt;
            q.debt_delta = q.total_debt - prev.total_debt;
            q.deferred_rev_growth_qoq = prev.deferred_revenue > 0 
                ? parseFloat((((q.deferred_revenue - prev.deferred_revenue) / prev.deferred_revenue) * 100).toFixed(1))
                : 0;
        } else {
            q.deleveraging = true;
            q.debt_delta = 0;
            q.deferred_rev_growth_qoq = 0;
        }

        if (i >= 4) {
            const yoyPrev = quarters[i - 4];
            q.yoy_rev_growth_pct = yoyPrev.revenue > 0
                ? parseFloat((((q.revenue - yoyPrev.revenue) / yoyPrev.revenue) * 100).toFixed(1))
                : null;
            q.dilution_yoy_pct = yoyPrev.diluted_shares > 0
                ? parseFloat((((q.diluted_shares - yoyPrev.diluted_shares) / yoyPrev.diluted_shares) * 100).toFixed(1))
                : 0;
        } else {
            q.yoy_rev_growth_pct = null;
            q.dilution_yoy_pct = 0;
        }
    }

    return quarters;
}

async function main() {
    console.log("================================================================================");
    console.log("   TURNAROUND RESEARCH DATASET BUILDER (13 UNIVERSE TICKERS)");
    console.log("================================================================================\n");

    const masterDataset = {};

    for (const item of UNIVERSE) {
        console.log(`\nProcessing ${item.ticker} (${item.category})...`);
        const prices = await fetchDailyPrices(item.ticker);
        const facts = await fetchSecFacts(item.ticker, item.cik);
        const parsedFinancials = parseFundamentalsForCompany(facts, item);

        masterDataset[item.ticker] = {
            profile: item,
            totalDays: prices.length,
            totalQuarters: parsedFinancials.length,
            financials: parsedFinancials
        };

        console.log(`  -> ${item.ticker}: ${prices.length} Kurstage, ${parsedFinancials.length} SEC-Quartale extrahiert.`);
        if (parsedFinancials.length > 0) {
            const latest = parsedFinancials[parsedFinancials.length - 1];
            console.log(`     Letztes Q: ${latest.period_end} (Filing: ${latest.filing_date}) | Cash: $${(latest.total_cash/1e6).toFixed(1)}M | Debt: $${(latest.total_debt/1e6).toFixed(1)}M | Runway: ${latest.runway_months}m | Deleveraging: ${latest.deleveraging}`);
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(masterDataset, null, 2));
    console.log("\n================================================================================");
    console.log(`[ERFOLG] Turnaround-Master-Datensatz gespeichert in:`);
    console.log(`  -> ${OUTPUT_FILE}`);
    console.log(`  -> Gecachte Ticker (${Object.keys(masterDataset).length}): ${Object.keys(masterDataset).join(', ')}`);
    console.log("================================================================================\n");
}

main().catch(console.error);
