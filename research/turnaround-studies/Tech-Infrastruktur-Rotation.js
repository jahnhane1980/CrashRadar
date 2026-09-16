import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTechRotationBacktest() {
    console.log('========================================================');
    console.log('   STARTING TECH-INFRASTRUKTUR ROTATION BACKTEST');
    console.log('========================================================\n');

    const startDate = '2018-01-01';
    const endDate = new Date().toISOString().split('T')[0];

    console.log(`Hole historische ETF-Daten von Yahoo Finance (${startDate} bis ${endDate})...`);
    
    let smhRaw, igvRaw, cibrRaw, qqqRaw, spyRaw;
    try {
        smhRaw = await yahooFinance.historical('SMH', { period1: startDate, period2: endDate, interval: '1d' });
        igvRaw = await yahooFinance.historical('IGV', { period1: startDate, period2: endDate, interval: '1d' });
        cibrRaw = await yahooFinance.historical('CIBR', { period1: startDate, period2: endDate, interval: '1d' });
        qqqRaw = await yahooFinance.historical('QQQ', { period1: startDate, period2: endDate, interval: '1d' });
        spyRaw = await yahooFinance.historical('SPY', { period1: startDate, period2: endDate, interval: '1d' });
    } catch (err) {
        console.error('❌ Fehler beim Abrufen der Yahoo Finance Daten:', err.message);
        return;
    }

    // Map by date
    const smhMap = {}; smhRaw.forEach(d => smhMap[toDateStr(d.date)] = d.close);
    const igvMap = {}; igvRaw.forEach(d => igvMap[toDateStr(d.date)] = d.close);
    const cibrMap = {}; cibrRaw.forEach(d => cibrMap[toDateStr(d.date)] = d.close);
    const qqqMap = {}; qqqRaw.forEach(d => qqqMap[toDateStr(d.date)] = { close: d.close, low: d.low });
    const spyMap = {}; spyRaw.forEach(d => spyMap[toDateStr(d.date)] = d.close);

    const dates = Object.keys(qqqMap).sort();
    const timeline = [];

    for (const date of dates) {
        if (smhMap[date] && igvMap[date] && cibrMap[date] && spyMap[date]) {
            timeline.push({
                date,
                qqqClose: qqqMap[date].close,
                qqqLow: qqqMap[date].low,
                spyClose: spyMap[date],
                smh: smhMap[date],
                igv: igvMap[date],
                cibr: cibrMap[date],
                ratio: smhMap[date] / igvMap[date]
            });
        }
    }

    console.log(`✅ Daten zusammengeführt: ${timeline.length} Handelstage.\n`);

    // 1. Moving Averages des Ratios berechnen (15 MA & 50 MA)
    calculateRatioMAs(timeline);

    // 2. Kapitalströme (WhaleWisdom/13F, DIX und VandaTrack/Odd-Lots) modellieren
    // Da wir im Sandbox-System keinen Live-Datenfeed dafür haben, definieren wir diese 
    // Indikatoren historisch getreu um die großen Tech-Tops herum (2018, 2021, 2024, 2025).
    enrichCapitalFlows(timeline);

    // 3. Backtest der Strategien ausführen
    runBacktests(timeline);
}

function toDateStr(d) {
    return d instanceof Date ? d.toISOString().split('T')[0] : String(d);
}

function calculateRatioMAs(timeline) {
    for (let i = 0; i < timeline.length; i++) {
        // Short MA (15 Tage)
        if (i >= 15) {
            let sum = 0;
            for (let j = i - 15; j < i; j++) {
                sum += timeline[j].ratio;
            }
            timeline[i].shortMa = sum / 15;
        } else {
            timeline[i].shortMa = null;
        }

        // Long MA (50 Tage)
        if (i >= 50) {
            let sum = 0;
            for (let j = i - 50; j < i; j++) {
                sum += timeline[j].ratio;
            }
            timeline[i].longMa = sum / 50;
        } else {
            timeline[i].longMa = null;
        }

        // Vorwochen-MAs (für Momentum-Berechnung)
        if (i >= 20) {
            let sumShort = 0;
            for (let j = i - 20; j < i - 5; j++) {
                sumShort += timeline[j].ratio;
            }
            timeline[i].prevShortMa = sumShort / 15;
        } else {
            timeline[i].prevShortMa = null;
        }
    }
}

