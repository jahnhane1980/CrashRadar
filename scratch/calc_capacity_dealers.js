import Database from 'better-sqlite3';

const db = new Database('./data/Liquidity.sqlite');

function getLatestFred(seriesId) {
    const res = db.prepare(`SELECT value, observation_date FROM econ_fred WHERE series_id = ? ORDER BY observation_date DESC LIMIT 1`).get(seriesId);
    return res;
}

const rrp = getLatestFred('RRPONTSYD');
const reserves = getLatestFred('TOTRESNS');

// LCLoR (Lowest Comfortable Level of Reserves) - estimate ~ $2.8 Trillion (10% of $28T GDP)
const minReserves = 2800; 

console.log("=== KAPAZITÄT (in Milliarden USD) ===");
console.log(`RRP (Datum: ${rrp.observation_date}): $${rrp.value} B`);
console.log(`TOTRESNS (Bank Reserves, Datum: ${reserves.observation_date}): $${reserves.value} B`);
console.log(`Minimal benötigte Reserven (Schätzung 10% BIP): ~$${minReserves} B`);

const excessReserves = reserves.value - minReserves;
const totalCapacity = rrp.value + excessReserves;

console.log(`\n=> Aktuelle Rest-Kapazität des Marktes: $${totalCapacity.toFixed(2)} Billion (RRP + Überschuss-Reserven)`);


// Fetch API for Primary Dealer trend over 18 months
async function fetchAuctionTrend() {
    console.log("\n=== PRIMARY DEALER TREND (Letzte 18 Monate) ===");
    const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?sort=-record_date&filter=record_date:gte:2025-06-01&page[size]=1000';
    
    try {
        const response = await fetch(url);
        const json = await response.json();
        
        let months = {};
        json.data.forEach(item => {
            if (!item.primary_dealer_accepted || !item.total_accepted) return;
            const month = item.record_date.substring(0,7);
            if (!months[month]) months[month] = { primary: 0, total: 0 };
            months[month].primary += parseFloat(item.primary_dealer_accepted);
            months[month].total += parseFloat(item.total_accepted);
        });
        
        const sortedMonths = Object.keys(months).sort();
        let lastRatio = 0;
        
        sortedMonths.forEach(m => {
            const ratio = (months[m].primary / months[m].total) * 100;
            console.log(`Monat ${m}: Dealer Takedown = ${ratio.toFixed(2)}% (Gekauft: $${(months[m].primary/1e9).toFixed(2)} B / Gesamt: $${(months[m].total/1e9).toFixed(2)} B)`);
            lastRatio = ratio;
        });
        
        // Maturity Wall Q3 (July+Aug) = ~4.17 Trillion
        const maturingQ3 = 4170; // Milliarden
        console.log(`\n=> Prognose für Juli/August Maturity Wall ($${maturingQ3} B):`);
        console.log(`Wenn Primary Dealers den aktuellen Trend-Satz (~${lastRatio.toFixed(2)}%) stemmen müssen:`);
        const projectedBurden = maturingQ3 * (lastRatio / 100);
        console.log(`-> Müssten die US Banken ca. $${projectedBurden.toFixed(2)} Billionen aufnehmen!`);
        
    } catch(e) {
        console.error("API Error:", e);
    }
}

fetchAuctionTrend();
