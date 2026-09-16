import YahooFinance from 'yahoo-finance2';
import axios from 'axios';

const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const testCandidates = [
    { ticker: 'PTON', cik: '0001639825' },
    { ticker: 'TDOC', cik: '0001477449' },
    { ticker: 'BYND', cik: '0001655210' },
    { ticker: 'UPST', cik: '0001647639' },
    { ticker: 'SPCE', cik: '0001706946' }
];

async function testFetch() {
    for (const c of testCandidates) {
        console.log(`Checking ${c.ticker}...`);
        const p = await yahooFinance.chart(c.ticker, { period1: '2019-01-01', period2: '2026-09-08' });
        console.log(`  Quotes: ${p.quotes.length}`);
        
        const secUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${c.cik}.json`;
        try {
            const resp = await axios.get(secUrl, {
                headers: { 'User-Agent': 'CrashRadar ResearchLab/2.0 (contact@crashradar.internal)' },
                timeout: 10000
            });
            console.log(`  SEC facts: OK (keys: ${Object.keys(resp.data.facts).join(', ')})`);
        } catch (e) {
            console.log(`  SEC facts error: ${e.message}`);
        }
    }
}

testFetch().catch(console.error);
