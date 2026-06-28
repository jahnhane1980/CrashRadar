import ky from 'ky';

async function run() {
    try {
        const text = await ky.get('https://www.cboe.com/us/options/market_statistics/historical_data/').text();
        
        // Find all input and select elements to see what parameters we can pass
        const inputs = text.match(/<input[^>]+>/g) || [];
        const selects = text.match(/<select[^>]+>([\s\S]*?)<\/select>/g) || [];
        
        console.log("Inputs found:", inputs.length);
        inputs.forEach(i => {
            if (i.includes('name="volumeType"') || i.includes('name="reportType"') || i.includes('type="radio"') || i.includes('type="checkbox"')) {
                console.log(i);
            }
        });
        
        console.log("\nSelects found:");
        selects.forEach(s => {
            if (s.includes('volumeType') || s.includes('reportType')) {
                console.log(s);
            }
        });
        
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
