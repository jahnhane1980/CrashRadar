import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, '../architecture/strategies/cache/ark_filings');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const SEC_HEADERS = {
    'User-Agent': 'CrashRadar Research research@crashradar.org',
    'Accept-Encoding': 'gzip, deflate'
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Fetch directory index of an EDGAR accession folder to find infotable.xml or form13fInfoTable.xml
 */
async function get13FXmlUrl(cik, accNum) {
    const accClean = accNum.replace(/-/g, '');
    const idxUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accClean}/index.json`;
    const res = await fetch(idxUrl, { headers: SEC_HEADERS });
    if (!res.ok) {
        throw new Error(`Failed to fetch index.json for ${accNum}: HTTP ${res.status}`);
    }
    const data = await res.json();
    const items = data.directory.item || [];
    
    // Look for infotable.xml or form13fInfoTable.xml
    const tableItem = items.find(i => {
        const name = i.name.toLowerCase();
        return (name.includes('infotable') || name.includes('form13f')) && name.endsWith('.xml') && !name.includes('primary');
    });

    if (!tableItem) {
        throw new Error(`No infotable.xml found in ${accNum}`);
    }

    return `https://www.sec.gov/Archives/edgar/data/${cik}/${accClean}/${tableItem.name}`;
}

/**
 * Parse 13F InfoTable XML
 */
function parse13FXml(xmlText) {
    const entries = xmlText.match(/<infoTable[\s\S]*?<\/infoTable>/gi) || [];
    const holdings = [];

    for (const e of entries) {
        const name = /<nameOfIssuer>([^<]+)<\/nameOfIssuer>/i.exec(e)?.[1]?.trim();
        const titleOfClass = /<titleOfClass>([^<]+)<\/titleOfClass>/i.exec(e)?.[1]?.trim();
        const cusip = /<cusip>([^<]+)<\/cusip>/i.exec(e)?.[1]?.trim();
        const valStr = /<value>([^<]+)<\/value>/i.exec(e)?.[1]?.trim();
        const sharesStr = /<sshPrnamt>([^<]+)<\/sshPrnamt>/i.exec(e)?.[1]?.trim();

        if (name && valStr) {
            const value_k = parseInt(valStr, 10) || 0;
            const shares = parseInt(sharesStr, 10) || 0;
            holdings.push({
                name,
                titleOfClass,
                cusip,
                value_k,
                value_usd: value_k * 1000,
                shares
            });
        }
    }

    return holdings;
}

/**
 * Fetch and parse all 13F filings (2016-12-31 to 2026-06-30)
 */
async function fetchAll13FFilings() {
    console.log("================================================================================");
    console.log("   STEP 1A: ARK 13F-FILINGS (2016-12-31 BIS 2026-06-30) ABRUFEN");
    console.log("================================================================================\n");

    const cik = '1697748';
    const subUrl = `https://data.sec.gov/submissions/CIK0001697748.json`;
    const res = await fetch(subUrl, { headers: SEC_HEADERS });
    const subData = await res.json();
    const filings = subData.filings.recent;

    const list = [];
    for (let i = 0; i < filings.form.length; i++) {
        if (filings.form[i].startsWith('13F-HR')) {
            list.push({
                form: filings.form[i],
                filingDate: filings.filingDate[i],
                reportDate: filings.reportDate[i],
                accessionNumber: filings.accessionNumber[i]
            });
        }
    }

    list.sort((a, b) => a.reportDate.localeCompare(b.reportDate));
    console.log(`Gefundene 13F-HR Filings: ${list.length}`);

    const parsedFilings = [];

    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const cacheFile = path.join(CACHE_DIR, `13f_${item.reportDate}.json`);

        if (fs.existsSync(cacheFile)) {
            const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            console.log(`[CACHE HIT] ${item.reportDate} (Filing: ${item.filingDate}) - ${cached.holdings.length} Positionen.`);
            parsedFilings.push(cached);
            continue;
        }

        console.log(`[FETCH SEC] ${item.reportDate} (Filing: ${item.filingDate}, Acc: ${item.accessionNumber})...`);
        try {
            await delay(200); // Respect rate limit
            const xmlUrl = await get13FXmlUrl(cik, item.accessionNumber);
            await delay(200);
            const xmlRes = await fetch(xmlUrl, { headers: SEC_HEADERS });
            const xmlText = await xmlRes.text();
            const holdings = parse13FXml(xmlText);

            const filingObj = {
                source: '13F-HR',
                cik,
                reportDate: item.reportDate,
                filingDate: item.filingDate,
                accessionNumber: item.accessionNumber,
                totalValue_usd: holdings.reduce((sum, h) => sum + h.value_usd, 0),
                holdings
            };

            fs.writeFileSync(cacheFile, JSON.stringify(filingObj, null, 2));
            console.log(`  -> Gespeichert: ${holdings.length} Positionen (Gesamtwert: $ ${(filingObj.totalValue_usd / 1e6).toFixed(1)}M).`);
            parsedFilings.push(filingObj);
        } catch (e) {
            console.error(`  -> FEHLER bei ${item.reportDate}:`, e.message);
        }
    }

    return parsedFilings;
}

