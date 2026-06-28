import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function run() {
    try {
        console.log("=== AKTUELLE WERTE ===");
        
        // 1. SKEW
        const skewQuote = await yahooFinance.quote('^SKEW');
        console.log(`SKEW: ${skewQuote.regularMarketPrice}`);

        // 2. PCR (via Yahoo Options)
        const optionResult = await yahooFinance.options('SPY');
        let puts = 0;
        let calls = 0;
        if (optionResult && optionResult.options && optionResult.options.length > 0) {
            optionResult.options[0].puts.forEach(p => puts += (p.volume || 0));
            optionResult.options[0].calls.forEach(c => calls += (c.volume || 0));
            const pcr = puts / calls;
            console.log(`SPY PCR: ${pcr.toFixed(2)} (Puts: ${puts}, Calls: ${calls})`);
        }

        // 3. Short Volume
        const response = await fetch('https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260626.txt');
        const text = await response.text();
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('SPY|')) {
                const parts = line.split('|');
                const shortVol = parseInt(parts[2], 10);
                const totalVol = parseInt(parts[4], 10);
                const ratio = (shortVol / totalVol) * 100;
                console.log(`SPY Short Ratio: ${ratio.toFixed(2)}% (Short: ${shortVol}, Total: ${totalVol})`);
                break;
            }
        }
        
    } catch (e) {
        console.error("Fehler:", e);
    }
}

run();
