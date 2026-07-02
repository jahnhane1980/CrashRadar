import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';
import { AnalysisRepository } from '../../src/core/repositories/AnalysisRepository.js';
import { MLRegimeService } from '../../src/services/MLRegimeService.js';
import { RegimeLabeler } from '../../src/analysis/RegimeLabeler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDate(dateObj) {
    if (typeof dateObj === 'string') return dateObj.split('T')[0];
    return dateObj.toISOString().split('T')[0];
}

async function run() {
    program
      .requiredOption('-t, --ticker <string>', 'Der Ticker für das Modell (z.B. SPY, BTC, QQQ)')
      .parse(process.argv);
    
    const options = program.opts();
    const ticker = options.ticker.toUpperCase();

    const configPath = path.join(__dirname, '../../config/ML-Config.json');
    const mlConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const tickerConfig = mlConfig.tickers[ticker] || {};
    const version = tickerConfig.version || mlConfig.default.version || 'v1';
    
    const modelName = `${ticker.toLowerCase()}_regime_${version}`;
    console.log(`\nStarte Auto-Test für Ticker: ${ticker} (Modell: ${modelName})`);

    const repo = new AnalysisRepository(process.env.DATABASE_URL);
    const ml = new MLRegimeService(modelName);
    await ml.loadModel();

    // 1. Hole Rohdaten
    const rawData = await repo.getOhlcvForTicker(ticker, '2015-01-01');
    if (rawData.length < 300) {
        console.error("Nicht genug Daten für den Test.");
        process.exit(1);
    }

    // 2. Erzeuge Ground Truth Labels
    const labelerData = rawData.map(c => ({
        date: formatDate(c.date),
        assets: { [ticker]: Number(c.close) }
    }));
    
    const labeler = new RegimeLabeler(labelerData, ticker);
    const trueLabels = labeler.generateLabels();

    // 3. Wähle Testpunkte dynamisch aus
    const testPoints = [];
    
    const findSamples = (targetLabel, count, description) => {
        const matches = trueLabels.filter(l => l.label === targetLabel);
        if (matches.length === 0) return;
        
        const step = Math.max(1, Math.floor(matches.length / count));
        for(let i=0; i<count && i*step < matches.length; i++) {
            const match = matches[i*step];
            const rawIndex = rawData.findIndex(r => formatDate(r.date) === match.date);
            if (rawIndex >= 210) {
                 testPoints.push({ index: rawIndex, date: match.date, trueLabel: match.label, desc: description });
            }
        }
    };

    // Suche nach Tops
    const tops = trueLabels.filter(l => l.label === 'CYCLE_TOP');
    if (tops.length > 0) {
         const lastTop = tops[tops.length - 1];
         const rawIndex = rawData.findIndex(r => formatDate(r.date) === lastTop.date);
         if (rawIndex >= 210) {
             testPoints.push({ index: rawIndex - 14, date: formatDate(rawData[rawIndex - 14].date), trueLabel: trueLabels[rawIndex - 14].label, desc: "14 Tage VOR letztem Top" });
             testPoints.push({ index: rawIndex, date: lastTop.date, trueLabel: 'CYCLE_TOP', desc: "Exakt AM letzten Top" });
             if (rawIndex + 14 < rawData.length) {
                 testPoints.push({ index: rawIndex + 14, date: formatDate(rawData[rawIndex + 14].date), trueLabel: trueLabels[rawIndex + 14].label, desc: "14 Tage NACH letztem Top" });
             }
         }
    }

    // Suche nach Bottoms
    const bottoms = trueLabels.filter(l => l.label === 'CYCLE_BOTTOM');
    if (bottoms.length > 0) {
         const lastBot = bottoms[bottoms.length - 1];
         const rawIndex = rawData.findIndex(r => formatDate(r.date) === lastBot.date);
         if (rawIndex >= 210) {
             testPoints.push({ index: rawIndex - 14, date: formatDate(rawData[rawIndex - 14].date), trueLabel: trueLabels[rawIndex - 14].label, desc: "14 Tage VOR letztem Bottom" });
             testPoints.push({ index: rawIndex, date: lastBot.date, trueLabel: 'CYCLE_BOTTOM', desc: "Exakt AM letzten Bottom" });
             if (rawIndex + 14 < rawData.length) {
                 testPoints.push({ index: rawIndex + 14, date: formatDate(rawData[rawIndex + 14].date), trueLabel: trueLabels[rawIndex + 14].label, desc: "14 Tage NACH letztem Bottom" });
             }
         }
    }

    if (ticker === 'PLTR') {
        const pltrManualDates = [
            { d: '2021-01-27', label: 'CYCLE_TOP', desc: 'Meme-Top Hype (Reddit)' },
            { d: '2021-05-11', label: 'BEAR_MARKET', desc: 'Klassischer Absturz' },
            { d: '2022-12-28', label: 'BASE', desc: 'Absoluter Tiefpunkt der Todeszone (Base)' },
            { d: '2023-05-08', label: 'BULL_MARKET', desc: 'Earnings Breakout aus der Base' },
            { d: '2024-02-05', label: 'BULL_MARKET', desc: 'Erneuter starker Earnings-Push' }
        ];
        
        for (const md of pltrManualDates) {
            const rawIndex = rawData.findIndex(r => formatDate(r.date) === md.d);
            if (rawIndex >= 210) {
                testPoints.push({ index: rawIndex, date: md.d, trueLabel: md.label, desc: md.desc });
            }
        }
    } else {
        findSamples('BULL_MARKET', 2, "Klassischer Bullenmarkt");
        findSamples('BEAR_MARKET', 2, "Klassischer Bärenmarkt");
        findSamples('BASE', 2, "Akkumulations-Base");
    }
    findSamples('BULL_CORRECTION', 1, "Korrektur (Seitwärts im Bull)");
    findSamples('BEAR_RALLY', 1, "Erholung (Seitwärts im Bear)");

    // Letzter Tag
    testPoints.push({ index: rawData.length - 1, date: labelerData[labelerData.length - 1].date, trueLabel: trueLabels[trueLabels.length - 1].label, desc: "Aktueller Stand (Heute)" });

    // Entferne Duplikate durch gleiches Datum
    const uniquePoints = [];
    const seen = new Set();
    for (const tp of testPoints.sort((a,b) => a.index - b.index)) {
        if (!seen.has(tp.date)) {
            seen.add(tp.date);
            uniquePoints.push(tp);
        }
    }

    // 4. Testlauf
    let correct = 0;
    
    for (const tp of uniquePoints) {
        // Wir übergeben genug Kerzen für das Indikatoren-Warmup (SMA200 braucht 210)
        const recentCandles = rawData.slice(tp.index - 210, tp.index + 1).map(c => ({
            date: formatDate(c.date),
            close: Number(c.close),
            high: Number(c.high),
            low: Number(c.low),
            volume: Number(c.volume)
        }));

        try {
            const result = await ml.predict(recentCandles);
            const actualClose = recentCandles[recentCandles.length - 1].close;
            const pred = result.phase;
            const isMatch = pred === tp.trueLabel;
            if (isMatch) correct++;

            console.log(`\n----------------------------------------`);
            console.log(`📅 Datum: ${tp.date} | 🏷️  Szenario: ${tp.desc}`);
            console.log(`💵 Close: $${actualClose.toFixed(2)}`);
            console.log(`🎯 Realität (Labeler) : ${tp.trueLabel}`);
            console.log(`${isMatch ? '✅' : '❌'} ML Vorhersage     : ${pred} (Konfidenz: ${(result.confidence * 100).toFixed(2)}%)`);
            
            const raw = result.rawScores;
            const sorted = Object.keys(raw).sort((a, b) => raw[b] - raw[a]);
            console.log(`   Verteilung: 1. ${sorted[0]} (${(raw[sorted[0]]*100).toFixed(1)}%) | 2. ${sorted[1]} (${(raw[sorted[1]]*100).toFixed(1)}%)`);
        } catch (e) {
            console.log(`\nFehler bei ${tp.date}:`, e.message);
        }
    }

    console.log(`\n========================================`);
    console.log(`Ergebnis: ${correct} von ${uniquePoints.length} Treffern (${((correct/uniquePoints.length)*100).toFixed(1)}%)`);

    await repo.close();
}

run().catch(console.error);
