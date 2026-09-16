import YahooFinance from 'yahoo-finance2';
import { MathUtils } from '../../src/utils/MathUtils.js';

const yahooFinance = new YahooFinance();

async function runKryptoRadarBacktest() {
    console.log('========================================================');
    console.log('   STARTING KRYPTO RADAR BACKTEST (MSTR/COIN VS BTC)');
    console.log('========================================================\n');

    const todayStr = new Date().toISOString().split('T')[0];

    try {
        console.log('Rufe historische Daten ab (seit 2021)...');
        
        const mstrRaw = await yahooFinance.historical('MSTR', { period1: '2021-01-01', period2: todayStr, interval: '1d' });
        const coinRaw = await yahooFinance.historical('COIN', { period1: '2021-01-01', period2: todayStr, interval: '1d' });
        const btcRaw = await yahooFinance.historical('BTC-USD', { period1: '2021-01-01', period2: todayStr, interval: '1d' });

        // 1. Daten bereinigen
        const mstrCandles = mstrRaw.map(d => ({ date: toDateStr(d.date), close: d.close })).filter(c => c.close > 0);
        const coinCandles = coinRaw.map(d => ({ date: toDateStr(d.date), close: d.close })).filter(c => c.close > 0);
        const btcCandles = btcRaw.map(d => ({ date: toDateStr(d.date), close: d.close })).filter(c => c.close > 0);

        // Map-Strukturen für schnellen Lookup
        const coinMap = new Map(coinCandles.map(c => [c.date, c.close]));
        const btcMap = new Map(btcCandles.map(c => [c.date, c.close]));

        // 2. Synchronisierte Timeline aufbauen (basierend auf Handelsdaten der Aktien)
        const timeline = [];
        for (const mstr of mstrCandles) {
            const date = mstr.date;
            const btcClose = btcMap.get(date);
            if (btcClose) {
                timeline.push({
                    date,
                    mstr: mstr.close,
                    coin: coinMap.get(date) || null, // COIN startete erst im April 2021
                    btc: btcClose
                });
            }
        }

        console.log(`Daten erfolgreich synchronisiert. Anzahl Handelstage: ${timeline.length}\n`);

        // 3. SMAs berechnen
        console.log('Berechne gleitende Durchschnitte (SMA-50 / SMA-200)...');
        for (let i = 0; i < timeline.length; i++) {
            const slice = timeline.slice(0, i + 1);
            timeline[i].btc_sma50 = MathUtils.getSma(slice, t => t.btc, 50);
            timeline[i].btc_sma200 = MathUtils.getSma(slice, t => t.btc, 200);

            timeline[i].mstr_sma50 = MathUtils.getSma(slice, t => t.mstr, 50);
            timeline[i].mstr_sma200 = MathUtils.getSma(slice, t => t.mstr, 200);

            if (timeline[i].coin) {
                timeline[i].coin_sma50 = MathUtils.getSma(slice, t => t.coin, 50);
                timeline[i].coin_sma200 = MathUtils.getSma(slice, t => t.coin, 200);
            } else {
                timeline[i].coin_sma50 = null;
                timeline[i].coin_sma200 = null;
            }
        }

        // 4. Extrema-Lead/Lag-Analyse
        analyzeExtremaLeadLag(timeline);

        // 5. SMA-Bruch Kausalitäts-Analyse
        analyzeSmaCrossoverLead(timeline);

        // 6. Strategie-Backtest
        runStrategyBacktests(timeline);

    } catch (error) {
        console.error('❌ Fehler während des Backtests:', error);
    }
}

function toDateStr(d) {
    return d instanceof Date ? d.toISOString().split('T')[0] : String(d);
}

// Hilfsfunktion zur Ermittlung von lokalen Hochs/Tiefs
function findLocalExtrema(timeline, key, windowSize = 15) {
    const peaks = [];
    const troughs = [];

    for (let i = windowSize; i < timeline.length - windowSize; i++) {
        const current = timeline[i][key];
        if (current === null) continue;

        let isMax = true;
        let isMin = true;

        for (let j = i - windowSize; j <= i + windowSize; j++) {
            if (j === i) continue;
            const val = timeline[j][key];
            if (val === null) continue;

            if (val >= current) isMax = false;
            if (val <= current) isMin = false;
        }

        if (isMax) peaks.push({ index: i, date: timeline[i].date, value: current });
        if (isMin) troughs.push({ index: i, date: timeline[i].date, value: current });
    }

    return { peaks, troughs };
}

