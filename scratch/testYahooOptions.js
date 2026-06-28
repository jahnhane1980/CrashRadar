import yahooFinance from 'yahoo-finance2';

async function testYahooOptions() {
    try {
        console.log("Fetching options chain for SPY...");
        // the method might be called differently or requires an instance in newer versions.
        // Let's try to search module exports if options doesn't exist
        
        const result = await yahooFinance.options('SPY');
        
        if (!result || !result.options || result.options.length === 0) {
            console.log("No options data found.");
            return;
        }

        const optionChain = result.options[0]; // First expiration date
        console.log(`Expiration Date: ${optionChain.expirationDate}`);
        
        let callVol = 0;
        let callOI = 0;
        optionChain.calls.forEach(c => {
            callVol += c.volume || 0;
            callOI += c.openInterest || 0;
        });

        let putVol = 0;
        let putOI = 0;
        optionChain.puts.forEach(p => {
            putVol += p.volume || 0;
            putOI += p.openInterest || 0;
        });

        console.log(`Calls: Volume=${callVol}, OI=${callOI}`);
        console.log(`Puts:  Volume=${putVol}, OI=${putOI}`);
        
        if (callVol > 0) {
            console.log(`Volume Put/Call Ratio: ${(putVol / callVol).toFixed(2)}`);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testYahooOptions();
