import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

const CACHE_DIR = path.resolve(__dirname, '../architecture/strategies/cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const SYMBOLS = [
    'ARKK', 'QQQ', 'SPY', 'GLD', 'EURUSD=X', 'BTC-USD',
    'TSLA', 'NVDA', 'AMZN', 'NFLX', 'SHOP', 'XYZ', 'ROKU',
    'TDOC', 'ZM', 'PLTR', 'COIN', 'SSYS', 'DDD', 'ILMN',
    'PRLB', 'CRSP', 'MELI', 'ISRG'
];

async function cacheAllPrices() {
    console.log("================================================================================");
    console.log("   CACHING HISTORICAL PRICES (2014-10-01 BIS 2026-09-06)");
    console.log("================================================================================\n");

    const startDate = '2014-10-01';
    const endDate = '2026-09-06';

    for (const sym of SYMBOLS) {
        const cacheFile = path.join(CACHE_DIR, `${sym}_${startDate}_${endDate}.json`);
        if (fs.existsSync(cacheFile)) {
            const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            console.log(`[CACHE HIT] ${sym.padEnd(10)}: ${cached.length} Bars.`);
            continue;
        }

        console.log(`[FETCH YF] Lade Kursdaten für ${sym}...`);
        try {
            const chart = await yf.chart(sym, {
                period1: startDate,
                period2: endDate,
                interval: '1d'
            });
            const quotes = chart.quotes
                .filter(q => q.close !== null && q.close !== undefined)
                .map(q => ({
                    date: q.date.toISOString().split('T')[0],
                    close: q.adjclose || q.close,
                    open: q.open,
                    high: q.high,
                    low: q.low,
                    volume: q.volume || 0
                }));
            fs.writeFileSync(cacheFile, JSON.stringify(quotes, null, 2));
            console.log(`  -> Gespeichert: ${quotes.length} Bars (${quotes[0].date} bis ${quotes[quotes.length - 1].date}).`);
            await new Promise(r => setTimeout(r, 250));
        } catch (e) {
            console.error(`  -> FEHLER bei ${sym}:`, e.message);
        }
    }

    console.log("\n[ABSCHLUSS] Alle Kursdaten erfolgreich im lokalen Cache abgelegt.");
}

cacheAllPrices().catch(console.error);
