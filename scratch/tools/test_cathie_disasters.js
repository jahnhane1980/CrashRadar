import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

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

async function testCathieDisasterStocks() {
    console.log("================================================================================");
    console.log("   PRÜFE CATHIE WOODS FLOP-AKTIEN (2014-2017): BLOCKED IN OBSERVE?");
    console.log("================================================================================\n");

    const flopSymbols = ['LC', 'ONVO', 'CGEN', 'ARAY', 'BLUE', 'PACB'];
    const qqqFile = path.join(CACHE_DIR, 'QQQ_2014-10-01_2026-09-06.json');
    const qqqCloses = new Map(JSON.parse(fs.readFileSync(qqqFile, 'utf8')).map(q => [q.date, q.close]));

    for (const sym of flopSymbols) {
        try {
            const chart = await yf.chart(sym, {
                period1: '2014-10-01',
                period2: '2026-09-06',
                interval: '1d'
            });
            const quotes = chart.quotes.filter(q => q.close !== null && q.close !== undefined);
            if (quotes.length < 100) continue;

            const closes = quotes.map(q => q.adjclose || q.close);
            const volumes = quotes.map(q => q.volume || 0);
            const sma50 = calculateSMA(closes, 50);
            const sma200 = calculateSMA(closes, 200);
            const sma50Vol = calculateSMA(volumes, 50);

            const rsValues = quotes.map(q => {
                const qc = qqqCloses.get(q.date.toISOString().split('T')[0]);
                return qc ? q.close / qc : null;
            });
            const rsSMA50 = calculateSMA(rsValues.map(v => v || 0), 50);

            let firstBuyDate = null;
            let buyPrice = null;

            for (let i = 50; i < quotes.length; i++) {
                const c = closes[i];
                const v = volumes[i];
                const s50 = sma50[i];
                const s200 = sma200[i];
                const sv50 = sma50Vol[i];
                const rs = rsValues[i];
                const rs50 = rsSMA50[i];
                const high50d = Math.max(...closes.slice(i - 50, i));

                const isStage2 = s200 !== null && s50 !== null &&
                                 c > high50d &&
                                 c > s200 &&
                                 c > s50 &&
                                 rs > rs50 &&
                                 v >= 1.5 * sv50;

                if (isStage2) {
                    firstBuyDate = quotes[i].date.toISOString().split('T')[0];
                    buyPrice = c;
                    break;
                }
            }

            const pStart = closes[0];
            const pEnd = closes[closes.length - 1];
            const buyHoldReturn = ((pEnd - pStart) / pStart) * 100;

            console.log(
                `${sym.padEnd(6)} | First Bar: $${pStart.toFixed(2).padStart(7)} | Today: $${pEnd.toFixed(2).padStart(7)} | Buy&Hold: ${buyHoldReturn.toFixed(1)}% | ` +
                (firstBuyDate ? `Stage-2 Buy am ${firstBuyDate} @ $${buyPrice.toFixed(2)}` : `PERMANENT IN OBSERVE GEBLOCKT (0 € Verlust!)`)
            );
        } catch (e) {
            console.error(`Fehler bei ${sym}:`, e.message);
        }
    }
}

testCathieDisasterStocks().catch(console.error);
