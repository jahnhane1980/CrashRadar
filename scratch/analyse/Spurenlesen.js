import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function checkGammaLevels() {
    const symbol = 'SPY';
    console.log(`Abrufen der Options Chain für ${symbol} via Yahoo Finance...`);
    
    try {
        // Ruft standardmäßig das nächste Verfallsdatum ab
        const result = await yahooFinance.options(symbol);
        
        if (!result.options || result.options.length === 0) {
            console.log('Keine Optionsdaten gefunden.');
            return;
        }

        const optionChain = result.options[0]; 
        const expDate = new Date(optionChain.expirationDate * 1000).toISOString().split('T')[0];
        console.log(`\nVerfallsdatum: ${expDate} (Nächste Fälligkeit)`);
        
        // Sortiere nach höchstem Open Interest
        const topCalls = [...optionChain.calls].sort((a, b) => (b.openInterest || 0) - (a.openInterest || 0)).slice(0, 5);
        const topPuts = [...optionChain.puts].sort((a, b) => (b.openInterest || 0) - (a.openInterest || 0)).slice(0, 5);
        
        console.log('\n--- TOP 5 CALLS (Möglicher Gamma-Widerstand) ---');
        console.log('Strike\tOpen Interest\tImpl. Volatility');
        topCalls.forEach(c => {
            console.log(`$${c.strike}\t${c.openInterest}\t\t${(c.impliedVolatility * 100).toFixed(2)}%`);
        });

        console.log('\n--- TOP 5 PUTS (Mögliche Gamma-Unterstützung) ---');
        console.log('Strike\tOpen Interest\tImpl. Volatility');
        topPuts.forEach(p => {
            console.log(`$${p.strike}\t${p.openInterest}\t\t${(p.impliedVolatility * 100).toFixed(2)}%`);
        });

    } catch (error) {
        console.error('Fehler beim Abruf der Optionsdaten:', error.message);
    }
}

checkGammaLevels();
