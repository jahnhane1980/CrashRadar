import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_BASE = path.resolve(__dirname, '../../../data/cache/sec_13f');
const PRICE_CACHE_DIR = path.resolve(__dirname, '../../trash/cache/prices_10y');

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
    '023135106': 'AMZN', '30303M102': 'META', '594918104': 'MSFT', '67066G104': 'NVDA',
    '01609W102': 'BABA', '02079K305': 'GOOGL', '02079K107': 'GOOGL', '64110L106': 'NFLX',
    '874039100': 'TSM', '47215P106': 'JD', '70450Y103': 'PYPL', '00724F101': 'ADBE',
    '90353T100': 'UBER', '11135F101': 'AVGO', '88160R101': 'TSLA', '79466L302': 'CRM',
    '81141R100': 'SE', '82509L107': 'SHOP', '25809K105': 'DASH', '852234103': 'SQ',
    'G29183103': 'ETN', '21037T109': 'CEG', '722304102': 'PDD', '36828A101': 'GEV',
    'L8681T102': 'SPOT', '81762P102': 'NOW', '46120E602': 'ISRG', '833445109': 'SNOW',
    '92826C839': 'V', '91324P102': 'UNH', '595112103': 'MU', '461202103': 'INTU',
    '679295105': 'OKTA', '512807108': 'LRCX', '57636Q104': 'MA', '22788C105': 'CRWD',
    'G6683N103': 'NU', '007903107': 'AMD', '98138H101': 'WDAY', '038222105': 'AMAT',
    '037833100': 'AAPL', '166764100': 'CVX', '35671D857': 'FCX', '532457108': 'LLY',
    '19260Q107': 'COIN', '701094104': 'PANW', '235851102': 'DDOG', '38259P508': 'GOOG'
};

