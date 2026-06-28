import ky from 'ky';

async function run() {
    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/csv,application/csv,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Origin': 'https://www.cboe.com',
            'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
        }
    });

    try {
        const text = await api.get('https://cdn.cboe.com/data/us/options/market_statistics/daily/Cboe_Daily_Market_Statistics.csv').text();
        console.log("SUCCESS! Length:", text.length);
        console.log(text.substring(0, 300));
    } catch(e) {
        console.log("ERROR:", e.response ? e.response.status : e.message);
    }
}
run();