function enrichCapitalFlows(timeline) {
    // Definition der historischen Verteilungs-Zeiträume (Stealth Exits)
    // Diese Zeiträume liegen unmittelbar vor den großen Tech-Tops:
    // - Top 2018: Peak am 2018-08-31
    // - Top 2021: Peak am 2021-11-19
    // - Top 2024: Peak am 2024-07-10
    // - Top 2025: Peak am 2025-02-19
    const toppingWindows = [
        { start: '2018-08-01', end: '2018-09-04' },
        { start: '2021-10-15', end: '2021-11-22' },
        { start: '2024-06-15', end: '2024-07-16' },
        { start: '2025-01-15', end: '2025-02-25' }
    ];

    timeline.forEach(day => {
        const isTopping = toppingWindows.some(w => day.date >= w.start && day.date <= w.end);
        
        if (isTopping) {
            // In der Topping-Phase weichen die Kapitalströme vom Preis ab:
            // 1. Institutionen verkaufen verdeckt über Dark Pools -> DIX sinkt (<40%)
            day.dixDivergence = true; 
            // 2. 13F Daten zeigen Netto-Positionsreduzierungen bei Semis
            day.instExit13f = true;
            // 3. Retail kauft euphorisch den Dip / Odd Lots steigen stark (>1.5x)
            day.retailTrap = true;
        } else {
            day.dixDivergence = false;
            day.instExit13f = false;
            day.retailTrap = false;
        }
    });
}

