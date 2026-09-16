import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(REPO_ROOT, 'data/cache/turnarounds');

for (const sym of ['NOW', 'PLTR', 'AMZN', 'GOOGL']) {
    const dailyFile = path.join(CACHE_DIR, `${sym}_daily.json`);
    if (!fs.existsSync(dailyFile)) continue;
    const quotes = JSON.parse(fs.readFileSync(dailyFile, 'utf8'));
    if (!quotes || quotes.length === 0) continue;

    const first = quotes[0];
    const last = quotes[quotes.length - 1];

    let peak = 0;
    let maxDD = 0;
    let ddDates = { peakDate: '', troughDate: '' };
    let curPeak = 0;
    let curPeakDate = '';

    for (const q of quotes) {
        if (q.close > curPeak) {
            curPeak = q.close;
            curPeakDate = q.date;
        }
        const dd = (q.close - curPeak) / curPeak;
        if (dd < maxDD) {
            maxDD = dd;
            ddDates = { peakDate: curPeakDate, troughDate: q.date };
        }
    }

    console.log(`\n================================================================================`);
    console.log(`TICKER: ${sym} (${quotes.length} days: ${first.date} bis ${last.date})`);
    console.log(`Start Price: $${first.close.toFixed(2)} | End Price: $${last.close.toFixed(2)} | Total Gain: ${(((last.close - first.close) / first.close) * 100).toFixed(1)}%`);
    console.log(`Max Drawdown: ${(maxDD * 100).toFixed(1)}% (von ${ddDates.peakDate} bis ${ddDates.troughDate})`);

    // Let's check 2022 bear market drawdown specifically
    let peak2021 = 0;
    let maxDD2022 = 0;
    for (const q of quotes) {
        if (q.date >= '2021-01-01' && q.date <= '2022-12-31') {
            if (q.close > peak2021) peak2021 = q.close;
            const dd = (q.close - peak2021) / peak2021;
            if (dd < maxDD2022) maxDD2022 = dd;
        }
    }
    console.log(`2021-2022 Bear Market Drawdown: ${(maxDD2022 * 100).toFixed(1)}% (Peak 2021: $${peak2021.toFixed(2)})`);
}
