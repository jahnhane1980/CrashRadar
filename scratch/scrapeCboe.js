import ky from 'ky';

async function run() {
    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html',
        }
    });

    try {
        const text = await api.get('https://www.cboe.com/us/options/market_statistics/historical_data/').text();
        const matches = text.match(/https?:\/\/[\w\.\/_-]+download[\w\.\/_-]+/g) || text.match(/\/us\/options\/market_statistics\/historical_data\/download\/[\w\.\/_-]+/g) || text.match(/download\/[\w\.\/_-]+/g);
        
        console.log("Found download links/paths:");
        if (matches) {
            const unique = [...new Set(matches)];
            unique.forEach(m => console.log(m));
        } else {
            console.log("No download paths found.");
        }
    } catch(e) {
        console.log("Error:", e.message);
    }
}
run();
