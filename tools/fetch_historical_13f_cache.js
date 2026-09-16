import fs from 'fs';
import path from 'path';
import os from 'os';
import ky from 'ky';
import { fileURLToPath } from 'url';
import { Sec13FXmlParser } from '../src/core/parsers/Sec13FXmlParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_BASE = path.resolve(__dirname, '../data/cache/sec_13f');

const GURUS = {
    '0001536411': { name: 'Stanley Druckenmiller', fund: 'Duquesne Family Office' },
    '0001135730': { name: 'Philippe Laffont', fund: 'Coatue Management' },
    '0001167483': { name: 'Chase Coleman', fund: 'Tiger Global Management' },
    '0001656456': { name: 'David Tepper', fund: 'Appaloosa LP' },
    '0001541617': { name: 'Brad Gerstner', fund: 'Altimeter Capital Management' },
    '0001509842': { name: 'Zach Schreiber', fund: 'PointState Capital' }
};

const COMMON_START_DATE = '2016-03-31';

const SEC_HEADERS = {
    'User-Agent': 'CrashRadar Research (research@crashradar.org)',
    'Accept-Encoding': 'gzip, deflate'
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log("================================================================================");
    console.log("  CRASHRADAR: HISTORISCHER 13F LOKALER DATEICACHE (2016–2026)");
    console.log(`  Basis-Ordner: ${CACHE_BASE}`);
    console.log(`  Gemeinsamer Start: ${COMMON_START_DATE} (jüngste Entität: Appaloosa LP)`);
    console.log("================================================================================\n");

    const parser = new Sec13FXmlParser();

    if (!fs.existsSync(CACHE_BASE)) {
        fs.mkdirSync(CACHE_BASE, { recursive: true });
    }

    let totalFetched = 0;
    let totalCached = 0;

    for (const [cik, info] of Object.entries(GURUS)) {
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`🏛️ Verarbeite: ${info.name} (${info.fund}) [CIK: ${cik}]`);
        console.log(`--------------------------------------------------------------------------------`);

        const fundDir = path.join(CACHE_BASE, cik);
        if (!fs.existsSync(fundDir)) {
            fs.mkdirSync(fundDir, { recursive: true });
        }

        const paddedCik = cik.padStart(10, '0');
        const subUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
        
        let subData;
        try {
            subData = await ky.get(subUrl, { headers: SEC_HEADERS }).json();
            await wait(200);
        } catch (err) {
            console.error(`❌ Fehler beim Laden der Submissions für CIK ${cik}:`, err.message);
            continue;
        }

        const forms = subData.filings.recent.form;
        const accNos = subData.filings.recent.accessionNumber;
        const filingDates = subData.filings.recent.filingDate;
        const reportDates = subData.filings.recent.reportDate;

        // Filtere alle 13F-HR / 13F-HR/A ab COMMON_START_DATE
        // Falls für dasselbe reportDate mehrere Filings vorliegen (z.B. Amendments),
        // behalten wir das chronologisch späteste filingDate.
        const filingsByQuarter = new Map();

        for (let i = 0; i < forms.length; i++) {
            const form = forms[i];
            if (form === '13F-HR' || form === '13F-HR/A') {
                const rDate = reportDates[i];
                if (rDate >= COMMON_START_DATE) {
                    const existing = filingsByQuarter.get(rDate);
                    if (!existing || filingDates[i] > existing.filingDate) {
                        filingsByQuarter.set(rDate, {
                            accessionNumber: accNos[i],
                            filingDate: filingDates[i],
                            reportDate: rDate,
                            form: form
                        });
                    }
                }
            }
        }

        const sortedQuarters = Array.from(filingsByQuarter.keys()).sort();
        console.log(`Gefundene Ziel-Quartale: ${sortedQuarters.length} (ab ${COMMON_START_DATE})`);

        for (const qDate of sortedQuarters) {
            const filing = filingsByQuarter.get(qDate);
            const targetJsonPath = path.join(fundDir, `${qDate}.json`);

            // 1. Prüfe ob bereits lokal im Dateicache vorhanden
            if (fs.existsSync(targetJsonPath)) {
                try {
                    const cachedContent = JSON.parse(fs.readFileSync(targetJsonPath, 'utf8'));
                    if (Array.isArray(cachedContent) && cachedContent.length > 0) {
                        totalCached++;
                        process.stdout.write(`  [${qDate}] ✅ Bereits im Cache (${cachedContent.length} Pos)\n`);
                        continue;
                    }
                } catch {
                    // Falls fehlerhaft, neu herunterladen
                }
            }

            // 2. Nicht im Cache -> Hole Index JSON
            const rawCik = parseInt(cik, 10).toString();
            const accClean = filing.accessionNumber.replace(/-/g, '');
            const indexUrl = `https://www.sec.gov/Archives/edgar/data/${rawCik}/${accClean}/index.json`;

            try {
                const indexData = await ky.get(indexUrl, { headers: SEC_HEADERS }).json();
                await wait(200);

                const items = indexData.directory?.item || [];
                let xmlFileName = null;

                // Suche primäre InfoTable XML
                for (const item of items) {
                    const n = item.name.toLowerCase();
                    if (n.endsWith('.xml') && !n.includes('primary') && !n.includes('submission')) {
                        xmlFileName = item.name;
                        break;
                    }
                }

                // Fallback: Beliebige .xml außer primary
                if (!xmlFileName) {
                    for (const item of items) {
                        if (item.name.endsWith('.xml') && !item.name.toLowerCase().includes('primary')) {
                            xmlFileName = item.name;
                            break;
                        }
                    }
                }

                if (!xmlFileName) {
                    console.warn(`  ⚠️ Keine Holdings-XML gefunden in ${filing.accessionNumber} (${qDate})`);
                    continue;
                }

                // 3. XML herunterladen
                const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${rawCik}/${accClean}/${xmlFileName}`;
                const xmlText = await ky.get(xmlUrl, { headers: SEC_HEADERS }).text();
                await wait(200);

                // 4. Temporäre Datei schreiben & parsen
                const tempXmlPath = path.join(os.tmpdir(), `cache_13f_${cik}_${qDate}_${Date.now()}.xml`);
                fs.writeFileSync(tempXmlPath, xmlText, 'utf8');

                try {
                    const parsedHoldings = await parser.parseStream(tempXmlPath, {
                        cik: cik,
                        reportDate: filing.reportDate,
                        filingDate: filing.filingDate
                    });

                    // 5. In lokalen JSON-Dateicache speichern
                    fs.writeFileSync(targetJsonPath, JSON.stringify(parsedHoldings, null, 2), 'utf8');
                    totalFetched++;
                    console.log(`  [${qDate}] 💾 Neu gespeichert: ${parsedHoldings.length} Positionen (${filing.form}, ${filing.filingDate})`);
                } finally {
                    if (fs.existsSync(tempXmlPath)) {
                        fs.unlinkSync(tempXmlPath);
                    }
                }

            } catch (err) {
                console.error(`  ❌ Fehler bei Filing ${qDate} (${filing.accessionNumber}):`, err.message);
                await wait(1000);
            }
        }
        console.log("");
    }

    console.log("================================================================================");
    console.log(`🎉 FERTIG! Neu geholt: ${totalFetched} Quartale | Bereits gecacht: ${totalCached} Quartale`);
    console.log(`Dateicache-Verzeichnis: ${CACHE_BASE}`);
    console.log("================================================================================");
}

main().catch(err => console.error("Globaler Fehler:", err));
