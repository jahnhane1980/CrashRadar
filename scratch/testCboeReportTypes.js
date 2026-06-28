import ky from 'ky';

async function testReportType(rType) {
    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Origin': 'https://www.cboe.com',
            'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
        },
        timeout: 10000,
        retry: 0
    });

    const url = 'https://www.cboe.com/us/options/market_statistics/historical_data/download/class/';
    const searchParams = {
        reportType: rType,
        volumeType: 'sum',
        volumeAggType: 'daily',
        symbolType: 'osiRoot', 
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        exchanges: 'CBOE'
    };

    try {
        const text = await api.get(url, { searchParams }).text();
        console.log(`[reportType=${rType}] -> SUCCESS (len: ${text.length})`);
    } catch (e) {
        console.log(`[reportType=${rType}] -> ERROR: ${e.response ? e.response.status : e.message}`);
    }
}

async function run() {
    const types = ['pcr', 'ratio', 'put_call_ratio', 'pc_ratio', 'options_ratio'];
    for (const t of types) {
        await testReportType(t);
    }
}
run();
