import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, '../architecture/strategies/cache/ark_filings');
const OUT_FILE = path.resolve(__dirname, '../architecture/strategies/cache/ark_historical_watchlist_2014_2026.json');

// Master dictionary of known ARK companies to ticker (will be matched longest-first)
const KNOWN_TICKERS = {
    // Top Tech & ARK Icons
    'TESLA': 'TSLA',
    'NVIDIA': 'NVDA',
    'AMAZON': 'AMZN',
    'NETFLIX': 'NFLX',
    'ALPHABET': 'GOOGL',
    'GOOGLE': 'GOOGL',
    'FACEBOOK': 'META',
    'META PLATFORMS': 'META',
    'SHOPIFY': 'SHOP',
    'BLOCK INC': 'SQ',
    'SQUARE': 'SQ',
    'ROKU': 'ROKU',
    'TELADOC': 'TDOC',
    'ZOOM VIDEO': 'ZM',
    'PALANTIR': 'PLTR',
    'COINBASE': 'COIN',
    'ROBINHOOD': 'HOOD',
    'TWITTER': 'TWTR',
    'SPOTIFY': 'SPOT',
    'UIPATH': 'PATH',
    'UNITY SOFTWARE': 'U',
    'DRAFTKINGS': 'DKNG',
    'SEA LTD': 'SE',
    'TWILIO': 'TWLO',
    'DOCUSIGN': 'DOCU',
    'OKTA': 'OKTA',
    'ZSCALER': 'ZS',
    'CROWDSTRIKE': 'CRWD',
    'DATADOG': 'DDOG',
    'CLOUDFLARE': 'NET',
    'SNOWFLAKE': 'SNOW',
    'PINTEREST': 'PINS',
    'SNAP INC': 'SNAP',
    'FASTLY': 'FSLY',
    'BEYOND MEAT': 'BYND',

    // Biotech & Genomics (ARKG)
    'CRISPR THERAPEUTICS': 'CRSP',
    'EXACT SCIENCES': 'EXAS',
    'ILLUMINA': 'ILMN',
    'TWIST BIOSCIENCE': 'TWST',
    'PACIFIC BIOSCIENCES': 'PACB',
    'BEAM THERAPEUTICS': 'BEAM',
    'INTELLIA THERAPEUTICS': 'NTLA',
    'EDITAS MEDICINE': 'EDIT',
    'BIONTECH': 'BNTX',
    'MODERNA': 'MRNA',
    'COMPUGEN': 'CGEN',
    'FATE THERAPEUTICS': 'FATE',
    'VERVE THERAPEUTICS': 'VERV',
    'IONIS PHARMACEUTICALS': 'IONS',
    'ALNYLAM PHARMACEUTICALS': 'ALNY',
    'BLUEBIRD BIO': 'BLUE',
    'IOVANCE BIOTHERAPEUTICS': 'IOVA',
    'CARETX': 'CRTX',
    'ADAPTIVE BIOTECHNOLOGIES': 'ADPT',
    'INCYTE': 'INCY',
    'REGENERON': 'REGN',
    'VERTEX PHARMACEUTICALS': 'VRTX',
    'BIOGEN': 'BIIB',
    '10X GENOMICS': 'TXG',
    'SCHRODINGER': 'SDGR',
    'RECURSION PHARMACEUTICALS': 'RXRX',
    'GINKGO BIOWORKS': 'DNA',
    'PERSONALIS': 'PSNL',
    'INVITAE': 'NVTA',
    'BERKELEY LIGHTS': 'BLI',
    'NANOSTRING': 'NSTG',
    'CAREDX': 'CDNA',
    'TANDEM DIABETES': 'TNDM',

    // 3D Printing & Industrial Innovation (ARKQ / 2014-2016 focus)
    'STRATASYS': 'SSYS',
    '3-D SYS': 'DDD',
    '3D SYSTEMS': 'DDD',
    'MATERIALISE': 'MTLS',
    'EXONE': 'XONE',
    'PROTO LABS': 'PRLB',
    'ORGANOVO': 'ONVO',
    'IROBOT': 'IRBT',
    'COGNEX': 'CGNX',
    'MOBILEYE': 'MBLY',
    'AEROVIRONMENT': 'AVAV',
    'TRIMBLE': 'TRMB',
    'FARO TECHNOLOGIES': 'FARO',
    'TERADYNE': 'TER',
    'KUKA': 'KU2',
    'FANUC': '6954.T',

    // Megacap & Early ARK Picks
    'APPLE': 'AAPL',
    'MICROSOFT': 'MSFT',
    'TAIWAN SEMICONDUCTOR': 'TSM',
    'BAIDU': 'BIDU',
    'TENCENT': 'TCEHY',
    'ALIBABA': 'BABA',
    'MERCADOLIBRE': 'MELI',
    'SALESFORCE': 'CRM',
    'AUTODESK': 'ADSK',
    'INTUITIVE SURGICAL': 'ISRG',
    'INTUIT INC': 'INTU',
    'INTUIT COM': 'INTU',
    'INTUIT ': 'INTU',
    'WORKDAY': 'WDAY',
    'SPLUNK': 'SPLK',
    'RED HAT': 'RHT',
    'SERVICENOW': 'NOW',
    'TABLEAU': 'DATA',
    'NETSUITE': 'N',
    'ATHENAHEALTH': 'ATHN',
    'MEDIDATA': 'MDSO',
    'CEPHEID': 'CPHD',
    'FOUNDATION MEDICINE': 'FMI',
    'LINKEDIN': 'LNKD',
    'YELP': 'YELP',
    'ZILLOW': 'Z',
    'WALT DISNEY': 'DIS',
    'LENDINGCLUB': 'LC',
    'ALIGN TECHNOLOGY': 'ALGN',
    'NXP SEMICONDUCTOR': 'NXPI',
    'QUALCOMM': 'QCOM',
    'BROADCOM': 'AVGO',
    'MONSANTO': 'MON',
    'CHARLES SCHWAB': 'SCHW',
    'PALO ALTO NETWORKS': 'PANW',
    'DEERE': 'DE',
    'ROCKWELL AUTOMATION': 'ROK',
    'ALBEMARLE': 'ALB',
    'DELPHI AUTOMOTIVE': 'DLPH',
    'AUTOLIV': 'ALV',
    'ORBITAL SCIENCES': 'ORB',
    'ELBIT SYSTEMS': 'ESLT',
    'CRAY': 'CRAY',
    'ANSYS': 'ANSS',
    'DASSAULT SYSTEMES': 'DSY',
    'ARM HOLDINGS': 'ARM',
    'CREE INC': 'WOLF',
    'CVD EQUIPMENT': 'CVV',
    'CALAMP': 'CAMP',
    'ACCURAY': 'ARAY',
    'MAZOR ROBOTICS': 'MZOR',
    'REWALK ROBOTICS': 'LFWD',
    'RAVEN INDUSTRIES': 'RAVN',
    'CORNERSTONE ONDEMAND': 'CSOD',
    'ADEPT TECHNOLOGY': 'ADEP',
    'MANPOWERGROUP': 'MAN',
    'ROBERT HALF': 'RHI',
    'CTRIP': 'TCOM',
    'PRICELINE': 'BKNG',
    'BOOKING HOLDINGS': 'BKNG',
    'AKAMAI TECHNOLOGIES': 'AKAM',
    'AVIS BUDGET': 'CAR',
    'GENESIS HEALTHCARE': 'GEN',
    'DEVRY': 'ATGE',
    'POLYPORE': 'PPO',
    'CERUS': 'CERS',
    'ALLIED MOTION': 'ALIM',
    'THERMO FISHER': 'TMO'
};