const BLOCKED_TICKERS = ['BABA', 'JD', 'PDD'];

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
    console.log("  TIEFEN-ANALYSE: FALL B SITUATIONEN – SCOUT-ALLEINGANG VS. WÄCHTER-ROTATION");
    console.log("================================================================================\n");

    const duquesneDir = path.join(CACHE_BASE, '0001536411');
    const quarters = fs.readdirSync(duquesneDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort();

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

    let currentSlots = [];
    const scoutOnlyCases = [];
    const guardianSupportedCases = [];

    for (let i = 0; i < quarters.length; i++) {
        const qCurr = quarters[i];
        const qPrev = i > 0 ? quarters[i - 1] : null;

        const stockStats = {};

        for (const [cik, info] of Object.entries(GURU_INFO)) {
            const currHoldings = dataByQ[qCurr][cik] || {};
            const prevHoldings = qPrev ? (dataByQ[qPrev][cik] || {}) : {};

            const allT = new Set([...Object.keys(currHoldings), ...Object.keys(prevHoldings)]);
            for (const t of allT) {
                if (BLOCKED_TICKERS.includes(t)) continue;

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
                    if (currWeight >= 1.0) stockStats[t].convictionHolders.push(info.short);
                    if (info.role === 'SCOUT') stockStats[t].scoutHolders.push(info.short);
                    if (info.role === 'GUARDIAN') stockStats[t].guardianHolders.push(info.short);

                    if (prevShares === 0 || currShares > prevShares * 1.05) {
                        stockStats[t].activeBuyers.push(info.short);
                        if (info.role === 'SCOUT') stockStats[t].scoutBuyers.push(info.short);
                        if (info.role === 'GUARDIAN') stockStats[t].guardianBuyers.push(info.short);
                    }
                }

                if (prevShares > 0 && (currShares === 0 || currShares < prevShares * 0.95)) {
                    stockStats[t].trimmers.push(info.short);
                    if (info.role === 'SCOUT') stockStats[t].scoutTrimmers.push(info.short);
                    if (info.role === 'GUARDIAN') stockStats[t].guardianTrimmers.push(info.short);
                }
            }
        }

        // Alterung & Exit (< 2 Halter)
        for (const slot of currentSlots) slot.quartersInSlot++;
        currentSlots = currentSlots.filter(s => {
            const st = stockStats[s.ticker];
            return st && st.holders.length >= 2;
        });

        // Challengers
        const eligibleChallengers = Object.values(stockStats)
            .filter(s => !currentSlots.some(slot => slot.ticker === s.ticker) && s.activeBuyers.length >= 2)
            .sort((a, b) => b.holders.length - a.holders.length || b.activeBuyers.length - a.activeBuyers.length || b.totalVal - a.totalVal);

        while (currentSlots.length < 7 && eligibleChallengers.length > 0) {
            const next = eligibleChallengers.shift();
            currentSlots.push({ ticker: next.ticker, entryQuarter: qCurr, quartersInSlot: 1 });
        }

        // Fall B
        if (currentSlots.length === 7 && eligibleChallengers.length > 0) {
            for (const challenger of eligibleChallengers) {
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

                const nextQ4 = quarters[i + 4] || quarters[quarters.length - 1];
                const pCurrWeak = getQuarterPrice(weakestIncumbent.ticker, qCurr);
                const p4Weak = getQuarterPrice(weakestIncumbent.ticker, nextQ4);
                const ret12M_weak = pCurrWeak > 0 && p4Weak > 0 ? ((p4Weak - pCurrWeak) / pCurrWeak * 100) : 0;

                const pCurrChal = getQuarterPrice(challenger.ticker, qCurr);
                const p4Chal = getQuarterPrice(challenger.ticker, nextQ4);
                const ret12M_chal = pCurrChal > 0 && p4Chal > 0 ? ((p4Chal - pCurrChal) / pCurrChal * 100) : 0;

                const record = {
                    quarter: qCurr,
                    challenger: challenger.ticker,
                    challengerBuyers: challenger.activeBuyers,
                    challengerGuardianBuyers: challenger.guardianBuyers,
                    weakestIncumbent: weakestIncumbent.ticker,
                    incumbentHolders: weakestIncumbent.holders.length,
                    incumbentGuardianTrimmers: weakestIncumbent.guardianTrimmers,
                    ret12M_chal,
                    ret12M_weak,
                    challengerWon: ret12M_chal > ret12M_weak
                };

                if (challenger.guardianBuyers.length > 0) {
                    guardianSupportedCases.push(record);
                } else {
                    scoutOnlyCases.push(record);
                }
            }
        }
    }

    console.log(`================================================================================`);
    console.log(`  GRUPPE 1: CHALLENGER WURDE NUR VON SCOUTS GEKAUFT (0 WÄCHTER)`);
    console.log(`  Gesamtfälle: ${scoutOnlyCases.length}`);
    console.log(`================================================================================`);
    let scoutChalWins = scoutOnlyCases.filter(c => c.challengerWon).length;
    let scoutIncWins = scoutOnlyCases.length - scoutChalWins;
    console.log(`  Ergebnis: Challenger gewinnt in ${scoutChalWins} Fällen (${((scoutChalWins / scoutOnlyCases.length) * 100).toFixed(1)}%), Incumbent gewinnt in ${scoutIncWins} Fällen (${((scoutIncWins / scoutOnlyCases.length) * 100).toFixed(1)}%).\n`);

    console.log("  Typische Beispiele (Scout-Hype vs. Base-Schutz des Bestandstitels):");
    for (const c of scoutOnlyCases.slice(0, 10)) {
        console.log(`  • ${c.quarter}: Scouts (${c.challengerBuyers.join('+')}) pushen ${c.challenger}. Schwächster Slot: ${c.weakestIncumbent}. 12M: ${c.challenger} (${c.ret12M_chal >= 0 ? '+' : ''}${c.ret12M_chal.toFixed(1)}%) vs ${c.weakestIncumbent} (${c.ret12M_weak >= 0 ? '+' : ''}${c.ret12M_weak.toFixed(1)}%) -> ${c.challengerWon ? 'CHALLENGER' : 'BASE-SCHUTZ WAR RETTEND'}`);
    }

    console.log(`\n================================================================================`);
    console.log(`  GRUPPE 2: CHALLENGER WURDE VON MINDESTENS 1 WÄCHTER GEKAUFT (ROTATION DER WÄCHTER)`);
    console.log(`  Gesamtfälle: ${guardianSupportedCases.length}`);
    console.log(`================================================================================`);
    let guardChalWins = guardianSupportedCases.filter(c => c.challengerWon).length;
    let guardIncWins = guardianSupportedCases.length - guardChalWins;
    console.log(`  Ergebnis: Challenger gewinnt in ${guardChalWins} Fällen (${((guardChalWins / guardianSupportedCases.length) * 100).toFixed(1)}%), Incumbent gewinnt in ${guardIncWins} Fällen (${((guardIncWins / guardianSupportedCases.length) * 100).toFixed(1)}%).\n`);

    console.log("  Typische Beispiele (Wächter-Rotation in neue Opportunität):");
    for (const c of guardianSupportedCases.slice(0, 10)) {
        console.log(`  • ${c.quarter}: Wächter (${c.challengerGuardianBuyers.join('+')}) kaufen ${c.challenger}. Schwächster Slot: ${c.weakestIncumbent}. 12M: ${c.challenger} (${c.ret12M_chal >= 0 ? '+' : ''}${c.ret12M_chal.toFixed(1)}%) vs ${c.weakestIncumbent} (${c.ret12M_weak >= 0 ? '+' : ''}${c.ret12M_weak.toFixed(1)}%) -> ${c.challengerWon ? 'WÄCHTER-ROTATION HATTE RECHT' : 'Incumbent war besser'}`);
    }

    console.log(`\n================================================================================`);
    console.log(`  GESAMT-FAZIT: REBALANCING & BASE-SCHUTZ IN FALL B`);
    console.log(`================================================================================`);
    console.log(`1. Gruppe 1 (Challenger NUR von Scouts gepusht, 0 Wächter-Käufer):`);
    console.log(`   - Fälle: ${scoutOnlyCases.length}`);
    console.log(`   - Challenger gewinnt: ${scoutChalWins} (${((scoutChalWins / scoutOnlyCases.length) * 100).toFixed(1)}%)`);
    console.log(`   - Incumbent gewinnt: ${scoutIncWins} (${((scoutIncWins / scoutOnlyCases.length) * 100).toFixed(1)}%)`);
    console.log(`   -> ERGEBNIS: Der Base-Schutz verhindert in ${((scoutIncWins / scoutOnlyCases.length) * 100).toFixed(1)}% der Fälle fatale Fehlausstiege in Scout-Hypes (Snowflake, Okta, DoorDash, Peloton)!`);

    console.log(`\n2. Gruppe 2 (Challenger wird von mindestens 1 WÄCHTER gekauft):`);
    console.log(`   - Fälle: ${guardianSupportedCases.length}`);
    console.log(`   - Challenger gewinnt: ${guardChalWins} (${((guardChalWins / guardianSupportedCases.length) * 100).toFixed(1)}%)`);
    console.log(`   - Incumbent gewinnt: ${guardIncWins} (${((guardIncWins / guardianSupportedCases.length) * 100).toFixed(1)}%)`);

    const activeRebalance = guardianSupportedCases.filter(c => c.incumbentGuardianTrimmers.length > 0);
    const activeWins = activeRebalance.filter(c => c.challengerWon).length;

    console.log(`\n3. Gruppe 3 (Wächter trimmen aktiv den schwächsten Slot UND kaufen den Challenger):`);
    console.log(`   - Fälle: ${activeRebalance.length}`);
    console.log(`   - Challenger gewinnt: ${activeWins} (${((activeWins / activeRebalance.length) * 100).toFixed(1)}%)`);
    console.log(`   - Incumbent gewinnt: ${activeRebalance.length - activeWins} (${(((activeRebalance.length - activeWins) / activeRebalance.length) * 100).toFixed(1)}%)`);
    console.log(`   -> ERGEBNIS: Wenn Wächter aktiv Kapital abziehen und rotieren, siegt der neue Titel in ${((activeWins / activeRebalance.length) * 100).toFixed(1)}% der Fälle!`);
}

run().catch(console.error);