/**
 * Fetch and parse early filings (2014-10-31 to 2016-11-30) from ARK ETF Trust (CIK 0001579982)
 */
async function fetchAllEarlyFilings() {
    console.log("\n================================================================================");
    console.log("   STEP 1B: ARK ETF TRUST FILINGS (2014-10-31 BIS 2016-11-30) ABRUFEN");
    console.log("================================================================================\n");

    const cik = '1579982';
    const subUrl = `https://data.sec.gov/submissions/CIK0001579982.json`;
    const res = await fetch(subUrl, { headers: SEC_HEADERS });
    const subData = await res.json();
    const filings = subData.filings.recent;

    const earlyList = [];
    for (let i = 0; i < filings.form.length; i++) {
        const form = filings.form[i];
        const fDate = filings.filingDate[i];
        const rDate = filings.reportDate[i];
        const accNum = filings.accessionNumber[i];
        const doc = filings.primaryDocument[i];

        if (fDate <= '2017-04-30' && (form.includes('N-Q') || form.includes('CSR'))) {
            earlyList.push({ form, filingDate: fDate, reportDate: rDate, accessionNumber: accNum, doc });
        }
    }

    earlyList.sort((a, b) => a.reportDate.localeCompare(b.reportDate));
    console.log(`Gefundene Early Filings (N-Q / N-CSR): ${earlyList.length}`);

    const parsedEarly = [];

    for (const item of earlyList) {
        const cacheFile = path.join(CACHE_DIR, `trust_${item.reportDate}.json`);
        if (fs.existsSync(cacheFile)) {
            const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            console.log(`[CACHE HIT] ${item.reportDate} (${item.form}) - ${cached.holdings.length} Positionen.`);
            parsedEarly.push(cached);
            continue;
        }

        console.log(`[FETCH SEC] ${item.reportDate} (${item.form}, Acc: ${item.accessionNumber})...`);
        try {
            await delay(250);
            const accClean = item.accessionNumber.replace(/-/g, '');
            const docUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accClean}/${item.doc}`;
            const docRes = await fetch(docUrl, { headers: SEC_HEADERS });
            const html = await docRes.text();

            // Extract schedule of investments rows
            const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
            const holdings = [];
            const seenNames = new Set();

            for (const row of rows) {
                const cells = (row.match(/<td[\s\S]*?<\/td>/gi) || [])
                    .map(td => td.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
                    .filter(c => c.length > 0);

                if (cells.length >= 2) {
                    const name = cells[0];
                    if (
                        name.includes('COMMON STOCKS') ||
                        name.includes('Total ') ||
                        name.includes('Investments') ||
                        name.includes('%') ||
                        name.includes('Cost $') ||
                        name.length < 3
                    ) {
                        continue;
                    }

                    // Look for share counts and dollar values
                    const nums = cells.slice(1).map(c => {
                        const clean = c.replace(/[$,()]/g, '').trim();
                        return /^[0-9]+$/.test(clean) ? parseInt(clean, 10) : null;
                    }).filter(n => n !== null);

                    if (nums.length >= 2) {
                        const shares = nums[0];
                        const val = nums[nums.length - 1]; // Value is typically the last column
                        const cleanName = name.replace(/\*|\(a\)|\(The\)|\(b\)/g, '').trim();
                        if (!seenNames.has(cleanName) && val > 1000) {
                            seenNames.add(cleanName);
                            holdings.push({
                                name: cleanName,
                                cusip: null,
                                value_usd: val,
                                shares
                            });
                        }
                    }
                }
            }

            const filingObj = {
                source: item.form,
                cik,
                reportDate: item.reportDate,
                filingDate: item.filingDate,
                accessionNumber: item.accessionNumber,
                totalValue_usd: holdings.reduce((sum, h) => sum + h.value_usd, 0),
                holdings
            };

            fs.writeFileSync(cacheFile, JSON.stringify(filingObj, null, 2));
            console.log(`  -> Gespeichert: ${holdings.length} Positionen ($ ${(filingObj.totalValue_usd / 1e6).toFixed(1)}M).`);
            parsedEarly.push(filingObj);
        } catch (e) {
            console.error(`  -> FEHLER bei ${item.reportDate}:`, e.message);
        }
    }

    return parsedEarly;
}

async function run() {
    const filings13F = await fetchAll13FFilings();
    const filingsEarly = await fetchAllEarlyFilings();

    console.log("\n================================================================================");
    console.log(`[ABSCHLUSS] Insgesamt ${filingsEarly.length + filings13F.length} Berichte erfolgreich gecacht.`);
    console.log(`  - 2014-2016 Early Fund Filings: ${filingsEarly.length}`);
    console.log(`  - 2016-2026 Form 13F-HR Filings: ${filings13F.length}`);
    console.log("================================================================================\n");
}

run().catch(console.error);
