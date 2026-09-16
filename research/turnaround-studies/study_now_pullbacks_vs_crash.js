import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(REPO_ROOT, 'data/cache/turnarounds');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));

// Helper to calculate indicators
function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) sma.push(null);
        else {
            let s = 0;
            for (let j = 0; j < period; j++) s += data[i - j].close;
            sma.push(s / period);
        }
    }
    return sma;
}

function calculateEMA(data, period) {
    const ema = [];
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) ema.push(null);
        else if (i === period - 1) {
            let s = 0;
            for (let j = 0; j < period; j++) s += data[i - j].close;
            prev = s / period;
            ema.push(prev);
        } else {
            const val = data[i].close * k + prev * (1 - k);
            ema.push(val);
            prev = val;
        }
    }
    return ema;
}

const sma50 = calculateSMA(quotes, 50);
const sma200 = calculateSMA(quotes, 200);
const ema20 = calculateEMA(quotes, 20);

// Calculate 20-day rolling average volume and 3-day rolling metrics
const rvol = [];
const pnl3d = [];
const vol3dRatio = [];

for (let i = 0; i < quotes.length; i++) {
    if (i < 20) {
        rvol.push(null);
        pnl3d.push(null);
        vol3dRatio.push(null);
    } else {
        let sumVol = 0;
        for (let j = 0; j < 20; j++) sumVol += quotes[i - j].volume;
        const avgVol20 = sumVol / 20;
        rvol.push(quotes[i].volume / avgVol20);

        // 3D metrics
        const pnl = ((quotes[i].close - quotes[i - 3].close) / quotes[i - 3].close) * 100;
        pnl3d.push(pnl);

        const vol3d = (quotes[i].volume + quotes[i - 1].volume + quotes[i - 2].volume) / 3;
        vol3dRatio.push(vol3d / avgVol20);
    }
}

console.log("================================================================================");
console.log("   HÄRTETEST: SERVICENOW PULLBACKS VS. CRASHS (2018 - 2026)");
console.log("   Wären wir bei normalen Dips abgeschüttelt worden? Wann wären wir 2025 raus?");
console.log("================================================================================\n");

// We analyze key historical pullbacks:
// 1. Q4 2018 Pullback (Sep - Dec 2018)
// 2. Covid Crash (Feb - Mar 2020)
// 3. Spring 2021 Tech-Dip (Feb - May 2021)
// 4. Summer 2024 Dip (Jul - Aug 2024)
// 5. The 2025/2026 Crash (Jan 2025 - Apr 2026)

const episodes = [
    { name: "1. Q4 2018 Fed-Zinsangst", start: "2018-09-01", end: "2019-01-15" },
    { name: "2. Covid-Schock 2020", start: "2020-02-01", end: "2020-04-30" },
    { name: "3. Frühjahr 2021 Tech-Rotation", start: "2021-02-01", end: "2021-05-31" },
    { name: "4. Sommer 2024 Konsolidierung", start: "2024-06-15", end: "2024-09-01" },
    { name: "5. Der Große Absturz 2025/2026", start: "2025-01-01", end: "2026-05-01" }
];

for (const ep of episodes) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`EPISODE: ${ep.name} (${ep.start} bis ${ep.end})`);
    console.log(`--------------------------------------------------------------------------------`);

    const sub = quotes.filter(q => q.date >= ep.start && q.date <= ep.end);
    let peak = sub[0];
    let trough = sub[0];

    for (const q of sub) {
        if (q.close > peak.close) peak = q;
        if (q.close < trough.close) trough = q;
    }

    const maxDD = ((trough.close - peak.close) / peak.close) * 100;
    console.log(`Hoch: ${peak.date} ($${peak.close.toFixed(2)}) -> Tief: ${trough.date} ($${trough.close.toFixed(2)}) | Max Drawdown: ${maxDD.toFixed(1)}%`);

    // Check our triggers:
    // A) 3D Dump Trigger: 3D-PnL <= -8% AND 3D-VolRatio >= 1.35x
    // B) SMA 200 Bruch: Close < SMA 200
    // C) Trockenvolumen: VolRatio <= 0.85x

    let firstDump = null;
    let firstSma200Break = null;

    for (let i = 0; i < quotes.length; i++) {
        const q = quotes[i];
        if (q.date >= ep.start && q.date <= ep.end) {
            const s200 = sma200[i];
            const p3 = pnl3d[i];
            const v3 = vol3dRatio[i];

            if (!firstDump && p3 !== null && p3 <= -8.0 && v3 >= 1.35) {
                firstDump = { date: q.date, price: q.close, pnl3d: p3.toFixed(1), vol3d: v3.toFixed(2) };
            }

            if (!firstSma200Break && s200 && q.close < s200) {
                firstSma200Break = { date: q.date, price: q.close, s200: s200.toFixed(2), diff: (((q.close - s200) / s200) * 100).toFixed(1) };
            }
        }
    }

    console.log(`  🚨 Erstes 3D-Dump Signal (PnL <= -8%, Vol >= 1.35x): ${firstDump ? `${firstDump.date} bei $${firstDump.price.toFixed(2)} (3D-PnL: ${firstDump.pnl3d}%, 3D-Vol: ${firstDump.vol3d}x)` : 'KEINES (gesundes Luftholen!)'}`);
    console.log(`  🛑 Erster SMA-200 Bruch: ${firstSma200Break ? `${firstSma200Break.date} bei $${firstSma200Break.price.toFixed(2)} (SMA200: $${firstSma200Break.s200}, Diff: ${firstSma200Break.diff}%)` : 'KEINER (Blieb über SMA 200)'}`);
}
