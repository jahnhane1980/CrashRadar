import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const CACHE_DIR = path.resolve(__dirname, 'data_cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// --- Helper: Fetch Daily Prices via Yahoo Finance ---
async function getDailyQuotes(symbol, startDate = '2016-01-01', endDate = '2026-09-10') {
    const file = path.join(CACHE_DIR, `${symbol}_daily.json`);
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    console.log(`[PRICES] Lade ${symbol} von Yahoo Finance...`);
    try {
        const res = await yahooFinance.chart(symbol, { period1: startDate, period2: endDate });
        const quotes = (res.quotes || [])
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
        fs.writeFileSync(file, JSON.stringify(quotes, null, 2));
        console.log(`[PRICES] ${symbol}: ${quotes.length} Tage gecacht.`);
        return quotes;
    } catch (e) {
        console.error(`Fehler bei Kursen für ${symbol}:`, e.message);
        return [];
    }
}

// --- Helper: Fetch SEC Company Facts ---
async function getSecFacts(symbol, cik) {
    const file = path.join(CACHE_DIR, `${symbol}_sec_facts.json`);
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    console.log(`[SEC] Lade ${symbol} (CIK ${cik}) von SEC EDGAR...`);
    try {
        const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
            headers: {
                'User-Agent': 'CrashRadar Research research@crashradar.org',
                'Accept-Encoding': 'gzip, deflate'
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        console.log(`[SEC] ${symbol}: Saved ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
        await new Promise(r => setTimeout(r, 1200));
        return data;
    } catch (e) {
        console.error(`Fehler bei SEC Facts für ${symbol}:`, e.message);
        return null;
    }
}

// --- Helper: Extract CapEx (Payments to Acquire Property, Plant and Equipment) ---
function extractQuarterlyCapEx(facts) {
    const usGaap = facts?.facts?.['us-gaap'] || {};
    const tags = [
        'PaymentsToAcquirePropertyPlantAndEquipment',
        'PaymentsToAcquireProductiveAssets',
        'PaymentsToAcquireProductiveAssetsAndIntangibleAssetsExcludingGoodwill'
    ];
    let units = null;
    for (const tag of tags) {
        if (usGaap[tag]?.units?.USD) {
            units = usGaap[tag].units.USD;
            break;
        }
    }
    if (!units) return [];

    // Filter 10-Q filings and calculate quarterly discrete values
    // In US-GAAP Cash Flow Statements, Q1 is 3M, Q2 is 6M (cumulative), Q3 is 9M, 10-K is 12M.
    // Or sometimes discrete form 10-Q entries exist.
    const filings = units
        .filter(u => (u.form === '10-Q' || u.form === '10-K') && u.frame || (u.start && u.end))
        .map(u => ({
            end: u.end,
            start: u.start,
            val: u.val,
            fy: u.fy,
            fp: u.fp,
            form: u.form,
            frame: u.frame
        }));

    // Find discrete quarterly entries or compute diff
    const quarterly = new Map();

    // Pass 1: exact frames like CY2023Q1 or 3-month periods (~80-100 days)
    for (const f of filings) {
        if (!f.start || !f.end) continue;
        const days = (new Date(f.end) - new Date(f.start)) / (1000 * 60 * 60 * 24);
        if (days >= 75 && days <= 110) {
            quarterly.set(f.end, { end: f.end, capex: f.val, fy: f.fy, fp: f.fp, form: f.form });
        }
    }

    // Sort by date
    const sorted = Array.from(quarterly.values()).sort((a, b) => a.end.localeCompare(b.end));
    return sorted;
}

// --- Helper: Extract NVIDIA Revenue & Gross Margin ---
function extractNvdaQuarterly(facts) {
    const usGaap = facts?.facts?.['us-gaap'] || {};
    const revUnits = usGaap['RevenueFromContractWithCustomerExcludingAssessedTax']?.units?.USD ||
                     usGaap['SalesRevenueNet']?.units?.USD || [];
    const grossUnits = usGaap['GrossProfit']?.units?.USD || [];

    const quarterly = new Map();

    for (const r of revUnits) {
        if (!r.start || !r.end) continue;
        const days = (new Date(r.end) - new Date(r.start)) / (1000 * 60 * 60 * 24);
        if (days >= 75 && days <= 110 && (r.form === '10-Q' || r.form === '10-K')) {
            const existing = quarterly.get(r.end) || { end: r.end, fy: r.fy, fp: r.fp };
            existing.revenue = r.val;
            quarterly.set(r.end, existing);
        }
    }

    for (const g of grossUnits) {
        if (!g.start || !g.end) continue;
        const days = (new Date(g.end) - new Date(g.start)) / (1000 * 60 * 60 * 24);
        if (days >= 75 && days <= 110 && (g.form === '10-Q' || g.form === '10-K')) {
            const existing = quarterly.get(g.end) || { end: g.end, fy: g.fy, fp: g.fp };
            existing.grossProfit = g.val;
            quarterly.set(g.end, existing);
        }
    }

    return Array.from(quarterly.values())
        .filter(q => q.revenue)
        .map(q => ({
            ...q,
            grossMarginPct: q.grossProfit ? ((q.grossProfit / q.revenue) * 100) : null
        }))
        .sort((a, b) => a.end.localeCompare(b.end));
}

async function run() {
    console.log("================================================================================");
    console.log("   EMPIRISCHE UNTERSUCHUNG: HYPERSCALER CAPEX vs. SEMIS vs. SOFTWARE (2018-2026)");
    console.log("================================================================================\n");

    // 1. Fetch SEC facts for Big Tech Hyperscalers
    const msftFacts = await getSecFacts('MSFT', '0000789019');
    const googlFacts = await getSecFacts('GOOGL', '0001652044');
    const metaFacts = await getSecFacts('META', '0001326801');
    const amznFacts = await getSecFacts('AMZN', '0001018724');
    const nvdaFacts = await getSecFacts('NVDA', '0001045810');

    // 2. Fetch Prices
    const nvdaQuotes = await getDailyQuotes('NVDA');
    const amdQuotes = await getDailyQuotes('AMD');
    const smhQuotes = await getDailyQuotes('SMH');
    const igvQuotes = await getDailyQuotes('IGV');
    const nowQuotes = await getDailyQuotes('NOW');
    const crmQuotes = await getDailyQuotes('CRM');
    const msftQuotes = await getDailyQuotes('MSFT');

    // 3. Extract Hyperscaler CapEx
    const msftCapEx = extractQuarterlyCapEx(msftFacts);
    const googlCapEx = extractQuarterlyCapEx(googlFacts);
    const metaCapEx = extractQuarterlyCapEx(metaFacts);
    const amznCapEx = extractQuarterlyCapEx(amznFacts);
    const nvdaFin = extractNvdaQuarterly(nvdaFacts);

    console.log(`Extrahierte Quartale CapEx: MSFT: ${msftCapEx.length}, GOOGL: ${googlCapEx.length}, META: ${metaCapEx.length}, AMZN: ${amznCapEx.length}`);
    console.log(`Extrahierte Quartale NVDA Financials: ${nvdaFin.length}`);

    // Print Hyperscaler CapEx Trajectory (Recent years: 2021 - 2026)
    console.log("\n--------------------------------------------------------------------------------");
    console.log("1. HYPERSCALER CAPEX VERLAUF (MSFT, GOOGL, META, AMZN) IN MILLIARDEN USD ($B)");
    console.log("--------------------------------------------------------------------------------");
    
    // Group by Year-Quarter
    const allDates = Array.from(new Set([
        ...msftCapEx.map(c => c.end),
        ...googlCapEx.map(c => c.end),
        ...metaCapEx.map(c => c.end),
        ...amznCapEx.map(c => c.end)
    ])).sort();

    // Map each date to nearest quarter end
    console.log("Quartalsende | MSFT CapEx | GOOGL CapEx | META CapEx | AMZN CapEx | TOTAL ($B)");
    for (const d of allDates.filter(d => d >= '2021-01-01')) {
        const msft = msftCapEx.find(c => Math.abs(new Date(c.end) - new Date(d)) < 45 * 86400000)?.capex / 1e9 || 0;
        const googl = googlCapEx.find(c => Math.abs(new Date(c.end) - new Date(d)) < 45 * 86400000)?.capex / 1e9 || 0;
        const meta = metaCapEx.find(c => Math.abs(new Date(c.end) - new Date(d)) < 45 * 86400000)?.capex / 1e9 || 0;
        const amzn = amznCapEx.find(c => Math.abs(new Date(c.end) - new Date(d)) < 45 * 86400000)?.capex / 1e9 || 0;
        const total = msft + googl + meta + amzn;
        if (total > 0) {
            console.log(`${d}   | ${msft.toFixed(2).padStart(10)} | ${googl.toFixed(2).padStart(11)} | ${meta.toFixed(2).padStart(10)} | ${amzn.toFixed(2).padStart(10)} | ${total.toFixed(2).padStart(9)}`);
        }
    }

    // Print NVDA Financials
    console.log("\n--------------------------------------------------------------------------------");
    console.log("2. NVIDIA: QUARTALS-UMSATZ ($B) & GROSS MARGIN (%) SEIT 2021");
    console.log("--------------------------------------------------------------------------------");
    console.log("Quartalsende | NVDA Rev ($B) | YoY Rev% | Gross Margin%");
    for (let i = 0; i < nvdaFin.length; i++) {
        const q = nvdaFin[i];
        if (q.end < '2021-01-01') continue;
        const prevYear = nvdaFin.find(p => {
            const diffDays = (new Date(q.end) - new Date(p.end)) / (86400000);
            return diffDays >= 340 && diffDays <= 390;
        });
        const yoy = prevYear ? ((q.revenue - prevYear.revenue) / prevYear.revenue * 100).toFixed(1) + '%' : 'N/A';
        console.log(`${q.end}   | ${(q.revenue/1e9).toFixed(2).padStart(13)} | ${yoy.padStart(8)} | ${q.grossMarginPct ? q.grossMarginPct.toFixed(1) + '%' : 'N/A'}`);
    }

    // Save summary json
    const summary = {
        msftCapEx,
        googlCapEx,
        metaCapEx,
        amznCapEx,
        nvdaFin
    };
    fs.writeFileSync(path.join(CACHE_DIR, 'capex_study_summary.json'), JSON.stringify(summary, null, 2));
}

run().catch(e => console.error(e));
