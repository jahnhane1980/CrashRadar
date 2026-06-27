import ky from 'ky';

async function testCboe() {
    const url = 'https://www.cboe.com/us/options/market_statistics/historical_data/download/class/';
    const searchParams = {
        reportType: 'volume',
        volumeType: 'sum',
        volumeAggType: 'daily',
        symbolType: 'osiRoot', 
        symbol: 'SPY',
        startDate: '2026-06-01',
        endDate: '2026-06-26',
        exchanges: 'CBOE'
    };

    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/csv,*/*',
            'Origin': 'https://www.cboe.com',
            'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
        }
    });

    try {
        const text = await api.get(url, { searchParams }).text();
        console.log("CSV Response (First 500 chars):");
        console.log(text.substring(0, 500));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testCboe();
