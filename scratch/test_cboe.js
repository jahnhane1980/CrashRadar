import ky from 'ky';
import { parse } from 'csv-parse/sync';

async function test() {
    try {
        const responseText = await ky.get('https://www.cboe.com/us/options/market_statistics/historical_data/download/class/', {
            searchParams: {
                reportType: 'volume',
                volumeType: 'sum',
                volumeAggType: 'daily',
                symbolType: 'osiRoot',
                symbol: 'SPY',
                startDate: '2025-10-01',
                endDate: '2025-10-05',
                exchanges: 'CBOE'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Origin': 'https://www.cboe.com',
                'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
            }
        }).text();
        
        const records = parse(responseText, { columns: true, skip_empty_lines: true, trim: true });
        if(records.length > 0) {
            console.log("CSV Columns:", Object.keys(records[0]));
            console.log("Sample Data:", records[0]);
        } else {
            console.log("No records returned");
        }
    } catch(e) {
        console.error(e);
    }
}
test();
