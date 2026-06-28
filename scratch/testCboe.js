import ky from 'ky';
import { parse } from 'csv-parse/sync';

async function test() {
    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/csv,application/csv,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Origin': 'https://www.cboe.com',
            'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
        },
        timeout: 60000
    });

    const url = 'https://www.cboe.com/us/options/market_statistics/historical_data/download/class/';
    const searchParams = {
        reportType: 'volume',
        volumeType: 'sum',
        volumeAggType: 'daily',
        symbolType: 'osiRoot', 
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        exchanges: 'CBOE'
    };

    try {
        console.log("Fetching CBOE data...");
        const responseText = await api.get(url, { searchParams }).text();
        console.log("Raw Response length:", responseText.length);
        
        const records = parse(responseText, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        
        if (records.length > 0) {
            console.log("Columns:", Object.keys(records[0]));
            console.log("First row:", records[0]);
        } else {
            console.log("No records returned.");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
