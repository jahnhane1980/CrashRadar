import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_BASE = path.resolve(__dirname, '../../data/cache/sec_13f');
const PRICE_CACHE_DIR = path.resolve(__dirname, '../../cache/prices_10y');
if (!fs.existsSync(PRICE_CACHE_DIR)) {
    fs.mkdirSync(PRICE_CACHE_DIR, { recursive: true });
}

const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const GURU_INFO = {
    '0001541617': { name: 'Brad Gerstner', short: 'Gerstner', fund: 'Altimeter', role: 'SCOUT' },
    '0001135730': { name: 'Philippe Laffont', short: 'Laffont', fund: 'Coatue', role: 'SCOUT' },
    '0001167483': { name: 'Chase Coleman', short: 'Coleman', fund: 'Tiger Global', role: 'SCOUT' },
    '0001536411': { name: 'Stanley Druckenmiller', short: 'Druckenmiller', fund: 'Duquesne', role: 'GUARDIAN' },
    '0001509842': { name: 'Zach Schreiber', short: 'Schreiber', fund: 'PointState', role: 'GUARDIAN' },
    '0001656456': { name: 'David Tepper', short: 'Tepper', fund: 'Appaloosa', role: 'GUARDIAN' }
};

const CUSIP_TO_TICKER = {
    '023135106': 'AMZN',
    '30303M102': 'META',
    '594918104': 'MSFT',
    '67066G104': 'NVDA',
    '01609W102': 'BABA',
    '02079K305': 'GOOGL',
    '02079K107': 'GOOGL',
    '64110L106': 'NFLX',
    '874039100': 'TSM',
    '47215P106': 'JD',
    '70450Y103': 'PYPL',
    '00724F101': 'ADBE',
    '90353T100': 'UBER',
    '11135F101': 'AVGO',
    '88160R101': 'TSLA',
    '79466L302': 'CRM',
    '81141R100': 'SE',
    '82509L107': 'SHOP',
    '25809K105': 'DASH',
    '852234103': 'SQ',
    'G29183103': 'ETN',
    '21037T109': 'CEG',
    '722304102': 'PDD',
    '36828A101': 'GEV',
    'L8681T102': 'SPOT',
    '81762P102': 'NOW',
    '46120E602': 'ISRG',
    '833445109': 'SNOW',
    '92826C839': 'V',
    '91324P102': 'UNH',
    '595112103': 'MU',
    '461202103': 'INTU',
    '679295105': 'OKTA',
    '512807108': 'LRCX',
    '57636Q104': 'MA',
    '22788C105': 'CRWD',
    'G6683N103': 'NU',
    '007903107': 'AMD',
    '98138H101': 'WDAY',
    '038222105': 'AMAT',
    '037833100': 'AAPL',
    '166764100': 'CVX',
    '35671D857': 'FCX',
    '532457108': 'LLY',
    '19260Q107': 'COIN',
    '701094104': 'PANW',
    '235851102': 'DDOG',
    '38259P508': 'GOOG'
};

const BLOCKED_TICKERS = ['BABA', 'JD', 'PDD']; // Geopolitical Blacklist

function getFilingScaleMultiplier(holdings) {
    if (!holdings || holdings.length === 0) return 1;
    let validPrices = [];
    for (const h of holdings) {
        const val = Number(h.value) || 0;
        const sh = Number(h.shares) || 0;
        if (val > 0 && sh > 1000) validPrices.push(val / sh);
    }
    if (validPrices.length === 0) return 1;
    const medianPrice = validPrices.sort((a, b) => a - b)[Math.floor(validPrices.length / 2)];
    return medianPrice < 1.5 ? 1000 : 1;
}

async function getMonthlyPrices(ticker) {
    const cacheFile = path.join(PRICE_CACHE_DIR, `${ticker}.json`);
    if (fs.existsSync(cacheFile)) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
    try {
        const res = await yf.chart(ticker, {
            period1: '2015-01-01',
            period2: '2026-09-10',
            interval: '1mo'
        });
        const map = {};
        for (const q of res.quotes) {
            if (q.close !== null && q.close !== undefined) {
                const ym = q.date.toISOString().slice(0, 7);
                map[ym] = q.adjclose || q.close;
            }
        }
        fs.writeFileSync(cacheFile, JSON.stringify(map));
        return map;
    } catch (e) {
        return {};
    }
}

