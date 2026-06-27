import ky from 'ky';

async function testCboeType(type) {
    const url = 'https://www.cboe.com/us/options/market_statistics/historical_data/download/class/';
    const searchParams = {
        reportType: 'volume',
        volumeType: type,
        volumeAggType: 'daily',
        symbolType: 'osiRoot', 
        symbol: 'SPY',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        exchanges: 'CBOE'
    };

    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://www.cboe.com',
            'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
        }
    });

    try {
        const text = await api.get(url, { searchParams }).text();
        console.log(`\n--- Volume Type: ${type} ---`);
        console.log(text.substring(0, 150));
    } catch (e) {
        console.log(`\n--- Volume Type: ${type} --- ERROR: ${e.message}`);
    }
}

async function run() {
    await testCboeType('put');
    await testCboeType('call');
    await testCboeType('put_call_ratio');
}

run();
