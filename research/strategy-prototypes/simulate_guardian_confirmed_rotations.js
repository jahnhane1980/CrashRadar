import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_BASE = path.resolve(__dirname, '../../data/cache/sec_13f');
const PRICE_CACHE_DIR = path.resolve(__dirname, '../../cache/prices_10y');
const DAILY_CACHE_DIR = path.resolve(__dirname, '../../cache/daily_10y');
if (!fs.existsSync(DAILY_CACHE_DIR)) {
    fs.mkdirSync(DAILY_CACHE_DIR, { recursive: true });
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
const SEMI_TICKERS = ['NVDA', 'TSM', 'LRCX', 'AVGO', 'MU', 'AMD', 'AMAT'];

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

async function getDailyCloses(ticker) {
    const cacheFile = path.join(DAILY_CACHE_DIR, `${ticker}.json`);
    if (fs.existsSync(cacheFile)) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
    try {
        const res = await yf.historical(ticker, {
            period1: '2015-01-01',
            period2: '2026-09-10',
            interval: '1d'
        });
        const list = res.map(r => ({
            date: r.date.toISOString().split('T')[0],
            close: r.adjClose || r.close
        })).filter(r => r.close !== null && r.close !== undefined);
        fs.writeFileSync(cacheFile, JSON.stringify(list));
        return list;
    } catch (e) {
        return [];
    }
}

function getTechnicalIndicators(dailyList, targetDate) {
    // Filter bis targetDate
    const slice = dailyList.filter(d => d.date <= targetDate);
    if (slice.length < 50) return { price: 0, sma50: 0, sma200: 0, underSma50: false, overextendedSma200: false };

    const currentPrice = slice[slice.length - 1].close;
    const last50 = slice.slice(-50).map(d => d.close);
    const sma50 = last50.reduce((s, c) => s + c, 0) / 50;

    let sma200 = 0;
    if (slice.length >= 200) {
        const last200 = slice.slice(-200).map(d => d.close);
        sma200 = last200.reduce((s, c) => s + c, 0) / 200;
    } else {
        sma200 = slice.map(d => d.close).reduce((s, c) => s + c, 0) / slice.length;
    }

    const underSma50 = currentPrice < sma50;
    const diff200Pct = sma200 > 0 ? ((currentPrice - sma200) / sma200 * 100) : 0;
    const overextendedSma200 = diff200Pct > 30.0;

    return {
        price: currentPrice,
        sma50,
        sma200,
        diff200Pct,
        underSma50,
        overextendedSma200
    };
}

async function run() {
    console.log("================================================================================");
    console.log("  SIMULATION: WÄCHTER-BESTÄTIGTES REBALANCING & BASE-SCHUTZ-REFORM");
    console.log("  Bedingung: Wächter trimmt UND (Kurs < SMA50 ODER Kurs > SMA200 + 30%)");
    console.log("  Zeitraum: 2016 - 2026 (42 Quartale) | Startkapital: 10.000 $");
    console.log("================================================================================\n");

    const duquesneDir = path.join(CACHE_BASE, '0001536411');
    const quarters = fs.readdirSync(duquesneDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort();

    // 1. Lade Holdings
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
                if (!ticker && h.issuer_name && h.issuer_name.toUpperCase().includes('VERNOVA')) ticker = 'GEV';
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
    uniqueTickers.add('GEV');
    uniqueTickers.add('CEG');
    uniqueTickers.add('ETN');
    uniqueTickers.add('QQQ');
    uniqueTickers.add('SPY');

    const priceMap = {};
    const dailyMap = {};
    for (const t of uniqueTickers) {
        priceMap[t] = await getMonthlyPrices(t);
        dailyMap[t] = await getDailyCloses(t);
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

    // SIMULATION DER BEIDEN VARIANTEN
    // Var 1: Baseline v3.0 (Statischer Base-Schutz, Displacement nur wenn < SMA200)
    // Var 2: User-Regel (Displacement erlaubt wenn Wächter trimmt UND (< SMA50 ODER > SMA200*1.30))

    function runSimulation(useUserRebalanceRule, allowEnergyInfrastructure) {
        let currentSlots = []; // [{ ticker, entryQuarter, quartersInSlot }]
        let portfolioVal = 10000;
        const history = [];
        const displacementEvents = [];

        for (let i = 0; i < quarters.length - 1; i++) {
            const qCurr = quarters[i];
            const qNext = quarters[i + 1];
            const qPrev = i > 0 ? quarters[i - 1] : null;

            // Stats ermitteln
            const stockStats = {};
            for (const [cik, info] of Object.entries(GURU_INFO)) {
                const currH = dataByQ[qCurr][cik] || {};
                const prevH = qPrev ? (dataByQ[qPrev][cik] || {}) : {};

                const allT = new Set([...Object.keys(currH), ...Object.keys(prevH)]);
                for (const t of allT) {
                    if (BLOCKED_TICKERS.includes(t)) continue; // Whitelist
                    if (!allowEnergyInfrastructure && ['GEV', 'CEG', 'ETN'].includes(t)) continue;

                    if (!stockStats[t]) {
                        stockStats[t] = {
                            ticker: t,
                            holders: [],
                            convictionHolders: [],
                            activeBuyers: [],
                            guardianBuyers: [],
                            guardianTrimmers: [],
                            totalVal: 0
                        };
                    }

                    const cH = currH[t];
                    const pH = prevH[t];
                    const currShares = cH ? cH.shares : 0;
                    const prevShares = pH ? pH.shares : 0;
                    const currVal = cH ? cH.val : 0;
                    const currWeight = cH ? cH.weight : 0;

                    if (currShares > 0) {
                        stockStats[t].holders.push(info.short);
                        stockStats[t].totalVal += currVal;
                        if (currWeight >= 1.0) stockStats[t].convictionHolders.push(info.short);
                        if (prevShares === 0 || currShares > prevShares * 1.05) {
                            stockStats[t].activeBuyers.push(info.short);
                            if (info.role === 'GUARDIAN') stockStats[t].guardianBuyers.push(info.short);
                        }
                    }

                    if (prevShares > 0 && (currShares === 0 || currShares < prevShares * 0.95)) {
                        if (info.role === 'GUARDIAN') stockStats[t].guardianTrimmers.push(info.short);
                    }
                }
            }

            // Alterung & Standard-Exit (< 2 Halter)
            for (const s of currentSlots) s.quartersInSlot++;
            currentSlots = currentSlots.filter(s => {
                const st = stockStats[s.ticker];
                return st && st.holders.length >= 2;
            });

            // Ermittle Challengers (>= 2 active buyers, noch nicht im Depot)
            const challengers = Object.values(stockStats)
                .filter(s => !currentSlots.some(slot => slot.ticker === s.ticker) && s.activeBuyers.length >= 2)
                .sort((a, b) => b.holders.length - a.holders.length || b.activeBuyers.length - a.activeBuyers.length || b.totalVal - a.totalVal);

            // 1. Fülle freie Slots (< 7)
            let semiSlotsCount = currentSlots.filter(s => SEMI_TICKERS.includes(s.ticker)).length;
            const remainingChallengers = [];

            for (const chal of challengers) {
                const isSemi = SEMI_TICKERS.includes(chal.ticker);
                if (isSemi && semiSlotsCount >= 2) {
                    remainingChallengers.push(chal);
                    continue; // Sektor-Cap
                }
                if (currentSlots.length < 7) {
                    currentSlots.push({ ticker: chal.ticker, entryQuarter: qCurr, quartersInSlot: 1 });
                    if (isSemi) semiSlotsCount++;
                } else {
                    remainingChallengers.push(chal);
                }
            }

            // 2. Fall B: Rebalancing / Verdrängung bei vollen 7 Slots
            if (currentSlots.length === 7 && remainingChallengers.length > 0) {
                // Suche Kandidat für Verdrängung unter den Incumbents
                for (const chal of remainingChallengers) {
                    const isChalSemi = SEMI_TICKERS.includes(chal.ticker);

                    // Sortiere Incumbents vom schwächsten zum stärksten
                    const sortedIncumbents = [...currentSlots].sort((a, b) => {
                        const stA = stockStats[a.ticker] || { holders: [], totalVal: 0 };
                        const stB = stockStats[b.ticker] || { holders: [], totalVal: 0 };
                        return stA.holders.length - stB.holders.length || stA.totalVal - stB.totalVal;
                    });

                    for (const candidate of sortedIncumbents) {
                        const st = stockStats[candidate.ticker] || {};
                        const techInd = getTechnicalIndicators(dailyMap[candidate.ticker] || [], qCurr);

                        let canDisplace = false;
                        let triggerReason = '';

                        if (useUserRebalanceRule) {
                            // User-Regel:
                            // Wächter trimmt UND (Kurs < SMA50 ODER Kurs > SMA200*1.30)
                            const guardianTrimmed = st.guardianTrimmers && st.guardianTrimmers.length > 0;
                            const techTrigger = techInd.underSma50 || techInd.overextendedSma200;

                            if (guardianTrimmed && techTrigger) {
                                // Prüfe Sektor-Cap für Halbleiter
                                if (isChalSemi && !SEMI_TICKERS.includes(candidate.ticker) && semiSlotsCount >= 2) {
                                    // Halbleiter-Cap verhindert Einzug
                                    continue;
                                }
                                canDisplace = true;
                                triggerReason = `Wächter (${st.guardianTrimmers.join('+')}) trimmt & ${techInd.underSma50 ? 'SMA50-Knick' : 'SMA200-Überdehnung (+ ' + techInd.diff200Pct.toFixed(1) + '%)'}`;
                            }
                        } else {
                            // Baseline v3.0:
                            // Nur wenn < SMA200 und chal >= 3 Käufer
                            if (techInd.price < techInd.sma200 && chal.activeBuyers.length >= 3) {
                                canDisplace = true;
                                triggerReason = `Klassischer SMA200-Bruch & 3+ Käufer`;
                            }
                        }

                        if (canDisplace) {
                            // Führe Verdrängung durch!
                            displacementEvents.push({
                                quarter: qCurr,
                                displaced: candidate.ticker,
                                incoming: chal.ticker,
                                buyers: chal.activeBuyers,
                                reason: triggerReason
                            });

                            // Ersetze Slot
                            const idx = currentSlots.findIndex(s => s.ticker === candidate.ticker);
                            if (idx !== -1) {
                                currentSlots[idx] = { ticker: chal.ticker, entryQuarter: qCurr, quartersInSlot: 1 };
                            }
                            break; // Challenger platziert
                        }
                    }
                }
            }

            // Berechne Quartalsrendite
            let sumRet = 0;
            let validCount = 0;
            for (const s of currentSlots) {
                const p0 = getQuarterPrice(s.ticker, qCurr);
                const p1 = getQuarterPrice(s.ticker, qNext);
                if (p0 > 0 && p1 > 0) {
                    sumRet += (p1 - p0) / p0;
                    validCount++;
                }
            }
            const qRet = validCount > 0 ? sumRet / validCount : 0;
            portfolioVal *= (1 + qRet);

            history.push({
                quarter: qNext,
                val: Math.round(portfolioVal),
                slots: currentSlots.map(s => s.ticker).join(', ')
            });
        }

        return { finalVal: portfolioVal, history, displacementEvents };
    }

    const resBaseline = runSimulation(false, false);
    const resUserRule = runSimulation(true, true);

    const qqqP0 = getQuarterPrice('QQQ', quarters[0]);
    const qqqP1 = getQuarterPrice('QQQ', quarters[quarters.length - 1]);
    const spyP0 = getQuarterPrice('SPY', quarters[0]);
    const spyP1 = getQuarterPrice('SPY', quarters[quarters.length - 1]);

    const qqqVal = 10000 * (qqqP1 / qqqP0);
    const spyVal = 10000 * (spyP1 / spyP0);

    console.log("================================================================================");
    console.log(`  ALLE KONKRETEN ROTATIONEN UNTER DER USER-REGEL (${resUserRule.displacementEvents.length} EREIGNISSE)`);
    console.log("================================================================================\n");

    for (const ev of resUserRule.displacementEvents) {
        console.log(`• [${ev.quarter}] ${ev.displaced} WURDE VERDRÄNGT DURCH -> ${ev.incoming}`);
        console.log(`  - Auslöser: ${ev.reason}`);
        console.log(`  - Käufer von ${ev.incoming}: ${ev.buyers.join(', ')}\n`);
    }

    // Letzte 4 Quartale im Detail:
    console.log("\n--------------------------------------------------------------------------------");
    console.log("  DIE LETZTEN 4 QUARTALE DES PORTFOLIOS (HISTORISCHER VERLAUF BIS HEUTE):");
    console.log("--------------------------------------------------------------------------------");
    for (const h of resUserRule.history.slice(-4)) {
        console.log(`• Quartal ${h.quarter} (Wert: $${h.val.toLocaleString()}): Slots = [${h.slots}]`);
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("  10,5-JAHRE PERFORMANCE-VERGLEICH (10.000 $ START -> 2016 BIS 2026)");
    console.log("--------------------------------------------------------------------------------");
    console.log(`• S&P 500 (SPY):                         $ ${Math.round(spyVal).toLocaleString()} (+${((spyVal/10000 - 1)*100).toFixed(1)} %)`);
    console.log(`• Nasdaq-100 (QQQ):                      $ ${Math.round(qqqVal).toLocaleString()} (+${((qqqVal/10000 - 1)*100).toFixed(1)} %)`);
    console.log(`• 1. Baseline v3.0 (Statischer Schutz):  $ ${Math.round(resBaseline.finalVal).toLocaleString()} (+${((resBaseline.finalVal/10000 - 1)*100).toFixed(1)} %)`);
    console.log(`• 2. User-Regel (Wächter-Rebalancing):   $ ${Math.round(resUserRule.finalVal).toLocaleString()} (+${((resUserRule.finalVal/10000 - 1)*100).toFixed(1)} %)`);
    console.log(`  ➔ ALPHA DURCH REBALANCING-REGEL:       +$ ${Math.round(resUserRule.finalVal - resBaseline.finalVal).toLocaleString()} (+${((resUserRule.finalVal / resBaseline.finalVal - 1)*100).toFixed(1)} % Mehrertrag!)\n`);
}

run().catch(console.error);
