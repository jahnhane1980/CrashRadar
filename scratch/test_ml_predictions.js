import 'dotenv/config';
import { AnalysisRepository } from '../src/core/repositories/AnalysisRepository.js';
import { MLRegimeService } from '../src/services/MLRegimeService.js';

async function runTests() {
    console.log('Lade Daten aus der DB...');
    const repo = new AnalysisRepository(process.env.DATABASE_URL);
    const data = await repo.getAllRawData('1999-01-01');
    await repo.close();

    const qqqCandles = data.tiingo
        .filter(d => d.symbol === 'QQQ' && d.close !== null)
        .map(d => ({ date: d.date, close: Number(d.close) }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`Lade QQQ-Modell (qqq_regime_v1)...`);
    const mlQqq = new MLRegimeService('qqq_regime_v1');
    await mlQqq.loadModel();

    console.log('\n--- 🧠 Teste QQQ Regime Model an kritischen Wendepunkten ---\n');

    const testDates = [
        { date: '2000-03-09', desc: 'Dotcom Peak (Erwartet: MACRO_TOP)' },
        { date: '2002-10-09', desc: 'Dotcom Bottom (Erwartet: MACRO_BOTTOM)' },
        { date: '2008-11-20', desc: 'Finanzkrise Absturz (Erwartet: DOWNTREND)' },
        { date: '2020-02-19', desc: 'Corona Peak (Erwartet: MACRO_TOP)' },
        { date: '2020-03-16', desc: 'Corona Bottom (Erwartet: MACRO_BOTTOM)' },
        { date: '2021-07-15', desc: 'Mitten im Tech-Bullrun (Erwartet: UPTREND)' },
        { date: '2022-06-15', desc: 'Mitten im Zins-Bärenmarkt (Erwartet: DOWNTREND)' },
        { date: '2025-02-19', desc: 'Aktueller Crash Peak (Erwartet: MACRO_TOP)' }
    ];

    for (const test of testDates) {
        // Finde den Index für das genaue Datum (oder den Tag davor, falls Wochenende)
        let idx = qqqCandles.findIndex(c => c.date >= test.date);
        
        if (idx === -1) {
            console.log(`Datum ${test.date} nicht gefunden. Test übersprungen.`);
            continue;
        }

        // Wir brauchen ca. 50 Kerzen vor diesem Datum für das Sequence Fenster + Warmup (RSI)
        if (idx < 50) {
            console.log(`Nicht genug Historie für ${test.date}.`);
            continue;
        }

        // Die Slice-Logik: Wir nehmen die 50 Kerzen BIS ZU (und inklusive) dem Test-Datum
        const inputCandles = qqqCandles.slice(idx - 50, idx + 1);
        
        // --- Makro-Werte zum gleichen Datum heraussuchen ---
        const getLatest = (array, dateStr, valueKey, filterFn = null) => {
            let filtered = array;
            if (filterFn) filtered = filtered.filter(filterFn);
            
            // Finde den aktuellsten Wert VOR oder AN dem Test-Datum
            const relevant = filtered.filter(d => d.date <= dateStr).sort((a, b) => new Date(b.date) - new Date(a.date));
            if (relevant.length === 0) return 'N/A';
            return relevant[0][valueKey];
        };

        const SKEW = getLatest(data.yahoo, test.date, 'close', d => d.symbol === '^SKEW');
        const PCR = getLatest(data.pcr, test.date, 'total_pcr');
        const ShortVol = getLatest(data.shortVolume, test.date, 'short_volume_ratio', d => d.symbol === 'SPY');
        const MarginDebt = getLatest(data.finra, test.date, 'MarginDebt');
        let TGA = getLatest(data.tga, test.date, 'close_balance');
        if (TGA === 'null' || TGA === null) TGA = getLatest(data.tga, test.date, 'open_balance');
        if (TGA !== 'N/A' && TGA !== null) TGA = (Number(TGA) / 1000).toFixed(0) + ' Mrd'; // In Milliarden
        
        try {
            const prediction = await mlQqq.predict(inputCandles);
            const actualDate = inputCandles[inputCandles.length - 1].date;

            console.log(`📅 Datum: ${actualDate} | ${test.desc}`);
            console.log(`🎯 KI Vorhersage: ${prediction.phase} (Confidence: ${(prediction.confidence * 100).toFixed(1)}%)`);
            console.log(`   Makro-Vetos an diesem Tag:`);
            console.log(`   - SKEW Index: ${typeof SKEW === 'number' ? SKEW.toFixed(2) : SKEW} (Gefahr ab 145)`);
            console.log(`   - SPY Put/Call Ratio: ${typeof PCR === 'number' ? PCR.toFixed(2) : PCR} (Bullenmarkt-Euphorie unter 0.75)`);
            console.log(`   - SPY Short Volume: ${typeof ShortVol === 'number' ? (ShortVol * 100).toFixed(1) + '%' : ShortVol} (Bären-Kapitulation unter 45%)`);
            console.log(`   - FINRA Margin Debt: ${MarginDebt !== 'N/A' ? (Number(MarginDebt)/1000).toFixed(0) + ' Mrd' : 'N/A'}`);
            console.log(`   - TGA (Staatskonto): ${TGA}`);
            console.log('--------------------------------------------------');
        } catch(e) {
             console.log(`Fehler bei ${test.date}: ${e.message}`);
        }
    }
}

runTests().catch(console.error);
