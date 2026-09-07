import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_PATH = path.resolve(__dirname, '../architecture/strategies/fundamentals_master.json');
const SEC_HEADERS = {
    'User-Agent': 'CrashRadar Research research@crashradar.org',
    'Accept-Encoding': 'gzip, deflate'
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const COMPANIES = [
    { ticker: 'TSLA', cik: '0001318605' },
    { ticker: 'NVDA', cik: '0001045810' },
    { ticker: 'AMZN', cik: '0001018724' },
    { ticker: 'NFLX', cik: '0001065280' },
    { ticker: 'XYZ', cik: '0001512673' },  // Block / SQ
    { ticker: 'SHOP', cik: '0001594805' },
    { ticker: 'SSYS', cik: '0001517396' },
    { ticker: 'DDD', cik: '0000910638' },
    { ticker: 'ILMN', cik: '0001110803' },
    { ticker: 'PRLB', cik: '0001443669' },
    { ticker: 'MELI', cik: '0001099590' },
    { ticker: 'ISRG', cik: '0001035267' },
    { ticker: 'CRSP', cik: '0001674416' },
    { ticker: 'ROKU', cik: '0001428439' }, // Fixed CIK
    { ticker: 'TDOC', cik: '0001477449' },
    { ticker: 'ZM', cik: '0001585521' },
    { ticker: 'PLTR', cik: '0001321655' },
    { ticker: 'COIN', cik: '0001679788' },
    { ticker: 'NVTS', cik: '0001821769' },
    { ticker: 'IBRX', cik: '0001326110' },
    { ticker: 'AIRO', cik: '0001927958' },
    { ticker: 'SOFI', cik: '0001818874' },
    { ticker: 'S', cik: '0001583708' },
    { ticker: 'MSTR', cik: '0001050446' },
    { ticker: 'MARA', cik: '0001507605' },
    { ticker: 'BMNR', cik: '0001829311' },
    { ticker: 'BLSH', cik: '0001872195' }
];

function parseQuarterlyFacts(factsData, ticker) {
    const usGaap = factsData.facts?.['us-gaap'] || {};

    const revTags = [
        'RevenueFromContractWithCustomerExcludingAssessedTax',
        'RevenueFromContractWithCustomerIncludingAssessedTax',
        'SalesRevenueNet',
        'Revenues',
        'RegulatedAndUnregulatedOperatingRevenue'
    ];

    function filter3MonthQuarters(units) {
        return units.filter(u => {
            if (u.form !== '10-Q' && u.form !== '6-K') return false;
            if (!u.start || !u.end || !u.filed) return false;
            const durDays = (new Date(u.end) - new Date(u.start)) / (1000 * 3600 * 24);
            if (durDays < 70 || durDays > 115) return false; // Strictly 3-month quarter
            const lagDays = (new Date(u.filed) - new Date(u.end)) / (1000 * 3600 * 24);
            if (lagDays < 0 || lagDays > 120) return false; // Current filing quarter, not prior comparative
            return true;
        });
    }

    const qRevsByEnd = new Map();
    for (const tag of revTags) {
        if (usGaap[tag]?.units?.USD) {
            const list = filter3MonthQuarters(usGaap[tag].units.USD);
            for (const r of list) {
                if (!qRevsByEnd.has(r.end) || (r.filed && r.filed > qRevsByEnd.get(r.end).filed)) {
                    qRevsByEnd.set(r.end, r);
                }
            }
        }
    }

    const netTags = [
        'NetIncomeLoss',
        'ProfitLoss',
        'NetIncomeLossAvailableToCommonStockholdersBasic'
    ];
    const qNetsByEnd = new Map();
    for (const tag of netTags) {
        if (usGaap[tag]?.units?.USD) {
            const list = filter3MonthQuarters(usGaap[tag].units.USD);
            for (const n of list) {
                if (!qNetsByEnd.has(n.end) || (n.filed && n.filed > qNetsByEnd.get(n.end).filed)) {
                    qNetsByEnd.set(n.end, n);
                }
            }
        }
    }

    const quarterMap = new Map();
    for (const [end, r] of qRevsByEnd.entries()) {
        const netObj = qNetsByEnd.get(end);
        const netVal = netObj ? netObj.val : null;
        quarterMap.set(end, {
            fiscal_period: `${r.fy || new Date(r.end).getFullYear()}-${r.fp || 'Q'}`,
            fiscal_year: r.fy || new Date(r.end).getFullYear(),
            period: r.fp || 'Q',
            filing_date: r.filed,
            period_end_date: r.end,
            revenue: r.val,
            net_income: netVal,
            eps: null,
            gross_profit: null,
            operating_cash_flow: null
        });
    }

    const quarters = Array.from(quarterMap.values())
        .sort((a, b) => a.period_end_date.localeCompare(b.period_end_date));

    // Calculate YoY Growth by comparing to the quarter ending ~365 days prior (within 330-395 days)
    for (let i = 0; i < quarters.length; i++) {
        const q = quarters[i];
        const qEnd = new Date(q.period_end_date).getTime();
        const prior = quarters.find(p => {
            const pEnd = new Date(p.period_end_date).getTime();
            const diffDays = (qEnd - pEnd) / (1000 * 3600 * 24);
            return diffDays >= 330 && diffDays <= 395;
        });

        if (prior && prior.revenue && q.revenue) {
            const diff = q.revenue - prior.revenue;
            q.yoy_revenue_growth_pct = parseFloat(((diff / prior.revenue) * 100).toFixed(2));
            q.prior_year_revenue = prior.revenue;
            q.prior_period_end = prior.period_end_date;
        } else {
            q.yoy_revenue_growth_pct = null;
            q.prior_year_revenue = null;
        }
    }

    return quarters;
}

async function fetchCompanyFundamentals(c) {
    console.log(`Lade SEC Facts für ${c.ticker} (CIK ${c.cik})...`);
    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${c.cik}.json`;
    const res = await fetch(url, { headers: SEC_HEADERS });
    if (!res.ok) {
        console.warn(`Fehler bei ${c.ticker}: HTTP ${res.status}`);
        return null;
    }

    const data = await res.json();
    const quarters = parseQuarterlyFacts(data, c.ticker);
    console.log(`  -> ${quarters.length} 3-Monats-Quartale für ${c.ticker} extrahiert (${quarters[0]?.filing_date} bis ${quarters[quarters.length - 1]?.filing_date}).`);
    return quarters;
}

async function run() {
    console.log("================================================================================");
    console.log("   SEC EDGAR 10-Q/6-K FUNDAMENTALS INGESTION (ROBUST 3-MONTH DURATION)");
    console.log("================================================================================\n");

    let masterMap = {};
    if (fs.existsSync(MASTER_PATH)) {
        masterMap = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8'));
    }

    for (const c of COMPANIES) {
        try {
            await delay(250); // Respect SEC rate limit
            const quarters = await fetchCompanyFundamentals(c);
            if (quarters && quarters.length > 0) {
                // If existing has significantly more quarters (e.g. SHOP via special ingestion), preserve existing
                const existing = masterMap[c.ticker] || [];
                if (existing.length > quarters.length + 5) {
                    console.log(`  -> Behalte ${existing.length} existierende Quartale für ${c.ticker} (mehr Daten als SEC Facts).`);
                } else {
                    masterMap[c.ticker] = quarters;
                }
            }
        } catch (e) {
            console.error(`Fehler bei ${c.ticker}:`, e.message);
        }
    }

    fs.writeFileSync(MASTER_PATH, JSON.stringify(masterMap, null, 2));
    console.log("\n================================================================================");
    console.log(`[ERFOLG] Master-Fundamentaldaten aktualisiert unter:`);
    console.log(`  -> ${MASTER_PATH}`);
    console.log(`  -> Verfügbare Ticker: ${Object.keys(masterMap).join(', ')}`);
    console.log("================================================================================\n");
}

run().catch(console.error);
