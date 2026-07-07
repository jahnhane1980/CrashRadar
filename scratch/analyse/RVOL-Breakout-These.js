import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function runRvolBacktest() {
    console.log('========================================================');
    console.log('   STARTING RVOL BREAKOUT THESIS BACKTEST (YAHOO FINANCE)');
    console.log('========================================================\n');

    const symbols = [
        { name: 'MSTR', type: 'Einzelaktie (High Volatility)' },
        { name: 'COIN', type: 'Einzelaktie (Medium/High Volatility)' },
        { name: 'SPY', type: 'Index-ETF (S&P 500)' },
        { name: 'QQQ', type: 'Index-ETF (Nasdaq 100)' }
    ];

    const todayStr = new Date().toISOString().split('T')[0];

    for (const sym of symbols) {
        try {
            console.log(`Rufe historische Daten für ${sym.name} ab (seit 2015-01-01 bis ${todayStr})...`);
            
            // Verwende yahoo-finance2 um historische Tagesdaten zu holen
            const rawData = await yahooFinance.historical(sym.name, {
                period1: '2015-01-01',
                period2: todayStr,
                interval: '1d'
            });

            // Extrahiere und bereinige Candles
            const candles = rawData.map(d => ({
                date: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date),
                close: d.close,
                volume: d.volume
            })).filter(c => c.close !== null && c.close !== undefined && c.volume > 0);

            if (candles.length < 50) {
                console.log(`⚠️ Zu wenige Daten für ${sym.name} (${candles.length} Datensätze). Überspringe...\n`);
                continue;
            }

            console.log(`Daten geladen: ${candles.length} Handelstage. Starte Analyse...`);
            analyzeSymbol(sym, candles);

        } catch (error) {
            console.error(`❌ Fehler beim Abrufen/Analysieren von ${sym.name}:`, error.message);
        }
    }
}

function analyzeSymbol(symbolInfo, candles) {
    const { name, type } = symbolInfo;
    const horizons = [3, 5, 10, 20];
    const breakouts = [];

    // 1. Breakouts und RVOL identifizieren
    for (let i = 20; i < candles.length; i++) {
        const current = candles[i];

        // 20-Tage Volumen-Durchschnitt vor dem aktuellen Tag t
        let sumVol = 0;
        for (let j = i - 20; j < i; j++) {
            sumVol += candles[j].volume;
        }
        const avgVol = sumVol / 20;
        const rvol = avgVol > 0 ? current.volume / avgVol : 0;

        // 20-Tage Hoch der Schlusskurse vor dem aktuellen Tag t
        let highestClose = 0;
        for (let j = i - 20; j < i; j++) {
            if (candles[j].close > highestClose) {
                highestClose = candles[j].close;
            }
        }

        const isBreakout = current.close > highestClose;

        if (isBreakout) {
            // Forward-Returns messen
            const forwardReturns = {};
            for (const h of horizons) {
                if (i + h < candles.length) {
                    const futureClose = candles[i + h].close;
                    const ret = ((futureClose - current.close) / current.close) * 100;
                    forwardReturns[h] = ret;
                } else {
                    forwardReturns[h] = null;
                }
            }

            breakouts.push({
                date: current.date,
                close: current.close,
                rvol,
                forwardReturns
            });
        }
    }

    // 2. Gruppen initialisieren
    const stats = {
        all: { label: 'ALLE BREAKOUTS (Benchmark)', count: 0, winRate: {}, avgReturn: {} },
        normal: { label: 'NORMAL VOLUME (< 2.0 RVOL)', count: 0, winRate: {}, avgReturn: {} },
        rvol: { label: 'ANOMALOUS VOLUME (>= 2.0 RVOL) [Signal-Threshold]', count: 0, winRate: {}, avgReturn: {} },
        catalyst: { label: 'CATALYST VOLUME (>= 5.0 RVOL)', count: 0, winRate: {}, avgReturn: {} }
    };

    for (const group of Object.keys(stats)) {
        for (const h of horizons) {
            stats[group].winRate[h] = { wins: 0, total: 0 };
            stats[group].avgReturn[h] = { sum: 0, total: 0 };
        }
    }

    // 3. Auswertung befüllen
    for (const b of breakouts) {
        let group = 'normal';
        if (b.rvol >= 5.0) {
            group = 'catalyst';
        } else if (b.rvol >= 2.0) {
            group = 'rvol';
        }

        const updateGroupStats = (gName) => {
            stats[gName].count++;
            for (const h of horizons) {
                const ret = b.forwardReturns[h];
                if (ret !== null) {
                    stats[gName].winRate[h].total++;
                    stats[gName].avgReturn[h].total++;
                    stats[gName].avgReturn[h].sum += ret;
                    if (ret > 0) {
                        stats[gName].winRate[h].wins++;
                    }
                }
            }
        };

        updateGroupStats(group);
        updateGroupStats('all'); // Immer auch der Benchmark-Gruppe zuordnen
    }

    // 4. Ausgabe formatieren
    console.log('========================================================');
    console.log(`📊 ERGEBNISSE FÜR: ${name} (${type})`);
    console.log(`Gesamtanzahl Handelstage: ${candles.length} | Erkannte Breakouts: ${breakouts.length}`);
    console.log('========================================================');

    for (const [key, gData] of Object.entries(stats)) {
        console.log(`\n🔹 Gruppe: ${gData.label}`);
        console.log(`   Signale: ${gData.count} (${breakouts.length > 0 ? ((gData.count / breakouts.length) * 100).toFixed(1) : 0}%)`);
        
        if (gData.count === 0) {
            console.log('   Keine Signale in dieser Kategorie.');
            continue;
        }

        for (const h of horizons) {
            const wData = gData.winRate[h];
            const rData = gData.avgReturn[h];
            
            const winRatePct = wData.total > 0 ? (wData.wins / wData.total) * 100 : 0;
            const avgRetPct = rData.total > 0 ? (rData.sum / rData.total) : 0;

            console.log(
                `   👉 ${String(h).padStart(2, ' ')}-Tage Forward Return: ` +
                `Win Rate = ${winRatePct.toFixed(1)}% ` +
                `(${wData.wins}/${wData.total}) | ` +
                `Avg Return = ${avgRetPct >= 0 ? '+' : ''}${avgRetPct.toFixed(2)}%`
            );
        }
    }
    console.log('\n');
}

runRvolBacktest();
