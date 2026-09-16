import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function runDivergenceAnalysis() {
    console.log('========================================================');
    console.log('   NASDAQ vs. S&P 500 (DIVERGENCE ANALYSIS)');
    console.log('========================================================\n');

    const startDate = '1999-01-01';
    const endDate = '2026-07-07';
    
    console.log(`Lade QQQ und SPY Daten von Yahoo Finance (${startDate} bis ${endDate})...`);
    
    let spyRaw, qqqRaw;
    try {
        spyRaw = await yahooFinance.historical('SPY', { period1: startDate, period2: endDate, interval: '1d' });
        qqqRaw = await yahooFinance.historical('QQQ', { period1: startDate, period2: endDate, interval: '1d' });
    } catch (err) {
        console.error('Fehler beim Abrufen der Daten:', err.message);
        return;
    }

    // Maps aufbauen
    const spyMap = {};
    spyRaw.forEach(d => {
        const dStr = d.date.toISOString().split('T')[0];
        spyMap[dStr] = d.close;
    });

    const qqqMap = {};
    qqqRaw.forEach(d => {
        const dStr = d.date.toISOString().split('T')[0];
        qqqMap[dStr] = d.close;
    });

    const dates = Object.keys(spyMap).filter(d => qqqMap[d] !== undefined).sort();
    console.log(`✅ ${dates.length} Handelstage zusammengeführt.\n`);

    // Historische Tops laut Analyse.md
    const historicSpyTops = [
        { name: 'Dotcom-Blase', date: '2000-03-24' },
        { name: 'Finanzkrise', date: '2007-10-09' },
        { name: 'Zins-Panik', date: '2018-09-20' },
        { name: 'Corona-Crash', date: '2020-02-19' },
        { name: 'Inflations-Schock', date: '2022-01-03' },
        { name: 'Crash 2025', date: '2025-02-19' }
    ];

    console.log('--- MANUELLER PEAK-CHECK ---');
    // Für jeden SPY Top, finde den höchsten QQQ Preis in den 60 Tagen VOR dem SPY Top
    historicSpyTops.forEach(top => {
        const topIndex = dates.indexOf(top.date);
        if (topIndex === -1) {
            console.log(`${top.name} (${top.date}): SPY Top Datum nicht gefunden in Daten (evtl. Wochenende/Feiertag).`);
            return;
        }
        
        let maxQqq = 0;
        let maxQqqDate = '';
        
        // 90 Tage Lookback
        const startIdx = Math.max(0, topIndex - 90);
        for (let i = startIdx; i <= topIndex; i++) {
            if (qqqMap[dates[i]] > maxQqq) {
                maxQqq = qqqMap[dates[i]];
                maxQqqDate = dates[i];
            }
        }
        
        const daysDiff = topIndex - dates.indexOf(maxQqqDate);
        const qqqDrawdownAtSpyTop = ((qqqMap[top.date] - maxQqq) / maxQqq) * 100;

        console.log(`[${top.name}] SPY Top: ${top.date}`);
        console.log(`  -> QQQ lokales Top: ${maxQqqDate} (${daysDiff} Handelstage VOR dem SPY Top)`);
        console.log(`  -> QQQ lag am Tag des SPY Tops bereits ${qqqDrawdownAtSpyTop.toFixed(2)}% im Minus.`);
        console.log('----------------------------------------------------');
    });

    console.log('\n--- SYSTEMATISCHER DIVERGENZ-SCAN ---');
    // Finde alle Tage, an denen SPY auf einem 60-Tage-Hoch ist, QQQ aber bereits >= 5% darunter liegt.
    
    let divergenceSignals = [];
    const lookback = 60;

    for (let i = lookback; i < dates.length; i++) {
        const currentDate = dates[i];
        const currentSpy = spyMap[currentDate];
        const currentQqq = qqqMap[currentDate];

        let highestSpy = 0;
        let highestQqq = 0;

        for (let j = i - lookback; j <= i; j++) {
            if (spyMap[dates[j]] > highestSpy) highestSpy = spyMap[dates[j]];
            if (qqqMap[dates[j]] > highestQqq) highestQqq = qqqMap[dates[j]];
        }

        const spyDrawdown = ((currentSpy - highestSpy) / highestSpy) * 100;
        const qqqDrawdown = ((currentQqq - highestQqq) / highestQqq) * 100;

        // Bedingung: SPY ist maximal 1% vom Hoch entfernt (also fast am Top), QQQ schwächelt massiv (> -6%)
        if (spyDrawdown >= -1.0 && qqqDrawdown <= -6.0) {
            divergenceSignals.push({
                date: currentDate,
                spyDd: spyDrawdown,
                qqqDd: qqqDrawdown
            });
        }
    }

    // Gefundene Signale zusammenfassen (Dauerfeuer filtern)
    const filteredSignals = [];
    let lastSignalIdx = -999;
    
    divergenceSignals.forEach(sig => {
        const currentIdx = dates.indexOf(sig.date);
        if (currentIdx - lastSignalIdx > 20) { // Mindestens 20 Tage Abstand zwischen Signalen
            filteredSignals.push(sig);
            lastSignalIdx = currentIdx;
        }
    });

    console.log(`Es wurden ${filteredSignals.length} einzigartige Divergenz-Warnungen gefunden:`);
    filteredSignals.forEach(sig => {
        console.log(`🚨 Warnung am ${sig.date} | SPY Drawdown: ${sig.spyDd.toFixed(2)}% | QQQ Drawdown: ${sig.qqqDd.toFixed(2)}%`);
    });

}

runDivergenceAnalysis();
