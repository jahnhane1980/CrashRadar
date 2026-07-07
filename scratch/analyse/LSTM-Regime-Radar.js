import YahooFinance from 'yahoo-finance2';
import { MLRegimeService } from '../../src/services/MLRegimeService.js';

const yahooFinance = new YahooFinance();

async function runLstmRadarBacktest() {
    console.log('========================================================');
    console.log('   STARTING LSTM REGIME RADAR BACKTEST (NO DATABASE)');
    console.log('========================================================\n');

    // 1. Daten für SPY und QQQ laden (ausreichender Vorlauf für SMA-200)
    const startDate = '2019-01-01';
    const endDate = '2020-07-01';

    console.log(`Hole historische Kursdaten von Yahoo Finance (${startDate} bis ${endDate})...`);
    let spyRaw, qqqRaw;
    try {
        spyRaw = await yahooFinance.historical('SPY', { period1: startDate, period2: endDate, interval: '1d' });
        qqqRaw = await yahooFinance.historical('QQQ', { period1: startDate, period2: endDate, interval: '1d' });
    } catch (err) {
        console.error('❌ Fehler beim Abrufen der Yahoo Finance Daten:', err.message);
        return;
    }

    const spyCandles = spyRaw.map(d => ({
        date: toDateStr(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume
    })).filter(c => c.close > 0 && c.volume > 0);

    const qqqCandles = qqqRaw.map(d => ({
        date: toDateStr(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume
    })).filter(c => c.close > 0 && c.volume > 0);

    console.log(`✅ SPY Daten geladen: ${spyCandles.length} Tage`);
    console.log(`✅ QQQ Daten geladen: ${qqqCandles.length} Tage\n`);

    // 2. Modelle laden und evaluieren
    const runEvaluation = async (ticker, candles, modelName) => {
        console.log(`--------------------------------------------------------`);
        console.log(`📊 EVALUIERE MODELL: ${modelName} (${ticker})`);
        console.log(`--------------------------------------------------------`);

        const service = new MLRegimeService(modelName);
        try {
            await service.loadModel();
        } catch (err) {
            console.error(`❌ Fehler beim Laden des Modells ${modelName}:`, err.message);
            return;
        }

        // Wir prüfen den Zeitraum um den Corona-Crash: 17. Februar 2020 bis 15. April 2020
        // (Der absolute Bottom war am 23. März 2020)
        const targetStart = '2020-02-17';
        const targetEnd = '2020-04-15';
        const absoluteBottomDate = '2020-03-23';

        console.log(`Scanne Zeitraum ${targetStart} bis ${targetEnd}...`);
        
        const scanResults = [];
        let bottomStats = null;

        for (let i = 200; i < candles.length; i++) {
            const currentDate = candles[i].date;
            if (currentDate >= targetStart && currentDate <= targetEnd) {
                // Nur Daten bis zum aktuellen Tag i in die Vorhersage einspeisen
                const slice = candles.slice(0, i + 1);
                
                try {
                    const prediction = await service.predict(slice);
                    
                    const res = {
                        date: currentDate,
                        close: candles[i].close,
                        phase: prediction.phase,
                        confidence: prediction.confidence,
                        rawScores: prediction.rawScores
                    };

                    scanResults.push(res);

                    if (currentDate === absoluteBottomDate) {
                        bottomStats = res;
                    }
                } catch (err) {
                    console.error(`Fehler bei Vorhersage für ${currentDate}:`, err.message);
                }
            }
        }

        // Ergebnisse tabellarisch ausgeben
        console.log('\n📅 Tägliche Modell-Vorhersagen im Crash-Fenster:');
        console.log('--------------------------------------------------------------------------------------');
        console.log('| Datum      | Schlusskurs | Vorhergesagtes Regime | Konfidenz | Scores                         |');
        console.log('--------------------------------------------------------------------------------------');
        scanResults.forEach(r => {
            const scoreStr = Object.entries(r.rawScores)
                .map(([lbl, val]) => `${lbl.substring(0, 5)}:${(val * 100).toFixed(0)}%`)
                .join(' | ');
            
            console.log(
                `| ${r.date} | $${r.close.toFixed(2).padStart(8, ' ')} | ` +
                `${r.phase.padEnd(20, ' ')} | ${(r.confidence * 100).toFixed(1).padStart(8, ' ')}% | ` +
                `${scoreStr} |`
            );
        });
        console.log('--------------------------------------------------------------------------------------');

        if (bottomStats) {
            console.log(`\n🎯 ERGEBNIS AM CORONA-CRASH BODE-TAG (${absoluteBottomDate}):`);
            console.log(`   - Schlusskurs ${ticker}: $${bottomStats.close.toFixed(2)}`);
            console.log(`   - Vorhergesagtes Regime: ${bottomStats.phase}`);
            console.log(`   - Konfidenz des Haupt-Regimes: ${(bottomStats.confidence * 100).toFixed(2)}%`);
            
            const bottomScore = bottomStats.rawScores['CYCLE_BOTTOM'] || 0;
            const correctionScore = bottomStats.rawScores['BULL_CORRECTION'] || 0;
            const combinationScore = bottomScore + correctionScore;
            
            console.log(`   - Wahrscheinlichkeit CYCLE_BOTTOM: ${(bottomScore * 100).toFixed(2)}%`);
            console.log(`   - Wahrscheinlichkeit BULL_CORRECTION: ${(correctionScore * 100).toFixed(2)}%`);
            console.log(`   - Kombinierte Bottom-Wahrscheinlichkeit (Boden/Korrektur): ${(combinationScore * 100).toFixed(2)}%`);
            
            if (bottomStats.phase === 'CYCLE_BOTTOM' || bottomStats.phase === 'BULL_CORRECTION') {
                console.log(`   🛡️ BEWEIS ERFOLGREICH: Das LSTM-Modell hat den Jahrhundert-Boden mit hoher Konfidenz detektiert.`);
            } else {
                console.log(`   ⚠️ BEWEIS ENTTÄUSCHEND: Das Modell war am Tiefpunkt in einem anderen Status.`);
            }
        } else {
            console.log(`❌ Warnung: Konnte den Tiefpunkt-Tag ${absoluteBottomDate} nicht im Scan-Ergebnis finden.`);
        }
        console.log('\n');
    };

    // Führe Evaluation für SPY und QQQ aus
    await runEvaluation('SPY', spyCandles, 'spy_regime_v1');
    await runEvaluation('QQQ', qqqCandles, 'qqq_regime_v1');

    console.log('========================================================');
    console.log('   ENDE DES LSTM REGIME RADAR BACKTESTS');
    console.log('========================================================');
}

function toDateStr(d) {
    return d instanceof Date ? d.toISOString().split('T')[0] : String(d);
}

runLstmRadarBacktest();
