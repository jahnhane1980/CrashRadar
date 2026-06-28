import ky from 'ky';

async function testParam(paramName, paramValue) {
    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Origin': 'https://www.cboe.com',
            'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
        },
        timeout: 10000,
        retry: 0
    });

    const url = 'https://www.cboe.com/us/options/market_statistics/historical_data/download/class/';
    const searchParams = {
        reportType: 'volume',
        volumeType: 'sum',
        volumeAggType: 'daily',
        symbolType: 'osiRoot', 
        symbol: 'SPY',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        exchanges: 'CBOE'
    };
    
    if (paramName) {
        searchParams[paramName] = paramValue;
    } else {
        delete searchParams.volumeType;
    }

    try {
        const text = await api.get(url, { searchParams }).text();
        console.log(`[${paramName || 'NO volumeType'}=${paramValue}] -> len: ${text.length}`);
        console.log(text.substring(0, 300));
    } catch (e) {
        console.log(`[${paramName}=${paramValue}] -> error: ${e.response ? e.response.status : e.message}`);
    }
}

async function run() {
    await testParam(null, null); // Test without volumeType
    await testParam('putCall', 'P');
    await testParam('optionType', 'P');
    await testParam('type', 'P');
}

run();
