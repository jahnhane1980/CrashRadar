import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

const symbols = ['PLTR', 'NVTS', 'IBRX', 'SOFI', 'S'];

function runPyramidAnalysis() {
    console.log("================================================================================");
    console.log("   MULTI-TIMEFRAME-PYRAMIDEN-ANALYSE (M5 -> D1 -> 3D -> W1 -> M1)");
    console.log("   Ticker: PLTR, NVTS, IBRX, SOFI, S");
    console.log("================================================================================\n");

    const comparativeInsights = [];

    for (const sym of symbols) {
        const file = path.join(CACHE_DIR, `${sym.toLowerCase()}_m5_rth_aggregated.json`);
        if (!fs.existsSync(file)) continue;
        const daily = JSON.parse(fs.readFileSync(file, 'utf8'));

        // 1. Calculate 3D rolling windows
        let count3dEarlyAlerts = 0;
        let count3dConfirmations = 0;
        const topDumps = [];

        for (let i = 2; i < daily.length; i++) {
            const d3 = daily.slice(i - 2, i + 1);
            const pnl3d = ((d3[2].close - d3[0].open) / d3[0].open) * 100;
            const vol3d = d3.reduce((s, d) => s + d.volume, 0);

            // Compare with rolling 20d average 3D volume
            const lookbackStart = Math.max(0, i - 20);
            const lookbackDays = daily.slice(lookbackStart, i - 1);
            const avgDailyVol = lookbackDays.reduce((s, d) => s + d.volume, 0) / Math.max(1, lookbackDays.length);
            const exp3dVol = avgDailyVol * 3;
            const vol3dRatio = exp3dVol > 0 ? (vol3d / exp3dVol) : 1.0;

            const avgCloseDelta = d3.reduce((s, d) => s + d.closeWindow.deltaPct, 0) / 3;

            // 3D Institutional Dump Signal:
            // 3D PnL <= -8%, 3D Volume >= 1.25x average, and Close Delta negative
            if (pnl3d <= -8.0 && vol3dRatio >= 1.25 && avgCloseDelta < 0) {
                count3dEarlyAlerts++;
                const dObj = new Date(d3[2].date);
                const dayOfWeek = dObj.getDay(); // 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri
                const dayName = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][dayOfWeek];

                topDumps.push({
                    date: d3[2].date,
                    dayName,
                    pnl3d: parseFloat(pnl3d.toFixed(1)),
                    vol3dRatio: parseFloat(vol3dRatio.toFixed(2)),
                    avgCloseDelta: parseFloat(avgCloseDelta.toFixed(1)),
                    leadTimeDays: 5 - dayOfWeek // Days ahead of Friday weekly close
                });
            }
        }

        // Summary metric for symbol
        const midWeekAlerts = topDumps.filter(d => d.leadTimeDays > 0); // Triggered Mo-Do (before Friday)
        const avgLeadTime = midWeekAlerts.length > 0 
            ? (midWeekAlerts.reduce((s, d) => s + d.leadTimeDays, 0) / midWeekAlerts.length).toFixed(1)
            : '0';

        comparativeInsights.push({
            Symbol: sym,
            TageGesamt: daily.length,
            DumpSignale3D: topDumps.length,
            VorWochenschluss: midWeekAlerts.length,
            MittlererZeitvorteil: `${avgLeadTime} Tage vor Fr.`,
            M5_OpenVolShare: `${(daily.reduce((s, d) => s + d.openWindow.volPct, 0) / daily.length).toFixed(1)} %`,
            M5_CloseVolShare: `${(daily.reduce((s, d) => s + d.closeWindow.volPct, 0) / daily.length).toFixed(1)} %`,
            IntradayAnteil: `${((daily.reduce((s, d) => s + d.openWindow.volPct + d.closeWindow.volPct, 0) / daily.length)).toFixed(1)} %`
        });

        console.log(`\n--------------------------------------------------------------------------------`);
        console.log(`   ${sym}: Die Top 3D-Rolling Dump-Signale (Zeitvorteil gegenüber Wochenkerze W1)`);
        console.log(`--------------------------------------------------------------------------------`);
        console.table(topDumps.slice(0, 5).map(t => ({
            Datum: `${t.date} (${t.dayName})`,
            '3D-Rendite': `${t.pnl3d} %`,
            '3D-Volumen': `${t.vol3dRatio}x`,
            'Close-Delta': `${t.avgCloseDelta} %`,
            'Vorsprung vor Wochenschluss': `${t.leadTimeDays} Tage früher`
        })));
    }

    console.log("\n================================================================================");
    console.log("   GESAMT-VERGLEICH DER MULTI-TIMEFRAME-PYRAMIDE");
    console.log("================================================================================");
    console.table(comparativeInsights);

    fs.writeFileSync(path.join(CACHE_DIR, 'mtf_pyramid_comparative_summary.json'), JSON.stringify(comparativeInsights, null, 2));
}

runPyramidAnalysis();