function analyzeExtremaLeadLag(timeline) {
    console.log('\n========================================================');
    console.log('📊 ANALYSE 1: LOKALE WENDEPUNKTE (PEAKS & BOTTOMS) LEAD/LAG');
    console.log('========================================================');

    const btcExtrema = findLocalExtrema(timeline, 'btc', 15);
    const mstrExtrema = findLocalExtrema(timeline, 'mstr', 15);
    const coinExtrema = findLocalExtrema(timeline, 'coin', 15);

    const matchLeadLag = (btcList, stockList, stockName, label) => {
        let totalLeadDays = 0;
        let matchedCount = 0;
        let leadCount = 0; // Wie oft war die Aktie zuerst

        for (const btcItem of btcList) {
            // Finde das zeitlich nächste Signal der Aktie im Bereich von +/- 30 Tagen
            let closestStock = null;
            let minDiff = Infinity;

            for (const stockItem of stockList) {
                const diff = btcItem.index - stockItem.index;
                if (Math.abs(diff) <= 30 && Math.abs(diff) < minDiff) {
                    minDiff = Math.abs(diff);
                    closestStock = { diff, date: stockItem.date };
                }
            }

            if (closestStock) {
                // Positiv = Aktie hat kleineren Index (war früher dran = Vorlauf)
                const leadDays = closestStock.diff;
                totalLeadDays += leadDays;
                matchedCount++;
                if (leadDays > 0) leadCount++;
            }
        }

        const avgLead = matchedCount > 0 ? (totalLeadDays / matchedCount).toFixed(1) : 'N/A';
        const leadPct = matchedCount > 0 ? ((leadCount / matchedCount) * 100).toFixed(1) : '0';
        
        console.log(`\n🔸 ${stockName} vs. BTC ${label}:`);
        console.log(`   Gefundene Übereinstimmungen (+/- 30 Tage): ${matchedCount}`);
        console.log(`   Durchschnittlicher Vorlauf: ${avgLead} Handelstage`);
        console.log(`   Häufigkeit des Vorlaufs (Aktie zuerst): ${leadPct}%`);
    };

    matchLeadLag(btcExtrema.peaks, mstrExtrema.peaks, 'MSTR', 'HOCHPUNKTE (Peaks)');
    matchLeadLag(btcExtrema.troughs, mstrExtrema.troughs, 'MSTR', 'TIEFPUNKTE (Bottoms)');

    matchLeadLag(btcExtrema.peaks, coinExtrema.peaks, 'COIN', 'HOCHPUNKTE (Peaks)');
    matchLeadLag(btcExtrema.troughs, coinExtrema.troughs, 'COIN', 'TIEFPUNKTE (Bottoms)');
}

