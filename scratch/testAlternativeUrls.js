import ky from 'ky';

async function testURL(url) {
    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/csv,application/csv,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Origin': 'https://www.cboe.com',
            'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
        },
        timeout: 10000,
        retry: 0
    });

    try {
        const text = await api.get(url).text();
        console.log(`[SUCCESS] ${url} -> len: ${text.length}`);
        console.log(text.substring(0, 200));
    } catch (e) {
        console.log(`[ERROR] ${url} -> ${e.response ? e.response.status : e.message}`);
    }
}

async function run() {
    const urls = [
        'https://www.cboe.com/us/options/market_statistics/historical_data/download/ratio/',
        'https://www.cboe.com/us/options/market_statistics/historical_data/download/pcr/',
        'https://www.cboe.com/us/options/market_statistics/historical_data/download/put_call_ratio/',
        'https://cdn.cboe.com/data/us/options/market_statistics/historical_data/pcr.csv'
    ];
    for (const u of urls) {
        await testURL(u);
    }
}
run();
