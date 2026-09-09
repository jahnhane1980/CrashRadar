import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data_cache');
const daily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'pltr_m5_rth_aggregated.json'), 'utf8'));

console.log("=== VERGLEICH DER TIMEFRAME-EBENEN BEI PLTR (PARABOLIK-TOP NOV 2025) ===");

// Check the critical top weeks around 2025-10-15 to 2025-12-01
const focusDays = daily.filter(d => d.date >= '2025-10-20' && d.date <= '2025-11-25');

console.log("\n1. TAGES-EBENE (D1) & M5 SESSION-FENSTER:");
focusDays.filter(d => d.close < d.open || Math.abs(d.pnlPct) >= 3.0).forEach(d => {
    console.log(`  ${d.date}: Close $${d.close.toFixed(2).padEnd(6)} (${d.pnlPct >= 0 ? '+' : ''}${d.pnlPct.toFixed(1).padEnd(5)}%) | Vol: ${(d.volume/1e6).toFixed(1)}M | OpenDelta: ${(d.openWindow.deltaPct>=0?'+':'')+d.openWindow.deltaPct.toFixed(0)}% | CloseDelta: ${(d.closeWindow.deltaPct>=0?'+':'')+d.closeWindow.deltaPct.toFixed(0)}%`);
});

console.log("\n2. ROLLIERENDE 3-TAGE-EBENE (3D-SWING):");
for (let i = 2; i < focusDays.length; i++) {
    const d3 = focusDays.slice(i - 2, i + 1);
    const pnl3d = ((d3[2].close - d3[0].open) / d3[0].open) * 100;
    const vol3d = d3.reduce((s, d) => s + d.volume, 0) / 1e6;
    const avgCloseDelta3d = d3.reduce((s, d) => s + d.closeWindow.deltaPct, 0) / 3;
    if (Math.abs(pnl3d) >= 5.0 || vol3d > 100) {
        console.log(`  3D bis ${d3[2].date}: Rendite ${pnl3d >= 0 ? '+' : ''}${pnl3d.toFixed(1)}% | 3D-Vol: ${vol3d.toFixed(0)}M | Avg CloseDelta: ${avgCloseDelta3d.toFixed(1)}%`);
    }
}
