import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const yahooFinance = new YahooFinance();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');

async function testCryptoPeaks() {
    console.log("Fetching ETH-USD and SOL-USD historical daily data...");

    const eth = await yahooFinance.historical('ETH-USD', { period1: '2020-01-01', period2: '2026-09-06' });
    const sol = await yahooFinance.historical('SOL-USD', { period1: '2020-01-01', period2: '2026-09-06' });
    const btc = await yahooFinance.historical('BTC-USD', { period1: '2020-01-01', period2: '2026-09-06' });

    fs.writeFileSync(path.join(CACHE_DIR, 'ETH-USD_daily.json'), JSON.stringify(eth, null, 2));
    fs.writeFileSync(path.join(CACHE_DIR, 'SOL-USD_daily.json'), JSON.stringify(sol, null, 2));
    fs.writeFileSync(path.join(CACHE_DIR, 'BTC-USD_daily.json'), JSON.stringify(btc, null, 2));

    console.log(`Saved: ETH (${eth.length} days), SOL (${sol.length} days), BTC (${btc.length} days).`);

    function getPeak(quotes, start, end) {
        const subset = quotes.filter(q => {
            const d = q.date instanceof Date ? q.date.toISOString().split('T')[0] : q.date;
            return d >= start && d <= end;
        });
        let max = subset[0];
        for (const q of subset) {
            if (q.close > max.close) max = q;
        }
        const dStr = max.date instanceof Date ? max.date.toISOString().split('T')[0] : max.date;
        return { date: dStr, close: max.close };
    }

    console.log("\n================================================================================");
    console.log("   EMPIRISCHER VERGLEICH: BTC VS. ETH VS. SOL PEAKS (2021 & 2024/2025)");
    console.log("================================================================================\n");

    console.log("--- 1. DER BULLENMARKT 2021 (Frühjahr) ---");
    const btcSpring = getPeak(btc, '2021-01-01', '2021-06-30');
    const ethSpring = getPeak(eth, '2021-01-01', '2021-06-30');
    const solSpring = getPeak(sol, '2021-01-01', '2021-06-30');
    console.log(`Frühjahr 2021 Peak:`);
    console.log(`  BTC Peak: ${btcSpring.date} ($${btcSpring.close.toFixed(2)})`);
    console.log(`  ETH Peak: ${ethSpring.date} ($${ethSpring.close.toFixed(2)})`);
    console.log(`  SOL Peak: ${solSpring.date} ($${solSpring.close.toFixed(2)})`);

    console.log("\n--- 2. DER ZYKLUS-GIPFEL 2021 (Herbst All-Time-High) ---");
    const btcFall = getPeak(btc, '2021-07-01', '2021-12-31');
    const ethFall = getPeak(eth, '2021-07-01', '2021-12-31');
    const solFall = getPeak(sol, '2021-07-01', '2021-12-31');
    console.log(`Herbst 2021 Peak:`);
    console.log(`  SOL Peak: ${solFall.date} ($${solFall.close.toFixed(2)})`);
    console.log(`  BTC Peak: ${btcFall.date} ($${btcFall.close.toFixed(2)})`);
    console.log(`  ETH Peak: ${ethFall.date} ($${ethFall.close.toFixed(2)})`);

    console.log("\n--- 3. DER ZYKLUS 2024 - 2026 ---");
    const btc2024 = getPeak(btc, '2024-01-01', '2026-09-06');
    const eth2024 = getPeak(eth, '2024-01-01', '2026-09-06');
    const sol2024 = getPeak(sol, '2024-01-01', '2026-09-06');
    console.log(`Zyklus 2024 - 2026 Peak:`);
    console.log(`  SOL Peak: ${sol2024.date} ($${sol2024.close.toFixed(2)})`);
    console.log(`  ETH Peak: ${eth2024.date} ($${eth2024.close.toFixed(2)})`);
    console.log(`  BTC Peak: ${btc2024.date} ($${btc2024.close.toFixed(2)})`);
}

testCryptoPeaks().catch(console.error);