function analyzeSmaCrossoverLead(timeline) {
    console.log('\n========================================================');
    console.log('📊 ANALYSE 2: SMA-BRUCH ALS VORLÄUFER-SIGNAL');
    console.log('========================================================');

    const testSmaBruch = (stockKey, smaKey, label) => {
        let totalSignals = 0;
        let btcFollowedCount = 0;
        let totalLeadDays = 0;

        for (let i = 21; i < timeline.length - 20; i++) {
            const yesterday = timeline[i - 1];
            const today = timeline[i];

            if (!yesterday[stockKey] || !today[stockKey] || !yesterday[smaKey] || !today[smaKey]) continue;

            // Bruch nach unten (Death Cross / Bearish Break)
            const stockBrokeDown = yesterday[stockKey] > yesterday[smaKey] && today[stockKey] < today[smaKey];

            if (stockBrokeDown) {
                totalSignals++;
                
                // Prüfen, ob BTC in den nächsten 20 Tagen auch nach unten bricht
                let btcFollowed = false;
                for (let k = 0; k <= 20; k++) {
                    const futYesterday = timeline[i + k - 1];
                    const futToday = timeline[i + k];
                    if (!futYesterday || !futToday) continue;

                    const btcBrokeDown = futYesterday.btc > futYesterday.btc_sma50 && futToday.btc < futToday.btc_sma50;
                    if (btcBrokeDown) {
                        btcFollowed = true;
                        totalLeadDays += k;
                        break;
                    }
                }

                if (btcFollowed) btcFollowedCount++;
            }
        }

        const successRate = totalSignals > 0 ? ((btcFollowedCount / totalSignals) * 100).toFixed(1) : '0';
        const avgLead = btcFollowedCount > 0 ? (totalLeadDays / btcFollowedCount).toFixed(1) : 'N/A';

        console.log(`\n🔸 ${label} Bruch nach unten (Bearish Signal):`);
        console.log(`   Signale von ${stockKey.toUpperCase()}: ${totalSignals}`);
        console.log(`   BTC folgt innerhalb von 20 Tagen: ${btcFollowedCount} (${successRate}%)`);
        console.log(`   Durchschnittlicher Vorlauf bei Treffern: ${avgLead} Handelstage`);
    };

    testSmaBruch('mstr', 'mstr_sma50', 'MSTR SMA-50');
    testSmaBruch('coin', 'coin_sma50', 'COIN SMA-50');
}

function runStrategyBacktests(timeline) {
    console.log('\n========================================================');
    console.log('📊 ANALYSE 3: BACKTEST RADAR-STRATEGIE AUF BITCOIN');
    console.log('========================================================');

    const runBacktest = (signalKey, smaKey, label) => {
        let position = 0; // 0 = cash, 1 = long in BTC
        let buyPrice = 0;
        let capital = 10000; // Startkapital
        let tradesCount = 0;

        for (let i = 200; i < timeline.length; i++) {
            const today = timeline[i];
            const price = today[signalKey];
            const sma = today[smaKey];

            if (!price || !sma) continue;

            const isBullish = price > sma;

            // Einstieg
            if (isBullish && position === 0) {
                position = 1;
                buyPrice = today.btc;
                tradesCount++;
            } 
            // Ausstieg
            else if (!isBullish && position === 1) {
                const returnPct = (today.btc - buyPrice) / buyPrice;
                capital = capital * (1 + returnPct);
                position = 0;
            }
        }

        // Falls am Ende noch investiert
        if (position === 1) {
            const lastDay = timeline[timeline.length - 1];
            const returnPct = (lastDay.btc - buyPrice) / buyPrice;
            capital = capital * (1 + returnPct);
        }

        const totalReturn = ((capital - 10000) / 10000) * 100;
        console.log(`👉 Strategie: ${label.padEnd(30)} | Trades: ${String(tradesCount).padStart(3, ' ')} | Endkapital: $${capital.toFixed(0).padStart(5, ' ')} | Rendite: ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%`);
    };

    // Kauf Hold
    const startBtc = timeline[200].btc;
    const endBtc = timeline[timeline.length - 1].btc;
    const bhReturn = ((endBtc - startBtc) / startBtc) * 100;
    console.log(`👉 Buy & Hold: Bitcoin ${''.padEnd(17)} | Trades:   1 | Endkapital: $${((endBtc/startBtc)*10000).toFixed(0)} | Rendite: ${bhReturn >= 0 ? '+' : ''}${bhReturn.toFixed(1)}%`);

    runBacktest('btc', 'btc_sma50', 'BTC SMA-50 (Klassisch)');
    runBacktest('btc', 'btc_sma200', 'BTC SMA-200 (Klassisch)');

    runBacktest('mstr', 'mstr_sma50', 'MSTR SMA-50 (Radar)');
    runBacktest('mstr', 'mstr_sma200', 'MSTR SMA-200 (Radar)');

    runBacktest('coin', 'coin_sma50', 'COIN SMA-50 (Radar)');
    runBacktest('coin', 'coin_sma200', 'COIN SMA-200 (Radar)');
    console.log('');
}

runKryptoRadarBacktest();
