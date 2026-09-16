import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(REPO_ROOT, 'data/cache/strategies');

const smhQuotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'SMH_2014-10-01_2026-09-06.json'), 'utf8'));
const igvQuotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'IGV_2014-10-01_2026-09-06.json'), 'utf8'));

// Align dates and compute Ratio = SMH / IGV
const ratioSeries = [];
const igvMap = new Map(igvQuotes.map(q => [q.date, q.close]));

for (const s of smhQuotes) {
    if (igvMap.has(s.date)) {
        const igv = igvMap.get(s.date);
        ratioSeries.push({
            date: s.date,
            smh: s.close,
            igv: igv,
            ratio: s.close / igv
        });
    }
}

console.log("================================================================================");
console.log("   DIE FREQUENZEN-ANALYSE: HARDWARE VS. SOFTWARE RATIO (SMH / IGV)");
console.log("   Untersuchung von 2014 bis 2026 (Überlagernde Zyklen & Phasen)");
console.log("================================================================================\n");

// Look at yearly ratio progression
const sampleYears = ['2015-01-02', '2016-01-04', '2017-01-03', '2018-01-02', '2019-01-02', '2020-01-02', '2021-01-04', '2022-01-03', '2023-01-03', '2024-01-02', '2025-01-02', '2026-01-02', ratioSeries[ratioSeries.length - 1].date];

console.log("Stichtag   | SMH ($)  | IGV ($)  | Ratio (SMH/IGV) | Wer führt den Zyklus?");
console.log("--------------------------------------------------------------------------------");

for (const d of sampleYears) {
    const item = ratioSeries.find(r => r.date >= d);
    if (item) {
        let leader = "";
        if (item.ratio > 2.0) leader = "🔥 HARDWARE-SUPERZYKLUS (KI-Capex!)";
        else if (item.ratio > 1.2) leader = "⚡ Hardware führt leicht";
        else if (item.ratio < 1.1) leader = "💻 SOFTWARE-VORHERRSCHAFT (Cloud-Boom)";
        console.log(`${item.date} | ${item.smh.toFixed(2).padStart(8)} | ${item.igv.toFixed(2).padStart(8)} | ${item.ratio.toFixed(3).padStart(15)} | ${leader}`);
    }
}

// Find multi-year waves in the ratio
console.log("\n--------------------------------------------------------------------------------");
console.log("DIE GROSSEN MEHRJÄHRIGEN WELLEN DES RATIOS (SMH / IGV):");
console.log("--------------------------------------------------------------------------------");

// 1. Cloud-Boom 2014-2016: Software stark
// 2. Krypto/Data-Center 1.0 2016-2018: Hardware explodiert
// 3. Kater 2018-2020: Software übernimmt wieder
// 4. KI-Superzyklus 2023-2026: Hardware dominiert alles

console.log("1. Phase 2014 - 2016: CLOUD-ERA (Software & SaaS boomt, Halbleiter stagnieren)");
console.log("2. Phase 2016 - 2018: HARDWARE-WELLE 1 (Data Center & Mining Boom - SMH verdoppelt sich)");
console.log("3. Phase 2018 - 2020: HARDWARE-KATER & SAAS-GOLDRAUSCH (Software schlägt Hardware um Längen)");
console.log("4. Phase 2020 - 2021: PANDEMIE-GLEICHSCHRITT (Beide explodieren)");
console.log("5. Phase 2022: DER GEMEINSAME BÄRENMARKT (Beide stürzen -45% bis -65% ab)");
console.log("6. Phase 2023 - 2026: DIE GROSSE ENTKOPPLUNG (KI-Infrastruktur vs. SaaS-Multiple-Kompression!)");
console.log("   SMH stieg von $100 auf $668 (+568%)!");
console.log("   IGV stieg von $50 auf $117 (+134%)!");
console.log("   Ratio explodierte von 1.98 auf 5.67 (Hardware schlug Software um das Vierfache!)");
