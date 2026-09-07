import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, '../architecture/strategies/cache');
const WATCHLIST_FILE = path.resolve(CACHE_DIR, 'ark_historical_watchlist_2014_2026.json');

function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sma.push(null);
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) sum += data[i - j];
            sma.push(sum / period);
        }
    }
    return sma;
}

async function analyzeEarlyWatchlist() {
    console.log("================================================================================");
    console.log("   CRASHRADAR: ANALYSE DER HISTORISCHEN ARK-WATCHLIST AB 2014-10-31 / 2015-01-01");
    console.log("   Welche Aktien fielen auf OBSERVE und was passierte mit ihnen?");
    console.log("================================================================================\n");

    const watchlist = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
    const stockMap = watchlist.watchlistByStock;

    // Load price cache
    const startDate = '2014-10-01';
    const endDate = '2026-09-06';

    const symbolsToTest = [
        // 2014/2015 Early Holdings
        'SSYS', 'DDD', 'NVDA', 'TSLA', 'AMZN', 'NFLX', 'ILMN', 'PRLB', 'MELI', 'ISRG',
        // IPOs 2015-2021
        'SHOP', 'XYZ', 'TDOC', 'CRSP', 'ROKU', 'ZM', 'PLTR', 'COIN'
    ];

    const prices = {};
    for (const sym of [...symbolsToTest, 'QQQ', 'SPY']) {
        const pFile = path.join(CACHE_DIR, `${sym}_${startDate}_${endDate}.json`);
        if (fs.existsSync(pFile)) {
            prices[sym] = JSON.parse(fs.readFileSync(pFile, 'utf8'));
        }
    }

    const qqqCloses = new Map((prices['QQQ'] || []).map(q => [q.date, q.close]));

    console.log("----------------------------------------------------------------------------------------------------------------------------------");
    console.log("Ticker | Cathie First Seen | Entry Status | Stage-2 Breakout? | Erstes Kaufdatum | Kurs @ First Seen | Kurs @ Kauf | Performance");
    console.log("----------------------------------------------------------------------------------------------------------------------------------");

    const summaryResults = [];

    for (const sym of symbolsToTest) {
        const stockInfo = stockMap[sym];
        const firstSeen = stockInfo?.firstSeenDate || '2014-10-31';
        const quotes = prices[sym] || [];

        if (quotes.length === 0) {
            console.log(`${sym.padEnd(6)} | Keine Kursdaten vorhanden.`);
            continue;
        }

        const closes = quotes.map(q => q.close);
        const volumes = quotes.map(q => q.volume);
        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200);
        const sma50Vol = calculateSMA(volumes, 50);

        // RS Line vs QQQ
        const rsValues = quotes.map(q => {
            const qc = qqqCloses.get(q.date);
            return qc ? q.close / qc : null;
        });
        const rsSMA50 = calculateSMA(rsValues.map(v => v || 0), 50);

        // Find price at firstSeenDate
        const firstQuote = quotes.find(q => q.date >= firstSeen) || quotes[0];
        const priceAtFirstSeen = firstQuote ? firstQuote.close : null;

        // Simulate Stage-2 Gate screening starting from firstSeenDate
        let firstBuyDate = null;
        let priceAtFirstBuy = null;
        let status = 'PERMANENT_OBSERVE (Nie gekauft / Abgewehrt)';

        for (let i = 50; i < quotes.length; i++) {
            const d = quotes[i].date;
            if (d < firstSeen) continue;

            const c = closes[i];
            const v = volumes[i];
            const s50 = sma50[i];
            const s200 = sma200[i];
            const sv50 = sma50Vol[i];
            const rs = rsValues[i];
            const rs50 = rsSMA50[i];

            // 50-day prior high
            const high50d = Math.max(...closes.slice(i - 50, i));

            // Stage-2 Weinstein Criteria
            const isStage2 = s200 !== null && s50 !== null &&
                             c > high50d &&
                             c > s200 &&
                             c > s50 &&
                             rs > rs50 &&
                             v >= 1.2 * sv50;

            if (isStage2 && !firstBuyDate) {
                firstBuyDate = d;
                priceAtFirstBuy = c;
                status = 'STAGE_2_BUY (Gekauft)';
                break;
            }
        }

        let perfNote = '';
        if (firstBuyDate) {
            const lastClose = quotes[quotes.length - 1].close;
            const gain = ((lastClose - priceAtFirstBuy) / priceAtFirstBuy) * 100;
            perfNote = `Gekauft @ $${priceAtFirstBuy.toFixed(2)} -> Heute $${lastClose.toFixed(2)} (${gain >= 0 ? '+' : ''}${gain.toFixed(1)}%)`;
        } else {
            const lastClose = quotes[quotes.length - 1].close;
            const lossFromFirstSeen = ((lastClose - priceAtFirstSeen) / priceAtFirstSeen) * 100;
            perfNote = `Blockiert @ $${priceAtFirstSeen.toFixed(2)} -> Heute $${lastClose.toFixed(2)} (${lossFromFirstSeen.toFixed(1)}% Absturz vermieden!)`;
        }

        console.log(
            `${sym.padEnd(6)} | ` +
            `${firstSeen.padEnd(17)} | ` +
            `${status.padEnd(25)} | ` +
            `${(firstBuyDate || 'NEIN').padEnd(16)} | ` +
            `$ ${(priceAtFirstSeen || 0).toFixed(2).padStart(8)} | ` +
            `$ ${(priceAtFirstBuy || 0).toFixed(2).padStart(8)} | ` +
            perfNote
        );

        summaryResults.push({
            sym,
            firstSeen,
            status,
            firstBuyDate,
            priceAtFirstSeen,
            priceAtFirstBuy,
            perfNote
        });
    }

    console.log("----------------------------------------------------------------------------------------------------------------------------------\n");
}

analyzeEarlyWatchlist().catch(console.error);