async function run() {
    console.log("================================================================================");
    console.log("  EMPIRISCHE HISTORIEN-ANALYSE: FALL B SITUATIONEN & WÄCHTER-REBALANCING");
    console.log("  Untersuchung von Slot-Verdrängung, Wächter-Trimming & Base-Schutz (2016-2026)");
    console.log("================================================================================\n");

    const duquesneDir = path.join(CACHE_BASE, '0001536411');
    const quarters = fs.readdirSync(duquesneDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort();

    // 1. Lade alle Holdings mit Shares & CIKs
    // Struktur: dataByQ[q][cik][ticker] = { shares, value, weight }
    const dataByQ = {};
    for (const q of quarters) {
        dataByQ[q] = {};
        for (const [cik, info] of Object.entries(GURU_INFO)) {
            dataByQ[q][cik] = {};
            const p = path.join(CACHE_BASE, cik, `${q}.json`);
            if (!fs.existsSync(p)) continue;
            const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
            const mult = getFilingScaleMultiplier(raw);
            const mapped = raw.map(h => ({
                ...h,
                realValue: (Number(h.value) || 0) * mult,
                realShares: Number(h.shares) || 0
            }));
            const totalVal = mapped.reduce((s, h) => s + h.realValue, 0);

            for (const h of mapped) {
                if (h.put_call !== 'STOCK') continue;
                let ticker = CUSIP_TO_TICKER[h.cusip];
                if (!ticker) continue;
                if (ticker === 'GOOG') ticker = 'GOOGL';
                const weight = totalVal > 0 ? (h.realValue / totalVal) * 100 : 0;
                
                if (!dataByQ[q][cik][ticker]) {
                    dataByQ[q][cik][ticker] = { shares: 0, val: 0, weight: 0 };
                }
                dataByQ[q][cik][ticker].shares += h.realShares;
                dataByQ[q][cik][ticker].val += h.realValue;
                dataByQ[q][cik][ticker].weight += weight;
            }
        }
    }

    // Lade Kurse für alle Ticker
    const uniqueTickers = new Set(Object.values(CUSIP_TO_TICKER));
    const priceMap = {};
    for (const t of uniqueTickers) {
        priceMap[t] = await getMonthlyPrices(t);
    }

    function getQuarterPrice(ticker, qStr) {
        const ym = qStr.slice(0, 7);
        const map = priceMap[ticker] || {};
        if (map[ym]) return map[ym];
        const parts = ym.split('-');
        const nextMonth = String(Number(parts[1]) === 12 ? 1 : Number(parts[1]) + 1).padStart(2, '0');
        const nextYear = Number(parts[1]) === 12 ? String(Number(parts[0]) + 1) : parts[0];
        return map[`${nextYear}-${nextMonth}`] || 0;
    }

    // 2. Simuliere das Portfolio Quartal für Quartal
    // Wir halten fest:
    // currentSlots: Array von Objekten { ticker, entryQuarter, quartersInSlot }
    let currentSlots = [];
    const fallBSituations = [];

    for (let i = 0; i < quarters.length; i++) {
        const qCurr = quarters[i];
        const qPrev = i > 0 ? quarters[i - 1] : null;

        // Bestimme für jede Aktie in qCurr:
        // - Wer hält sie? (mit weight >= 1.0% Konviktion)
        // - Wer kauft sie aktiv? (neu eingestiegen oder shares > 1.05 * prevShares)
        // - Wer trimmt sie? (shares < 0.95 * prevShares oder komplett ausgestiegen)
        const stockStats = {};

        for (const [cik, info] of Object.entries(GURU_INFO)) {
            const currHoldings = dataByQ[qCurr][cik] || {};
            const prevHoldings = qPrev ? (dataByQ[qPrev][cik] || {}) : {};

            // Betrachte alle Ticker in curr oder prev
            const allT = new Set([...Object.keys(currHoldings), ...Object.keys(prevHoldings)]);
            for (const t of allT) {
                if (BLOCKED_TICKERS.includes(t)) continue; // Whitelist

                if (!stockStats[t]) {
                    stockStats[t] = {
                        ticker: t,
                        holders: [],
                        convictionHolders: [],
                        scoutHolders: [],
                        guardianHolders: [],
                        activeBuyers: [],
                        scoutBuyers: [],
                        guardianBuyers: [],
                        trimmers: [],
                        scoutTrimmers: [],
                        guardianTrimmers: [],
                        totalVal: 0
                    };
                }

                const currH = currHoldings[t];
                const prevH = prevHoldings[t];
                const currShares = currH ? currH.shares : 0;
                const prevShares = prevH ? prevH.shares : 0;
                const currVal = currH ? currH.val : 0;
                const currWeight = currH ? currH.weight : 0;

                if (currShares > 0) {
                    stockStats[t].holders.push(info.short);
                    stockStats[t].totalVal += currVal;
                    if (currWeight >= 1.0) {
                        stockStats[t].convictionHolders.push(info.short);
                    }
                    if (info.role === 'SCOUT') stockStats[t].scoutHolders.push(info.short);
                    if (info.role === 'GUARDIAN') stockStats[t].guardianHolders.push(info.short);

                    // Prüfe Zukauf
                    if (prevShares === 0 || currShares > prevShares * 1.05) {
                        stockStats[t].activeBuyers.push(info.short);
                        if (info.role === 'SCOUT') stockStats[t].scoutBuyers.push(info.short);
                        if (info.role === 'GUARDIAN') stockStats[t].guardianBuyers.push(info.short);
                    }
                }

                // Prüfe Trim / Exit
                if (prevShares > 0 && (currShares === 0 || currShares < prevShares * 0.95)) {
                    stockStats[t].trimmers.push(info.short);
                    if (info.role === 'SCOUT') stockStats[t].scoutTrimmers.push(info.short);
                    if (info.role === 'GUARDIAN') stockStats[t].guardianTrimmers.push(info.short);
                }
            }
        }

        // Alterung der bestehenden Slots
        for (const slot of currentSlots) {
            slot.quartersInSlot++;
        }

        // 1. Prüfe Exit bei bestehenden Slots (unter 2 Halter)
        const keptSlots = [];
        for (const slot of currentSlots) {
            const stats = stockStats[slot.ticker];
            const holderCount = stats ? stats.holders.length : 0;
            if (holderCount >= 2) {
                keptSlots.push(slot);
            } else {
                // Titel scheidet regulär aus (< 2 Halter)
            }
        }
        currentSlots = keptSlots;

        // 2. Prüfe Aufnahme-Kandidaten (mindestens 2 aktive Käufer mit Konviktion)
        const eligibleChallengers = Object.values(stockStats)
            .filter(s => {
                // Nicht bereits im Depot
                if (currentSlots.some(slot => slot.ticker === s.ticker)) return false;
                // Mindestens 2 aktive Käufer
                return s.activeBuyers.length >= 2;
            })
            .sort((a, b) => b.holders.length - a.holders.length || b.activeBuyers.length - a.activeBuyers.length || b.totalVal - a.totalVal);

        // Fall A: Freie Slots vorhanden (< 7)
        while (currentSlots.length < 7 && eligibleChallengers.length > 0) {
            const next = eligibleChallengers.shift();
            currentSlots.push({
                ticker: next.ticker,
                entryQuarter: qCurr,
                quartersInSlot: 1
            });
        }

        // Fall B: Alle 7 Slots voll besetzt, aber es gibt WEITERE qualifizierte Kandidaten!
        if (currentSlots.length === 7 && eligibleChallengers.length > 0) {
            for (const challenger of eligibleChallengers) {
                // Finde schwächsten Bestandstitel
                // Kriterien: geringste Halterzahl, keine aktiven Käufer, quartersInSlot
                const incumbentList = currentSlots.map(slot => {
                    const stats = stockStats[slot.ticker] || {};
                    return {
                        ticker: slot.ticker,
                        quartersInSlot: slot.quartersInSlot,
                        holders: stats.holders || [],
                        activeBuyers: stats.activeBuyers || [],
                        trimmers: stats.trimmers || [],
                        guardianTrimmers: stats.guardianTrimmers || [],
                        guardianBuyers: stats.guardianBuyers || [],
                        guardianHolders: stats.guardianHolders || [],
                        totalVal: stats.totalVal || 0
                    };
                }).sort((a, b) => a.holders.length - b.holders.length || a.activeBuyers.length - b.activeBuyers.length || a.totalVal - b.totalVal);

                const weakestIncumbent = incumbentList[0];

                // Performance-Vergleich 6M & 12M
                const nextQ2 = quarters[i + 2] || quarters[quarters.length - 1];
                const nextQ4 = quarters[i + 4] || quarters[quarters.length - 1];

                const pCurrWeak = getQuarterPrice(weakestIncumbent.ticker, qCurr);
                const p2Weak = getQuarterPrice(weakestIncumbent.ticker, nextQ2);
                const p4Weak = getQuarterPrice(weakestIncumbent.ticker, nextQ4);
                const ret6M_weak = pCurrWeak > 0 && p2Weak > 0 ? ((p2Weak - pCurrWeak) / pCurrWeak * 100) : 0;
                const ret12M_weak = pCurrWeak > 0 && p4Weak > 0 ? ((p4Weak - pCurrWeak) / pCurrWeak * 100) : 0;

                const pCurrChal = getQuarterPrice(challenger.ticker, qCurr);
                const p2Chal = getQuarterPrice(challenger.ticker, nextQ2);
                const p4Chal = getQuarterPrice(challenger.ticker, nextQ4);
                const ret6M_chal = pCurrChal > 0 && p2Chal > 0 ? ((p2Chal - pCurrChal) / pCurrChal * 100) : 0;
                const ret12M_chal = pCurrChal > 0 && p4Chal > 0 ? ((p4Chal - pCurrChal) / pCurrChal * 100) : 0;

                fallBSituations.push({
                    quarter: qCurr,
                    challenger: challenger.ticker,
                    challengerBuyers: challenger.activeBuyers,
                    challengerGuardianBuyers: challenger.guardianBuyers,
                    challengerHolders: challenger.holders.length,
                    weakestIncumbent: weakestIncumbent.ticker,
                    incumbentHolders: weakestIncumbent.holders.length,
                    incumbentBuyers: weakestIncumbent.activeBuyers,
                    incumbentGuardianTrimmers: weakestIncumbent.guardianTrimmers,
                    incumbentQuartersInSlot: weakestIncumbent.quartersInSlot,
                    ret6M_challenger: ret6M_chal,
                    ret6M_incumbent: ret6M_weak,
                    ret12M_challenger: ret12M_chal,
                    ret12M_incumbent: ret12M_weak,
                    challengerWon: ret12M_chal > ret12M_weak
                });
            }
        }
    }

    console.log(`Gefundene Fall-B Situationen (7 Slots voll + Herausforderer mit >= 2 Käufern): ${fallBSituations.length}\n`);

    console.log("------------------------------------------------------------------------------------------------------------------------");
    console.log(" Quartal    | Challenger (Käufer)              | Schwächster Slot (Halter) | Wächter trimmen Slot? | 12M Chal vs Incumbent");
    console.log("------------------------------------------------------------------------------------------------------------------------");

    let chalWins = 0;
    let incumbentWins = 0;

    for (const sit of fallBSituations) {
        const chalStr = `${sit.challenger} (${sit.challengerBuyers.join('+')})`;
        const incStr = `${sit.weakestIncumbent} (${sit.incumbentHolders}H / ${sit.incumbentQuartersInSlot}Q)`;
        const guardianTrimStr = sit.incumbentGuardianTrimmers.length > 0 ? `JA (${sit.incumbentGuardianTrimmers.join(',')})` : 'Nein';
        const perfStr = `${sit.ret12M_challenger >= 0 ? '+' : ''}${sit.ret12M_challenger.toFixed(1)}% vs ${sit.ret12M_incumbent >= 0 ? '+' : ''}${sit.ret12M_incumbent.toFixed(1)}% -> ${sit.challengerWon ? 'CHALLENGER GEWINNT' : 'INCUMBENT GEWINNT'}`;

        if (sit.challengerWon) chalWins++;
        else incumbentWins++;

        console.log(` ${sit.quarter} | ${chalStr.padEnd(32)} | ${incStr.padEnd(25)} | ${guardianTrimStr.padEnd(21)} | ${perfStr}`);
    }

    console.log("------------------------------------------------------------------------------------------------------------------------");
    console.log(`ZUSAMMENFASSUNG: Challenger siegte in ${chalWins} Fällen (${((chalWins / fallBSituations.length) * 100).toFixed(1)}%), Incumbent behauptete sich in ${incumbentWins} Fällen.`);
    console.log("========================================================================================================================\n");

    // Detaillierte Fallstudien zu Wächter-Trimming:
    console.log("--------------------------------------------------------------------------------");
    console.log("  DETAIL-STUDIE: WÄCHTER-TRIMMING BEI BESTANDSAKTIEN");
    console.log("--------------------------------------------------------------------------------");
    const guardianTrimCases = fallBSituations.filter(s => s.incumbentGuardianTrimmers.length > 0);
    console.log(`Fälle, in denen ein Wächter den schwächsten Bestandstitel getrimmt/verkauft hat: ${guardianTrimCases.length}`);
    for (const c of guardianTrimCases) {
        console.log(`\n• Quartal ${c.quarter}: Wächter ${c.incumbentGuardianTrimmers.join(', ')} trimmt ${c.weakestIncumbent}.`);
        console.log(`  Gleichzeitig kaufen Gurus (${c.challengerBuyers.join(', ')}) die neue Aktie ${c.challenger}.`);
        console.log(`  Ergebnis 12 Monate später: ${c.challenger} erzielte ${c.ret12M_challenger.toFixed(1)}% vs ${c.weakestIncumbent} mit ${c.ret12M_incumbent.toFixed(1)}%.`);
        console.log(`  -> ${c.challengerWon ? 'WÄCHTER HATTE RECHT (Rotation in Challenger war besser!)' : 'Bestandstitel lief trotz Trimmen besser'}`);
    }
}

run().catch(console.error);
