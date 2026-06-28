import ky from 'ky';

async function testVolumeType(type) {
    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://www.cboe.com',
            'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
        },
        timeout: 10000,
        retry: 0
    });

    const url = 'https://www.cboe.com/us/options/market_statistics/historical_data/download/class/';
    const searchParams = {
        reportType: 'volume',
        volumeType: type,
        volumeAggType: 'daily',
        symbolType: 'osiRoot', 
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        exchanges: 'CBOE'
    };

    try {
        const text = await api.get(url, { searchParams }).text();
        console.log(`[${type}] => success, len: ${text.length}. First 200 chars:\n${text.substring(0, 200)}`);
    } catch (e) {
        console.log(`[${type}] => error: ${e.response ? e.response.status : e.message}`);
    }
}

async function run() {
    const typesToTest = ['sum', 'put_call', 'putCall', 'pc', 'P/C', 'putcall', 'detailed'];
    for (const t of typesToTest) {
        await testVolumeType(t);
        await new Promise(r => setTimeout(r, 1000));
    }
}

run();