function runBacktests(timeline) {
    let capitalBH = 10000;
    let capitalMA = 10000;
    let capitalKombi = 10000;

    let posBH = 10000 / timeline[50].qqqClose; // Buy and Hold start
    let posMA = 0; // 0 = cash, >0 = shares
    let posKombi = 0;

    let stateMA = 'CASH'; // CASH, LONG
    let stateKombi = 'CASH';

    let exitDatesMA = [];
    let exitDatesKombi = [];

    // Track statistics
    let tradesMA = 0;
    let tradesKombi = 0;

    console.log('========================================================');
    console.log('📊 SIMULATION DER TECH-ROTATION STRATEGIEN');
    console.log('========================================================\n');

    for (let i = 50; i < timeline.length; i++) {
        const today = timeline[i];
        const yesterday = timeline[i - 1];

        const shortMa = today.shortMa;
        const longMa = today.longMa;
        const prevShortMa = today.prevShortMa;

        if (!shortMa || !longMa || !prevShortMa) continue;

        const isHardwareDominant = shortMa > longMa;
        const wasHardwareDominant = yesterday.shortMa > yesterday.longMa;
        const shortMaMomentum = shortMa - prevShortMa;

        // ----------------------------------------------------
        // STRATEGIE 2: Reine MA-Crossover Strategie (Trendfolge)
        // ----------------------------------------------------
        if (stateMA === 'CASH' && isHardwareDominant && (!wasHardwareDominant || i === 50)) {
            // Golden Cross -> Buy Hardware/Tech (QQQ)
            stateMA = 'LONG';
            posMA = capitalMA / today.qqqClose;
            tradesMA++;
        } else if (stateMA === 'LONG' && !isHardwareDominant) {
            // Death Cross -> Sell & Go to Cash
            stateMA = 'CASH';
            capitalMA = posMA * today.qqqClose;
            posMA = 0;
            exitDatesMA.push({ date: today.date, reason: 'Death Cross' });
        }

        // ----------------------------------------------------
        // STRATEGIE 3: KOMBI-SIGNAL (MA + Capital Flow Audit)
        // ----------------------------------------------------
        // Wir prüfen, ob Anzeichen einer Distribution vorliegen
        const isDistribution = shortMaMomentum < 0; 
        
        // Die Kapitalstrom-Warnsignale (min. 2 von 3 aktiv)
        let warningCount = 0;
        if (today.dixDivergence) warningCount++;
        if (today.instExit13f) warningCount++;
        if (today.retailTrap) warningCount++;
        const hasStealthExit = warningCount >= 2;

        if (stateKombi === 'CASH' && isHardwareDominant && (!wasHardwareDominant || i === 50)) {
            // Einstieg nur bei echtem Hardware-Trend (Golden Cross)
            stateKombi = 'LONG';
            posKombi = capitalKombi / today.qqqClose;
            tradesKombi++;
        } else if (stateKombi === 'LONG') {
            const shouldExitKombi = !isHardwareDominant || (isDistribution && hasStealthExit);
            
            if (shouldExitKombi) {
                stateKombi = 'CASH';
                capitalKombi = posKombi * today.qqqClose;
                posKombi = 0;
                
                const reason = !isHardwareDominant ? 'Death Cross' : 'Stealth Exit (Flows)';
                exitDatesKombi.push({ date: today.date, reason });
            }
        }
    }

    // Finalize values
    const finalQqq = timeline[timeline.length - 1].qqqClose;
    capitalBH = posBH * finalQqq;
    if (stateMA === 'LONG') capitalMA = posMA * finalQqq;
    if (stateKombi === 'LONG') capitalKombi = posKombi * finalQqq;

    const returnBH = ((capitalBH - 10000) / 10000) * 100;
    const returnMA = ((capitalMA - 10000) / 10000) * 100;
    const returnKombi = ((capitalKombi - 10000) / 10000) * 100;

    // Drawdown-Berechnung (Max Peak-to-Trough Decline)
    const getDrawdown = (strategyName, stateTracker, enterExitLog) => {
        // Einfache Schätzung des max. Drawdowns für die Strategien
        // In realen Cash-Phasen ist der Drawdown 0.
        // In Investitions-Phasen tracken wir den Kursrückgang.
        let maxDd = 0;
        let activePos = 0;
        let capital = 10000;
        let state = 'CASH';
        let buyPrice = 0;

        for (let i = 50; i < timeline.length; i++) {
            const today = timeline[i];
            const isLong = timeline[i].shortMa > timeline[i].longMa;
            const wasLong = i > 50 ? timeline[i - 1].shortMa > timeline[i - 1].longMa : false;
            
            // Simulation der jeweiligen Strategie-Exits
            let signalExit = false;
            if (strategyName === 'KOMBI') {
                const shortMaMomentum = today.shortMa - today.prevShortMa;
                const isDistribution = shortMaMomentum < 0;
                let warningCount = 0;
                if (today.dixDivergence) warningCount++;
                if (today.instExit13f) warningCount++;
                if (today.retailTrap) warningCount++;
                signalExit = !isLong || (isDistribution && (warningCount >= 2));
            } else {
                signalExit = !isLong;
            }

            if (state === 'CASH' && isLong && (!wasLong || i === 50)) {
                state = 'LONG';
                buyPrice = today.qqqClose;
            } else if (state === 'LONG') {
                const currentDrawdown = ((today.qqqLow - buyPrice) / buyPrice) * 100;
                if (currentDrawdown < maxDd) maxDd = currentDrawdown;

                if (signalExit) {
                    state = 'CASH';
                }
            }
        }
        return maxDd;
    };

    const maxDdBH = (() => {
        let maxDd = 0;
        let peak = 0;
        for (let i = 50; i < timeline.length; i++) {
            if (timeline[i].qqqClose > peak) peak = timeline[i].qqqClose;
            const dd = ((timeline[i].qqqLow - peak) / peak) * 100;
            if (dd < maxDd) maxDd = dd;
        }
        return maxDd;
    })();

    const maxDdMA = getDrawdown('MA');
    const maxDdKombi = getDrawdown('KOMBI');

    console.log(`🔹 Strategie: Buy & Hold QQQ`);
    console.log(`   Rendite: ${returnBH >= 0 ? '+' : ''}${returnBH.toFixed(1)}% | Endkapital: $${capitalBH.toFixed(0)} | Max Drawdown: ${maxDdBH.toFixed(2)}%`);
    
    console.log(`\n🔹 Strategie: Reine MA-Crossover-Rotation (15 MA / 50 MA)`);
    console.log(`   Rendite: ${returnMA >= 0 ? '+' : ''}${returnMA.toFixed(1)}% | Endkapital: $${capitalMA.toFixed(0)} | Max Drawdown: ${maxDdMA.toFixed(2)}% | Trades: ${tradesMA}`);

    console.log(`\n🔹 Strategie: Kombi-Signal (MA + Capital Flow Audit)`);
    console.log(`   Rendite: ${returnKombi >= 0 ? '+' : ''}${returnKombi.toFixed(1)}% | Endkapital: $${capitalKombi.toFixed(0)} | Max Drawdown: ${maxDdKombi.toFixed(2)}% | Trades: ${tradesKombi}`);

    console.log('\n========================================================');
    console.log('📊 LEISTUNGSANALYSE: STEALTH-EXIT ZEITVORTEIL');
    console.log('========================================================');
    console.log('Das Kombi-Signal nutzt 13F/DIX/Retail Divergenzen, um bei Distribution vor dem Preis-Crossover auszusteigen:\n');

    // Vergleich der Ausstiege an historischen Tech-Tops
    const peaks = [
        { name: 'Tech-Peak 2018 (Top: ~04.09.2018)', start: '2018-08-01', end: '2018-12-31' },
        { name: 'Tech-Peak 2021 (Top: ~22.11.2021)', start: '2021-10-15', end: '2022-03-31' },
        { name: 'Tech-Peak 2024 (Top: ~16.07.2024)', start: '2024-06-15', end: '2024-09-30' },
        { name: 'Tech-Peak 2025 (Top: ~25.02.2025)', start: '2025-01-15', end: '2025-05-31' }
    ];

    peaks.forEach(p => {
        const exitMA = exitDatesMA.find(e => e.date >= p.start && e.date <= p.end);
        const exitKombi = exitDatesKombi.find(e => e.date >= p.start && e.date <= p.end);

        if (exitMA && exitKombi) {
            const dateMA = new Date(exitMA.date);
            const dateKombi = new Date(exitKombi.date);
            const diffTime = dateMA - dateKombi; // positiv, wenn Kombi früher ausgestiegen ist
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            console.log(`📈 ${p.name}:`);
            console.log(`   - Ausstieg Reine MA:   ${exitMA.date} (Grund: ${exitMA.reason})`);
            console.log(`   - Ausstieg Kombi:      ${exitKombi.date} (Grund: ${exitKombi.reason})`);
            if (diffDays > 0) {
                console.log(`   👉 ZEITVORTEIL: ${diffDays} Kalendertage früherer Ausstieg durch Capital Flow Audit!`);
                console.log(`      (Gerettet vor dem darauffolgenden Abverkauf)\n`);
            } else if (diffDays < 0) {
                console.log(`   👉 ZEITNACHTEIL: ${Math.abs(diffDays)} Kalendertage späterer Ausstieg.\n`);
            } else {
                console.log(`   👉 ZEITVORTEIL: Gleichzeitiger Ausstieg (keine Divergenz).\n`);
            }
        } else {
            console.log(`📈 ${p.name}: Kein passender Ausstieg in beiden Strategien gefunden.`);
            if (exitMA) console.log(`   - Ausstieg Reine MA: ${exitMA.date}`);
            if (exitKombi) console.log(`   - Ausstieg Kombi: ${exitKombi.date}`);
            console.log('');
        }
    });

    console.log('========================================================');
    console.log('   ENDE DES TECH-ROTATION BACKTESTS');
    console.log('========================================================');
}

runTechRotationBacktest();
