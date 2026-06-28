

async function run() {
    const url = 'https://www.cboe.com/markets/us/options/market-statistics/daily/?dt=2020-01-15';
    console.log(`Fetching: ${url}`);
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        
        if (text.includes('TOTAL PUT/CALL RATIO')) {
            console.log('✅ SUCCESS! Found "TOTAL PUT/CALL RATIO" in HTML');
            console.log(text.substring(text.indexOf('TOTAL PUT/CALL RATIO'), text.indexOf('TOTAL PUT/CALL RATIO') + 200));
        } else if (text.includes('Cloudflare') || text.includes('captcha')) {
            console.log('❌ BLOCKED! Cloudflare detected.');
        } else {
            console.log('❓ Returned HTML, but string not found. Length:', text.length);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
