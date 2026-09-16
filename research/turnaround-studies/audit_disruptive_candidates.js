import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const companies = [
    { ticker: 'SYM', cik: '0001837240', name: 'Symbotic Inc.' },
    { ticker: 'TEM', cik: '0001717115', name: 'Tempus AI, Inc.' },
    { ticker: 'RXRX', cik: '0001601830', name: 'Recursion Pharmaceuticals, Inc.' },
    { ticker: 'CRSP', cik: '0001674416', name: 'CRISPR Therapeutics AG' },
    { ticker: 'PATH', cik: '0001734722', name: 'UiPath, Inc.' },
    { ticker: 'INFQ', cik: '0002007825', name: 'Infleqtion, Inc.' }
];

async function fetchCompanyData(comp) {
    let priceData = {};
    try {
        const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${comp.ticker}?interval=1wk&range=5y`;
        const res = await fetch(chartUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
            const json = await res.json();
            const result = json.chart?.result?.[0];
            const meta = result?.meta;
            const ts = result?.timestamp || [];
            const quotes = result?.indicators?.quote?.[0] || {};
            const closes = quotes.close || [];
            const volumes = quotes.volume || [];
            
            let minP = Infinity, maxP = -Infinity;
            let minD = '', maxD = '';
            const history = [];
            for (let i = 0; i < ts.length; i++) {
                const c = closes[i];
                const v = volumes[i];
                if (c == null) continue;
                const d = new Date(ts[i] * 1000).toISOString().split('T')[0];
                if (c < minP) { minP = c; minD = d; }
                if (c > maxP) { maxP = c; maxD = d; }
                history.push({ date: d, close: c, volume: v });
            }
            priceData = {
                current: meta?.regularMarketPrice,
                ath: maxP,
                athDate: maxD,
                atl: minP,
                atlDate: minD,
                fiftyTwoWeekHigh: meta?.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: meta?.fiftyTwoWeekLow,
                historyCount: history.length,
                history: history
            };
        }
    } catch (e) {
        console.error(`Price fetch error for ${comp.ticker}:`, e.message);
    }

    let secData = {};
    try {
        const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${comp.cik}.json`;
        const fRes = await fetch(factsUrl, {
            headers: { 'User-Agent': 'CrashRadar Research research@crashradar.org' }
        });
        if (fRes.ok) {
            const facts = await fRes.json();
            const gaap = facts.facts?.['us-gaap'] || facts.facts?.['dei'] || {};
            
            const revUnits = gaap['RevenueFromContractWithCustomerExcludingAssessedTax']?.units?.USD ||
                             gaap['Revenues']?.units?.USD || [];
            const quarterlyRevs = revUnits.filter(r => r.form === '10-Q' || r.form === '10-K')
                                          .filter(r => r.fp && r.fp.startsWith('Q'))
                                          .slice(-8);

            const netIncUnits = gaap['NetIncomeLoss']?.units?.USD || [];
            const quarterlyNetInc = netIncUnits.filter(r => r.form === '10-Q' || r.form === '10-K')
                                              .filter(r => r.fp && r.fp.startsWith('Q'))
                                              .slice(-8);

            const cashUnits = gaap['CashAndCashEquivalentsAtCarryingValue']?.units?.USD ||
                              gaap['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']?.units?.USD || [];
            const recentCash = cashUnits.filter(r => r.form === '10-Q' || r.form === '10-K').slice(-4);

            const ocfUnits = gaap['NetCashProvidedByUsedInOperatingActivities']?.units?.USD || [];
            const recentOcf = ocfUnits.filter(r => r.form === '10-Q' || r.form === '10-K').slice(-4);

            const debtUnits = gaap['LongTermDebtNoncurrent']?.units?.USD ||
                              gaap['LongTermDebt']?.units?.USD || [];
            const recentDebt = debtUnits.filter(r => r.form === '10-Q' || r.form === '10-K').slice(-2);

            secData = {
                quarterlyRevs: quarterlyRevs.map(r => ({ fy: r.fy, fp: r.fp, end: r.end, valM: (r.val/1e6).toFixed(1) })),
                quarterlyNetInc: quarterlyNetInc.map(r => ({ fy: r.fy, fp: r.fp, end: r.end, valM: (r.val/1e6).toFixed(1) })),
                latestCashM: recentCash.length > 0 ? (recentCash[recentCash.length - 1].val / 1e6).toFixed(1) : 'N/A',
                latestOcfM: recentOcf.length > 0 ? (recentOcf[recentOcf.length - 1].val / 1e6).toFixed(1) : 'N/A',
                latestDebtM: recentDebt.length > 0 ? (recentDebt[recentDebt.length - 1].val / 1e6).toFixed(1) : '0'
            };
        }
    } catch (e) {
        console.error(`SEC fetch error for ${comp.ticker}:`, e.message);
    }

    return { comp, priceData, secData };
}

async function run() {
    const all = {};
    for (const c of companies) {
        console.log(`Auditing ${c.ticker}...`);
        all[c.ticker] = await fetchCompanyData(c);
        await new Promise(r => setTimeout(r, 400));
    }
    const outFile = path.join(__dirname, 'data_cache/bullshit_test_disruptors.json');
    fs.writeFileSync(outFile, JSON.stringify(all, null, 2));
    console.log(`Audit saved to ${outFile}`);
}

run().catch(console.error);