// Sort lookup keys by length descending to prevent sub-string false matches
const SORTED_KEYS = Object.keys(KNOWN_TICKERS).sort((a, b) => b.length - a.length);

function resolveTicker(name) {
    if (!name) return null;
    const upper = name.toUpperCase();
    for (const key of SORTED_KEYS) {
        if (upper.includes(key)) {
            return KNOWN_TICKERS[key];
        }
    }
    return null;
}

function buildHistoricalWatchlist() {
    console.log("================================================================================");
    console.log("   AUFBAU DER HISTORISCHEN ARK-WATCHLIST (2014-2026)");
    console.log("================================================================================\n");

    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    console.log(`Lese ${files.length} gecachte Berichte aus ${CACHE_DIR}...`);

    const allFilings = [];
    for (const file of files) {
        const fullPath = path.join(CACHE_DIR, file);
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        allFilings.push(data);
    }

    // Sort chronologically by reportDate
    allFilings.sort((a, b) => a.reportDate.localeCompare(b.reportDate));

    // Fix 13F values (pre-2023 were $k, post-2022 were $1)
    for (const f of allFilings) {
        if (f.source === '13F-HR') {
            const isPre2023 = f.reportDate < '2022-12-31';
            for (const h of f.holdings) {
                if (isPre2023) {
                    h.clean_value_usd = h.value_k * 1000;
                } else {
                    h.clean_value_usd = h.value_k; // in 2023+ it's already in $
                }
            }
        } else {
            for (const h of f.holdings) {
                h.clean_value_usd = h.value_usd || 0;
            }
        }

        // Recalculate total value
        f.clean_total_value_usd = f.holdings.reduce((sum, h) => sum + (h.clean_value_usd || 0), 0);

        // Calculate portfolio weights
        for (const h of f.holdings) {
            h.weight_pct = f.clean_total_value_usd > 0
                ? parseFloat(((h.clean_value_usd / f.clean_total_value_usd) * 100).toFixed(3))
                : 0;
            h.ticker = resolveTicker(h.name);
        }
    }

    console.log(`Verarbeitet: ${allFilings.length} Quartalsberichte von ${allFilings[0].reportDate} bis ${allFilings[allFilings.length - 1].reportDate}.`);

    // Aggregate by stock / ticker
    const stockMap = {};

    for (const f of allFilings) {
        const date = f.reportDate;
        for (const h of f.holdings) {
            const ticker = h.ticker || h.name.toUpperCase();
            if (!stockMap[ticker]) {
                stockMap[ticker] = {
                    ticker: h.ticker || null,
                    name: h.name,
                    cusip: h.cusip || null,
                    firstSeenDate: date,
                    lastSeenDate: date,
                    quartersHeld: 0,
                    maxWeightPct: 0,
                    history: []
                };
            }

            const sm = stockMap[ticker];
            sm.lastSeenDate = date;
            sm.quartersHeld++;
            if (h.weight_pct > sm.maxWeightPct) sm.maxWeightPct = h.weight_pct;
            sm.history.push({
                reportDate: date,
                weight_pct: h.weight_pct,
                value_usd: h.clean_value_usd,
                shares: h.shares
            });
        }
    }

    // Convert to sorted array
    const stockList = Object.values(stockMap);
    stockList.sort((a, b) => b.quartersHeld - a.quartersHeld || b.maxWeightPct - a.maxWeightPct);

    console.log(`\nGesamtzahl einzigartiger Positionen (2014-2026): ${stockList.length}`);
    console.log(`Davon mit bekanntem Ticker zugeordnet: ${stockList.filter(s => s.ticker).length}`);

    console.log("\nTop 35 Kern-Aktien von Cathie Wood über 11,5 Jahre hinweg (nach Quartals-Präsenz):");
    console.log("---------------------------------------------------------------------------------------------------------");
    console.log("Ticker | Name                             | First Seen | Last Seen  | Quarters | Max Weight %");
    console.log("---------------------------------------------------------------------------------------------------------");
    for (const s of stockList.filter(s => s.ticker).slice(0, 35)) {
        console.log(
            `${(s.ticker || 'N/A').padEnd(6)} | ` +
            `${s.name.substring(0, 32).padEnd(32)} | ` +
            `${s.firstSeenDate} | ` +
            `${s.lastSeenDate} | ` +
            `${String(s.quartersHeld).padStart(8)} | ` +
            `${s.maxWeightPct.toFixed(2).padStart(11)} %`
        );
    }

    // Show stocks that entered specifically in 2014-2016 (Early ARK Watchlist era)
    const earlyStocks = stockList.filter(s => s.firstSeenDate <= '2016-12-31' && s.ticker);
    console.log(`\nAktien, die bereits 2014-2016 auf Cathie Woods Watchlist standen (${earlyStocks.length} Titel):`);
    console.log(earlyStocks.map(s => `${s.ticker} (${s.firstSeenDate})`).join(', '));

    // Save final unified watchlist
    const outputData = {
        meta: {
            title: "ARK Historical Watchlist 2014-2026",
            startDate: allFilings[0].reportDate,
            endDate: allFilings[allFilings.length - 1].reportDate,
            totalFilings: allFilings.length,
            uniqueHoldingsCount: stockList.length,
            mappedTickersCount: stockList.filter(s => s.ticker).length,
            generatedAt: new Date().toISOString()
        },
        quarters: allFilings.map(f => ({
            reportDate: f.reportDate,
            source: f.source,
            filingDate: f.filingDate,
            totalValueUsd: f.clean_total_value_usd,
            holdingsCount: f.holdings.length,
            topHoldings: f.holdings
                .filter(h => h.ticker)
                .sort((a, b) => b.weight_pct - a.weight_pct)
                .slice(0, 15)
                .map(h => ({ ticker: h.ticker, name: h.name, weightPct: h.weight_pct }))
        })),
        watchlistByStock: stockMap
    };

    fs.writeFileSync(OUT_FILE, JSON.stringify(outputData, null, 2));
    console.log(`\n[ERFOLG] Watchlist-Master gespeichert unter:`);
    console.log(`  -> ${OUT_FILE}`);
}

buildHistoricalWatchlist();
