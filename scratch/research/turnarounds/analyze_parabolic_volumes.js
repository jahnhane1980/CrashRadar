import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

function analyzeCorrectionsForSymbol(symbol) {
    const file = path.join(CACHE_DIR, `${symbol.toLowerCase()}_m5_rth_aggregated.json`);
    if (!fs.existsSync(file)) return null;

    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.length < 50) return null;

    let curPeak = data[0].high;
    let curPeakIdx = 0;
    let inPullback = false;
    let pbStartIdx = 0;
    let pbLow = data[0].low;
    let pbLowIdx = 0;
    const pullbacks = [];

    for (let i = 1; i < data.length; i++) {
        const day = data[i];
        if (day.high > curPeak && !inPullback) {
            curPeak = day.high;
            curPeakIdx = i;
        } else {
            const dd = ((day.close - curPeak) / curPeak) * 100;
            if (dd <= -10.0 && !inPullback) {
                inPullback = true;
                pbStartIdx = curPeakIdx;
                pbLow = day.low;
                pbLowIdx = i;
            } else if (inPullback) {
                if (day.low < pbLow) {
                    pbLow = day.low;
                    pbLowIdx = i;
                }
                if (day.high > curPeak) {
                    pullbacks.push({
                        symbol,
                        peakDate: data[pbStartIdx].date,
                        peakPrice: curPeak,
                        troughDate: data[pbLowIdx].date,
                        troughPrice: pbLow,
                        depthPct: parseFloat((((pbLow - curPeak) / curPeak) * 100).toFixed(1)),
                        daysToTrough: pbLowIdx - pbStartIdx,
                        peakIdx: pbStartIdx,
                        troughIdx: pbLowIdx,
                        reboundIdx: i
                    });
                    inPullback = false;
                    curPeak = day.high;
                    curPeakIdx = i;
                }
            }
        }
    }

    if (inPullback) {
        pullbacks.push({
            symbol,
            peakDate: data[pbStartIdx].date,
            peakPrice: curPeak,
            troughDate: data[pbLowIdx].date,
            troughPrice: pbLow,
            depthPct: parseFloat((((pbLow - curPeak) / curPeak) * 100).toFixed(1)),
            daysToTrough: pbLowIdx - pbStartIdx,
            peakIdx: pbStartIdx,
            troughIdx: pbLowIdx,
            reboundIdx: data.length - 1
        });
    }

    return pullbacks.map(pb => {
        const runupStart = Math.max(0, pb.peakIdx - 20);
        const runupDays = data.slice(runupStart, pb.peakIdx + 1);
        const avgRunupVol = runupDays.reduce((s, d) => s + d.volume, 0) / Math.max(1, runupDays.length);

        const pbDays = data.slice(pb.peakIdx + 1, pb.troughIdx + 1);
        const avgPbVol = pbDays.length > 0 ? pbDays.reduce((s, d) => s + d.volume, 0) / pbDays.length : 0;
        const pbVolRatio = avgRunupVol > 0 ? (avgPbVol / avgRunupVol) : 1.0;

        let totalOpenDelta = 0, totalCloseDelta = 0, openVolShare = 0, closeVolShare = 0;
        for (const d of pbDays) {
            totalOpenDelta += d.openWindow.deltaPct;
            totalCloseDelta += d.closeWindow.deltaPct;
            openVolShare += d.openWindow.volPct;
            closeVolShare += d.closeWindow.volPct;
        }

        const avgOpenDelta = pbDays.length > 0 ? totalOpenDelta / pbDays.length : 0;
        const avgCloseDelta = pbDays.length > 0 ? totalCloseDelta / pbDays.length : 0;
        const avgOpenVolShare = pbDays.length > 0 ? openVolShare / pbDays.length : 0;
        const avgCloseVolShare = pbDays.length > 0 ? closeVolShare / pbDays.length : 0;

        let charakter = '⚡ KONSOLIDIERUNG';
        if (pbVolRatio < 0.85 && avgCloseDelta >= -5.0) {
            charakter = '✅ GESUNDER DIP (Hold!)';
        } else if (pbVolRatio > 1.25 || avgCloseDelta < -15.0) {
            charakter = '⚠️ INSTITUTIONELLER DUMP';
        }

        return {
            symbol: pb.symbol,
            peak: `${pb.peakDate} ($${pb.peakPrice.toFixed(2)})`,
            trough: `${pb.troughDate} ($${pb.troughPrice.toFixed(2)})`,
            depth: `${pb.depthPct} %`,
            days: `${pb.daysToTrough}d`,
            volRatio: `${pbVolRatio.toFixed(2)}x`,
            openDelta: `${avgOpenDelta >= 0 ? '+' : ''}${avgOpenDelta.toFixed(1)} %`,
            closeDelta: `${avgCloseDelta >= 0 ? '+' : ''}${avgCloseDelta.toFixed(1)} %`,
            openShare: `${avgOpenVolShare.toFixed(0)} %`,
            closeShare: `${avgCloseVolShare.toFixed(0)} %`,
            charakter
        };
    });
}

function runAll() {
    console.log("================================================================================");
    console.log("   SYSTEMATISCHE PARABOLISCHE VOLUMEN-ANALYSE ÜBER ALLE WACHSTUMSAKTIEN");
    console.log("   Ticker: PLTR, NVTS, IBRX, SOFI, S");
    console.log("================================================================================\n");

    const symbols = ['PLTR', 'NVTS', 'IBRX', 'SOFI', 'S'];
    const resultsBySymbol = {};

    for (const sym of symbols) {
        const pbs = analyzeCorrectionsForSymbol(sym);
        resultsBySymbol[sym] = pbs;

        console.log(`\n--------------------------------------------------------------------------------`);
        console.log(`   ${sym}: KORREKTUREN & VOLUMEN-DYNAMIK (${pbs.length} PHASEN)`);
        console.log(`--------------------------------------------------------------------------------`);
        console.table(pbs.map(p => ({
            Korrektur: `${p.peak} -> ${p.trough}`,
            Tiefe: p.depth,
            Dauer: p.days,
            VolRatio: p.volRatio,
            OpenDelta: p.openDelta,
            CloseDelta: p.closeDelta,
            Charakter: p.charakter
        })));
    }

    fs.writeFileSync(path.join(CACHE_DIR, 'all_symbols_parabolic_corrections.json'), JSON.stringify(resultsBySymbol, null, 2));
}

runAll();
