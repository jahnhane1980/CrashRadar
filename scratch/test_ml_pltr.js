import 'dotenv/config';
import { AnalysisRepository } from '../src/core/repositories/AnalysisRepository.js';
import { MLRegimeService } from '../src/services/MLRegimeService.js';

async function runTests() {
    console.log('Lade Daten aus der DB...');
    const repo = new AnalysisRepository(process.env.DATABASE_URL);
    const data = await repo.getAllRawData('2020-09-01');
    await repo.close();

    const pltrCandles = data.tiingo
        .filter(d => d.symbol === 'PLTR' && d.close !== null)
        .map(d => ({ date: d.date, close: Number(d.close) }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`Lade PLTR-Modell (pltr_regime_v1) für den PLTR Test...`);
    const mlPltr = new MLRegimeService('pltr_regime_v1');
    await mlPltr.loadModel();

    console.log(`Gefunden: ${pltrCandles.length} PLTR Kerzen.`);
    console.log('\n--- 🧠 Teste QQQ Regime Model an PLTR Extrem-Punkten ---\n');

    // Bekannte historische Punkte für PLTR
    const testDates = [
        { date: '2021-01-27', desc: 'Meme-Stock Peak (Erwartet: MACRO_TOP)' },
        { date: '2022-12-28', desc: 'Tech-Winter Boden (Erwartet: MACRO_BOTTOM)' },
        { date: '2024-03-01', desc: 'Mitten im KI-Rally Uptrend (Erwartet: UPTREND)' },
        { date: '2025-02-19', desc: 'Aktueller Markt-Peak (Erwartet: MACRO_TOP oder UPTREND)' },
        { date: pltrCandles[pltrCandles.length - 1].date, desc: 'Aktueller Status (HEUTE)' }
    ];

    for (const test of testDates) {
        let idx = pltrCandles.findIndex(c => c.date >= test.date);
        
        if (idx === -1) {
            console.log(`Datum ${test.date} nicht gefunden. Test übersprungen.`);
            continue;
        }

        if (idx < 50) {
            console.log(`Nicht genug Historie für ${test.date}.`);
            continue;
        }

        const inputCandles = pltrCandles.slice(idx - 50, idx + 1);
        
        try {
            const prediction = await mlPltr.predict(inputCandles);
            const actualDate = inputCandles[inputCandles.length - 1].date;

            console.log(`📅 Datum: ${actualDate} | ${test.desc}`);
            console.log(`🎯 KI Vorhersage: ${prediction.phase} (Confidence: ${(prediction.confidence * 100).toFixed(1)}%)`);
            console.log(`   Wahrscheinlichkeiten: TOP: ${(prediction.rawScores.MACRO_TOP * 100).toFixed(1)}% | BOTTOM: ${(prediction.rawScores.MACRO_BOTTOM * 100).toFixed(1)}% | UP: ${(prediction.rawScores.UPTREND * 100).toFixed(1)}% | DOWN: ${(prediction.rawScores.DOWNTREND * 100).toFixed(1)}%`);
            console.log('--------------------------------------------------');
        } catch(e) {
             console.log(`Fehler bei ${test.date}: ${e.message}`);
        }
    }
}

runTests().catch(console.error);
